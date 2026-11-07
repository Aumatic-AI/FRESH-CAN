// Run-state rules shared by the single-shot Inngest functions, the finalizers and the
// resume/retry/approve routes. The decision logic is kept pure (no DB) so it is unit
// tested; the few DB helpers are thin wrappers around it.
import type { SupabaseClient } from '@supabase/supabase-js'
import { markPipelineFailed } from '../../db'
import { readSingleShotDraft } from './updateSingleShot'

export const CANCELLED_MESSAGE = 'Cancelled by user'

/** Pipeline statuses in which a render may still run or finish. */
export const RUNNING_PIPELINE_STATUSES = ['approved', 'generating'] as const

export type DraftKind = 'none' | 'single_shot' | 'legacy'

/** Which pipeline owns a draft row: a single-shot draft, a legacy scene-by-scene draft, or none yet. */
export function draftKindOf(row: { draft_data?: unknown } | null | undefined): DraftKind {
  if (!row) return 'none'
  return readSingleShotDraft(row.draft_data) ? 'single_shot' : 'legacy'
}

export async function getDraftKind(client: SupabaseClient, pipelineId: string): Promise<DraftKind> {
  const { data, error } = await client
    .from('content_drafts')
    .select('draft_data')
    .eq('content_pipeline_id', pipelineId)
    .maybeSingle()
  if (error) throw error
  return draftKindOf(data)
}

/** A run must stop (no more polling, paid calls or finalizing) once the pipeline has failed or been cancelled. */
export function isPipelineStopped(status: string | null | undefined): boolean {
  return status === 'failed'
}

export async function getPipelineStatus(client: SupabaseClient, pipelineId: string): Promise<string | null> {
  const { data, error } = await client.from('content_pipelines').select('status').eq('id', pipelineId).maybeSingle()
  if (error) throw error
  return (data?.status as string | undefined) ?? null
}

export async function getTrackStatus(client: SupabaseClient, trackId: string): Promise<string | null> {
  const { data, error } = await client.from('content_language_tracks').select('status').eq('id', trackId).maybeSingle()
  if (error) throw error
  return (data?.status as string | undefined) ?? null
}

/**
 * Fails the pipeline (and cascades to its tracks and the job) ONLY while it is still running.
 * A user cancel already wrote 'Cancelled by user'; a late provider failure must not overwrite it.
 */
export async function failPipelineIfRunning(client: SupabaseClient, pipelineId: string, message: string): Promise<boolean> {
  const { data, error } = await client
    .from('content_pipelines')
    .update({ status: 'failed', last_error: message, updated_at: new Date().toISOString() })
    .eq('id', pipelineId)
    .in('status', [...RUNNING_PIPELINE_STATUSES])
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) return false
  await markPipelineFailed(client, pipelineId, message)
  return true
}

/**
 * Whether a saved KIE task id may be reused on a retry. A task KIE reported as failed is dead:
 * polling it again would fail forever, so a fresh task is submitted. Any other saved task (still
 * rendering, finished, or one we merely stopped waiting for) is reused and never paid for twice.
 */
export function shouldReuseSubmittedTask(savedRef: string | null | undefined, failedRef: string | null | undefined): boolean {
  return !!savedRef && savedRef !== failedRef
}

/** A KIE task may time out this many times (each = a full poll window) before it is treated as dead. */
export const MAX_TIMEOUTS_PER_TASK = 2

/** How many times THIS task has now timed out, given the last recorded timeout (a different task starts over at 1). */
export function nextTimeoutCount(providerRef: string, last: { providerRef?: string; count?: number } | null | undefined): number {
  return last?.providerRef === providerRef && typeof last.count === 'number' ? last.count + 1 : 1
}

/** True once a task has timed out often enough that polling it again is pointless; the next retry submits a fresh one. */
export function isTaskStuck(timeoutCount: number): boolean {
  return timeoutCount >= MAX_TIMEOUTS_PER_TASK
}

export type SingleShotLanguages = 'EN' | 'FR' | 'BOTH'

export type RecoveryPlan =
  | { action: 'restart_render' }
  | { action: 'retry_french_track' }
  | { action: 'none'; reason: string }

