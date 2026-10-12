// Stalled-work sweeper. A run can die without recording any outcome (the
// host killing the function mid-render, a dev-server restart) — Inngest's
// onFailure never fires for that, and the row stays "generating"/"rendering"
// indefinitely (a video render sat that way ~11h). Every 10 minutes this
// fails any in-flight track/pipeline that hasn't been touched for
// STALLED_AFTER_MS, recording how long and the last known error, so the job
// page shows what happened and the existing Retry flow can recover it.
// Longest legitimate quiet period is one render (2 x 20min polls, see
// renderLanguageTrack.ts STALE_CLAIM_MS), hence the 45-minute threshold.
import { inngest } from '../client'
import { createServiceClient, markPipelineFailed, markTrackFailed } from '../../server/pipeline/db'

const STALLED_AFTER_MS = 45 * 60 * 1000
// A render heartbeats (renderLanguageTrack's poll loop touches updated_at every
// ~10s), so a 'rendering' track silent this long has no live worker behind it —
// e.g. its Inngest run was cancelled at the function timeout.
const RENDER_STALLED_AFTER_MS = 15 * 60 * 1000
const client = createServiceClient()

type Stalled = { id: string; status: string; current_step?: string | null; last_error: string | null; updated_at: string }

function describe(kind: 'track' | 'pipeline', r: Stalled): string {
  const mins = Math.round((Date.now() - new Date(r.updated_at).getTime()) / 60000)
  const step = r.current_step ? ` at step '${r.current_step}'` : ''
  const prior = r.last_error ? ` Last error: ${r.last_error}` : ''
  return (
    `Stalled: ${kind} stuck in '${r.status}'${step} with no progress for ${mins} min — ` +
    `the worker running it likely stopped (host timeout, crash or restart).${prior} Use Retry to resume.`
  )
}

export const sweepStalledWork = inngest.createFunction(
  {
    id: 'sweep-stalled-work',
    // One sweep at a time: a backlog of missed cron ticks (dev server asleep)
    // would otherwise replay as dozens of concurrent runs.
    concurrency: { limit: 1 },
    triggers: [{ cron: '*/10 * * * *' }],
  },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - STALLED_AFTER_MS).toISOString()

    const renderCutoff = new Date(Date.now() - RENDER_STALLED_AFTER_MS).toISOString()

    const tracks = await step.run('fail-stalled-tracks', async () => {
      const [generating, rendering] = await Promise.all([
        client
          .from('content_language_tracks')
          .select('id, status, current_step, last_error, updated_at')
          .eq('status', 'generating')
          .lt('updated_at', cutoff),
        client
          .from('content_language_tracks')
          .select('id, status, current_step, last_error, updated_at')
          .eq('status', 'rendering')
          .lt('updated_at', renderCutoff),
      ])
      const error = generating.error ?? rendering.error
      if (error) throw error
      const data = [...(generating.data ?? []), ...(rendering.data ?? [])]
      for (const t of (data ?? []) as Stalled[]) await markTrackFailed(client, t.id, describe('track', t))
      return (data ?? []).length
    })

    const pipelines = await step.run('fail-stalled-pipelines', async () => {
      const { data, error } = await client
        .from('content_pipelines')
        .select('id, status, current_step, last_error, updated_at')
        .eq('status', 'generating')
        .lt('updated_at', cutoff)
      if (error) throw error
      for (const p of (data ?? []) as Stalled[]) await markPipelineFailed(client, p.id, describe('pipeline', p))
      return (data ?? []).length
    })

    return { tracks, pipelines }
  },
)
