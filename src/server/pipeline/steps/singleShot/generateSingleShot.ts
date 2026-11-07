// Single-shot test path (branch test/seedance-single-shot): submit, poll and
// finalize one 30s Seedance 2.5 clip. Orchestrated by
// inngest/functions/singleShot.ts, which sleeps between polls so a long render
// never holds one function invocation open.
//
// Everything is written to the SAME tables as every other video so the result
// appears in the library and on the job page: content_pipelines (status),
// content_language_tracks (one minimal EN row — upsertVideoGeneratedContent
// requires a track id), generated_content (file_url + output_data marker) and
// the freshcan-videos bucket. No video_scenes / audio / caption rows exist.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VideoPollResult } from '../../adapters/types'
import type { VideoStorageUploader } from '../../adapters/storage'
import type { SingleShotGenerationInput, SingleShotGenerator } from '../../adapters/kieSingleShot'
import { SINGLE_SHOT_RESOLUTION } from '../../adapters/kieSingleShot'
import {
  getLastSucceededStepOutput,
  hasSucceededStep,
  markJobReadyIfAllContentComplete,
  recordStepAttempt,
  upsertVideoGeneratedContent,
} from '../../db'
import { SINGLE_SHOT_DURATION_SECONDS } from '../../prompts/singleShot'
import { watermarkVideo } from '../../lib/videoWatermark'
import {
  CANCELLED_MESSAGE,
  RUNNING_PIPELINE_STATUSES,
  getPipelineStatus,
  isPipelineStopped,
  isTaskStuck,
  nextTimeoutCount,
  shouldReuseSubmittedTask,
} from './runState'

export const SUBMIT_STEP_NAME = 'single_shot_submit'
/** Written when KIE reports a task as failed, so a retry submits a fresh task instead of re-polling a dead one. */
export const TASK_FAILED_STEP_NAME = 'single_shot_task_failed'

/** Thrown by finalizers when the run was cancelled or failed underneath them; callers treat it as a clean stop. */
export class SingleShotStoppedError extends Error {
  constructor(message = 'single-shot run was stopped before it finished') {
    super(message)
    this.name = 'SingleShotStoppedError'
  }
}

export interface SingleShotMeta {
  model: string
  originalIdea: string
  enhancedPrompt: string
  hook: string
  /** How Seedance was told to voice the video: an unseen voiceover, or on-camera lip-synced dialogue. */
  containerShown: 'none' | 'exterior' | 'interior' | 'both'
  referenceImageUrls: string[]
  audioMode: 'narration' | 'dialogue'
  audioReason: string
  speakers: { label: string; description: string }[]
  spokenLines: { speaker: string; text: string }[]
  aspectRatio: '9:16' | '1:1' | '16:9'
  /** The language of THIS clip's voice (the shared render is the EN track; FR-only renders French). */
  language: 'EN' | 'FR'
}

/**
 * Submits to KIE once per live task. A retry reuses the saved task id (never pays twice) unless KIE
 * reported that task as failed, in which case a fresh task is submitted.
 */
export async function submitSingleShot(
  client: SupabaseClient,
  pipelineId: string,
  generation: number,
  generator: SingleShotGenerator,
  input: SingleShotGenerationInput,
): Promise<string> {
  const scope = { contentPipelineId: pipelineId }
  if (await hasSucceededStep(client, scope, SUBMIT_STEP_NAME, generation)) {
    const saved = (await getLastSucceededStepOutput(client, scope, SUBMIT_STEP_NAME, generation)) as
      | { providerRef?: string }
      | null
    const failed = (await getLastSucceededStepOutput(client, scope, TASK_FAILED_STEP_NAME, generation)) as
      | { providerRef?: string }
      | null
    if (saved?.providerRef && shouldReuseSubmittedTask(saved.providerRef, failed?.providerRef)) return saved.providerRef
  }

  const ref = await generator.submit(input)
  await recordStepAttempt(client, {
    ...scope,
    stepName: SUBMIT_STEP_NAME,
    generation,
    attemptNumber: 1,
    status: 'succeeded',
    provider: 'kie',
    inputSnapshot: {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.durationSeconds,
      resolution: SINGLE_SHOT_RESOLUTION,
      referenceImageUrls: input.referenceImageUrls ?? [],
    },
    outputSnapshot: { providerRef: ref.providerRef },
  })
  return ref.providerRef
}

