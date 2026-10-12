import { CREDENTIAL_UNAVAILABLE_PREFIX } from '../server/pipeline/credentials'
import { createServiceClient, markPipelineFailed, markTrackFailed } from '../server/pipeline/db'

// onFailure handler shared by every job-scoped pipeline function. Inngest
// calls it once a run has failed terminally (retries exhausted, thrown
// non-retriable error, or the function-level timeout) — nothing will resume
// that run, so any row it left in-flight would otherwise sit at "generating"
// forever with no explanation (a render stalled for ~11h this way). Records
// the real reason on the track/pipeline so the job page shows it, and rolls
// the job to 'failed' via markTrackFailed/markPipelineFailed.
// A credential-unavailable error keeps its message verbatim; anything else is
// prefixed so it's clear the run itself stopped, not a provider rejection.
export async function failJobOnRunFailure({
  event,
}: {
  event: {
    data: {
      function_id?: string
      error?: { message?: string; name?: string }
      event?: { data?: unknown }
    }
  }
}): Promise<void> {
  const raw = event.data.error?.message ?? event.data.error?.name ?? 'unknown error'
  const message = raw.startsWith(CREDENTIAL_UNAVAILABLE_PREFIX)
    ? raw
    : `Run stopped (${event.data.function_id ?? 'pipeline function'}): ${raw}`
  await failInFlightRows((event.data.event?.data ?? {}) as OriginalEventData, message)
}

type OriginalEventData = { pipelineId?: string; trackId?: string }

// Fails the track (or pipeline) the original event pointed at, only if it is
// still in flight — a user cancel or an earlier terminal outcome already wrote
// its own, more specific, last_error.
async function failInFlightRows(original: OriginalEventData, message: string): Promise<void> {
  const client = createServiceClient()


  // Only fail rows still in flight — a user cancel or an earlier terminal
  // outcome already wrote its own, more specific, last_error.
  if (original.trackId) {
    const { data } = await client.from('content_language_tracks').select('status').eq('id', original.trackId).maybeSingle()
    if (data && data.status !== 'ready' && data.status !== 'failed') {
      await markTrackFailed(client, original.trackId, message)
    }
  } else if (original.pipelineId) {
    const { data } = await client.from('content_pipelines').select('status').eq('id', original.pipelineId).maybeSingle()
    if (data && data.status !== 'ready' && data.status !== 'failed') {
      await markPipelineFailed(client, original.pipelineId, message)
    }
  }
}

/**
 * Handler for Inngest's `inngest/function.cancelled` event. A run that hits its
 * function-level `timeouts.finish` is CANCELLED, not failed, so onFailure never
 * fires for it (real job 369ff9de: the render run was cancelled at the 30-minute
 * cap and its track sat at 'rendering' with no error). This fails the in-flight
 * row with the reason; a user cancel already marked its row failed first, so
 * that case is left untouched.
 */
export async function failJobOnRunCancelled({
  event,
}: {
  event: { data: { function_id?: string; event?: { data?: unknown }; events?: { data?: unknown }[] } }
}): Promise<void> {
  const original = (event.data.event?.data ?? event.data.events?.[0]?.data ?? {}) as OriginalEventData
  if (!original.trackId && !original.pipelineId) return
  await failInFlightRows(
    original,
    `Run cancelled (${event.data.function_id ?? 'pipeline function'}): it hit its time limit or was cancelled before finishing. Use Retry to resume.`,
  )
}