/**
 * What "resume / retry" means for a single-shot video, from the current state:
 *  - cancelled by the user  -> nothing (a new generation is a new job)
 *  - the shared render failed (no English clip yet) -> restart the render (reuses a live KIE task,
 *    submits a fresh one only if the old task failed)
 *  - BOTH, English clip already finished, French track failed -> retry only the French track
 *  - still running or finished -> nothing to do
 */
export function planSingleShotRecovery(input: {
  pipelineStatus: string
  lastError: string | null
  languages: SingleShotLanguages
  /** The shared clip's library row exists and its track is ready. */
  clipReady: boolean
  frenchTrackStatus: string | null
}): RecoveryPlan {
  const { pipelineStatus, lastError, languages, clipReady, frenchTrackStatus } = input
  if (pipelineStatus === 'failed' && lastError === CANCELLED_MESSAGE) {
    return { action: 'none', reason: 'This video was cancelled by the user, not failed' }
  }
  if (languages === 'BOTH' && clipReady && frenchTrackStatus === 'failed') {
    return { action: 'retry_french_track' }
  }
  if (pipelineStatus === 'failed') {
    return clipReady
      ? { action: 'none', reason: 'The video already rendered; nothing to resume' }
      : { action: 'restart_render' }
  }
  if (pipelineStatus === 'ready') return { action: 'none', reason: 'This video has already finished generating' }
  return { action: 'none', reason: `Pipeline is '${pipelineStatus}' and nothing failed, so there is nothing to resume` }
}

export interface RecoveryEvent {
  id: string
  name: 'content/single-shot.render' | 'content/single-shot.track.fr'
  data: Record<string, string>
}

/** failed -> approved (CAS), failed tracks -> created, failed job -> generating. Null when the pipeline changed concurrently. */
export async function restartSingleShotRender(
  client: SupabaseClient,
  pipelineId: string,
  jobId: string,
): Promise<{ pipeline: Record<string, unknown>; event: RecoveryEvent } | null> {
  const now = new Date().toISOString()
  const { data: reset, error } = await client
    .from('content_pipelines')
    .update({ status: 'approved', last_error: null, current_step: null, updated_at: now })
    .eq('id', pipelineId)
    .eq('status', 'failed')
    .select()
    .maybeSingle()
  if (error) throw error
  if (!reset) return null

  const { error: tErr } = await client
    .from('content_language_tracks')
    .update({ status: 'created', last_error: null, retry_count: 0, current_step: null, updated_at: now })
    .eq('content_pipeline_id', pipelineId)
    .eq('status', 'failed')
  if (tErr) throw tErr
  await client.from('content_jobs').update({ status: 'generating', updated_at: now }).eq('id', jobId).eq('status', 'failed')

  return {
    pipeline: reset as Record<string, unknown>,
    event: {
      id: `${pipelineId}:single-shot.render:restart-${reset.updated_at as string}`,
      name: 'content/single-shot.render',
      data: { pipelineId, jobId },
    },
  }
}

/** Resets a failed French track and returns the event that reruns only that track. Null when it changed concurrently. */
export async function restartFrenchTrack(
  client: SupabaseClient,
  pipelineId: string,
  jobId: string,
  trackId: string,
): Promise<{ track: Record<string, unknown>; event: RecoveryEvent } | null> {
  const now = new Date().toISOString()
  const { data: updated, error } = await client
    .from('content_language_tracks')
    .update({ status: 'created', retry_count: 0, last_error: null, current_step: null, updated_at: now })
    .eq('id', trackId)
    .eq('status', 'failed')
    .select()
    .maybeSingle()
  if (error) throw error
  if (!updated) return null
  await client.from('content_jobs').update({ status: 'generating', updated_at: now }).eq('id', jobId).eq('status', 'failed')
  await client
    .from('content_pipelines')
    .update({ status: 'generating', last_error: null, updated_at: now })
    .eq('id', pipelineId)
    .eq('status', 'failed')
  return {
    track: updated as Record<string, unknown>,
    event: {
      id: `${trackId}:single-shot.track.fr:retry-${updated.updated_at as string}`,
      name: 'content/single-shot.track.fr',
      data: { pipelineId, jobId, trackId },
    },
  }
}