/** Marks a KIE task as dead (KIE reported failure) so the next attempt submits a new one. */
export async function recordSingleShotTaskFailed(
  client: SupabaseClient,
  pipelineId: string,
  generation: number,
  providerRef: string,
  detail: string,
): Promise<void> {
  await recordStepAttempt(client, {
    contentPipelineId: pipelineId,
    stepName: TASK_FAILED_STEP_NAME,
    generation,
    attemptNumber: 1,
    status: 'succeeded',
    provider: 'kie',
    outputSnapshot: { providerRef, detail },
  })
}

/** Written each time a task's poll window runs out, so repeated timeouts of the same task can be counted. */
export const TASK_TIMEOUT_STEP_NAME = 'single_shot_task_timeout'

/**
 * Records that a task did not finish within the poll window. The first timeout keeps the task alive (KIE may
 * still finish it, and a Resume polls it again for free). Once the same task has timed out repeatedly it is
 * marked dead like a KIE-reported failure, so the next retry submits a fresh task instead of polling it forever.
 */
export async function recordSingleShotTimeout(
  client: SupabaseClient,
  pipelineId: string,
  generation: number,
  providerRef: string,
): Promise<{ count: number; stuck: boolean }> {
  const scope = { contentPipelineId: pipelineId }
  const last = (await getLastSucceededStepOutput(client, scope, TASK_TIMEOUT_STEP_NAME, generation)) as
    | { providerRef?: string; count?: number }
    | null
  const count = nextTimeoutCount(providerRef, last)
  await recordStepAttempt(client, {
    ...scope,
    stepName: TASK_TIMEOUT_STEP_NAME,
    generation,
    attemptNumber: count,
    status: 'succeeded',
    provider: 'kie',
    outputSnapshot: { providerRef, count },
  })
  const stuck = isTaskStuck(count)
  if (stuck) await recordSingleShotTaskFailed(client, pipelineId, generation, providerRef, `timed out ${count} times`)
  return { count, stuck }
}

export async function pollSingleShot(generator: SingleShotGenerator, providerRef: string): Promise<VideoPollResult> {
  return generator.poll({ providerRef })
}

/** Downloads the KIE clip into storage, writes the library row, and marks pipeline and job ready. */
export async function finalizeSingleShot(
  client: SupabaseClient,
  uploader: VideoStorageUploader,
  args: {
    pipelineId: string
    jobId: string
    generation: number
    kieFileUrl: string
    meta: SingleShotMeta
    /** False for BOTH: the French track still has to finish before the pipeline and job are ready. Default true. */
    completesPipeline?: boolean
    /** Test seams; default to the real download and the real ffmpeg logo overlay. */
    fetchImpl?: typeof fetch
    watermark?: (video: Buffer) => Promise<Buffer>
  },
): Promise<string> {
  const { pipelineId, jobId, generation, kieFileUrl, meta } = args

  // Stop BEFORE any download/upload/write if the run was cancelled or failed meanwhile.
  if (isPipelineStopped(await getPipelineStatus(client, pipelineId))) throw new SingleShotStoppedError()

  // Same logo as the image pipeline (lib/watermark.ts), burned into the video. The untouched Seedance
  // file is kept next to it (`-raw`), so the logo can be redone without paying for another render.
  const res = await (args.fetchImpl ?? fetch)(kieFileUrl)
  if (!res.ok) throw new Error(`failed to download from ${kieFileUrl} (status ${res.status})`)
  const raw = Buffer.from(await res.arrayBuffer())
  await uploader.uploadBuffer(`${jobId}/single-shot-g${generation}-raw.mp4`, raw, 'video/mp4')
  const logoed = await (args.watermark ?? watermarkVideo)(raw)
  const fileUrl = await uploader.uploadBuffer(`${jobId}/single-shot-g${generation}.mp4`, logoed, 'video/mp4')

  const trackId = await ensureTrack(client, pipelineId, generation, meta.language)
  await upsertVideoGeneratedContent(client, {
    jobId,
    language: meta.language,
    contentPipelineId: pipelineId,
    contentLanguageTrackId: trackId,
    fileUrl,
    sceneCount: 1,
  })

  // Marker so single-shot videos are recognisable next to normal ones.
  const { error: markErr } = await client
    .from('generated_content')
    .update({
      output_data: {
        language: meta.language,
        total_scenes: 1,
        single_shot: true,
        model: meta.model,
        resolution: SINGLE_SHOT_RESOLUTION,
        // duration_sec is the key the library, dashboard and notifications read; duration_seconds is kept for the draft/job page.
        duration_sec: SINGLE_SHOT_DURATION_SECONDS,
        duration_seconds: SINGLE_SHOT_DURATION_SECONDS,
        aspect_ratio: meta.aspectRatio,
        original_idea: meta.originalIdea,
        enhanced_prompt: meta.enhancedPrompt,
        hook: meta.hook,
        container_shown: meta.containerShown,
        reference_image_urls: meta.referenceImageUrls,
        audio_mode: meta.audioMode,
        audio_reason: meta.audioReason,
        speakers: meta.speakers,
        spoken_lines: meta.spokenLines,
      },
    })
    .eq('content_language_track_id', trackId)
  if (markErr) throw markErr

  // Final compare-and-swap: only a still-running pipeline may be finalized. If a cancel landed after
  // the pre-check above, undo what this call wrote instead of resurrecting a cancelled video.
  const now = new Date().toISOString()
  const completes = args.completesPipeline !== false
  const { data: stillRunning, error: casErr } = await client
    .from('content_pipelines')
    .update(completes ? { status: 'ready', current_step: null, updated_at: now } : { updated_at: now })
    .eq('id', pipelineId)
    .in('status', [...RUNNING_PIPELINE_STATUSES, 'ready'])
    .select('id')
    .maybeSingle()
  if (casErr) throw casErr
  if (!stillRunning) {
    await client.from('generated_content').delete().eq('content_language_track_id', trackId)
    await client
      .from('content_language_tracks')
      .update({ status: 'failed', last_error: CANCELLED_MESSAGE, updated_at: now })
      .eq('id', trackId)
    throw new SingleShotStoppedError()
  }
  const { error: trackErr } = await client
    .from('content_language_tracks')
    .update({ status: 'ready', current_step: null, updated_at: now })
    .eq('id', trackId)
  if (trackErr) throw trackErr

  if (completes) await markJobReadyIfAllContentComplete(client, jobId)
  return fileUrl
}

async function ensureTrack(
  client: SupabaseClient,
  pipelineId: string,
  generation: number,
  language: 'EN' | 'FR',
): Promise<string> {
  const { data: existing, error: findErr } = await client
    .from('content_language_tracks')
    .select('id')
    .eq('content_pipeline_id', pipelineId)
    .eq('language', language)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing) return existing.id as string

  const { data, error } = await client
    .from('content_language_tracks')
    .insert({ content_pipeline_id: pipelineId, language, master_generation_used: generation, status: 'generating' })
    .select('id')
    .single()
  if (!error && data) return data.id as string

  // Lost a race with a concurrent attempt: read the winner's row.
  const { data: raced, error: raceErr } = await client
    .from('content_language_tracks')
    .select('id')
    .eq('content_pipeline_id', pipelineId)
    .eq('language', language)
    .single()
  if (raceErr || !raced) throw error ?? raceErr
  return raced.id as string
}
