import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImageGenerator, ImagePollResult } from '../../adapters/types'
import { ProviderCallError } from '../../adapters/types'
import { videoStoragePublicUrl, type VideoStorageUploader } from '../../adapters/storage'
import { isPipelineFailed, recordStepAttempt, type PipelineRow } from '../../db'
import type { CastBibleEntry } from '../../prompts/types'
import { BRAND_PROFILE, composeCastRefPrompt } from '../../prompts/index'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 90_000

/**
 * One reference portrait per recurring person (cast_bible entry), generated
 * once per pipeline generation, before any scene image. Scene images then
 * attach the portraits of the people in that scene next to the vehicle
 * reference (composeSceneImagePrompt's castReferences), so a person keeps
 * one face across scenes instead of being re-imagined from text each time.
 *
 * FAIL OPEN: a portrait is an enhancement, never a gate. Any failure
 * returns null and the scenes fall back to the text-only cast clause they
 * always had. No content_visual_assets row: that table allows one
 * pipeline-level row per asset_type, and a cast can have several people,
 * so the portrait lives at a deterministic, generation-scoped storage path
 * instead — a re-run (resume, Inngest retry) finds and reuses it rather
 * than paying for a second portrait of the same person.
 */
export async function runGenerateCastRef(
  client: SupabaseClient,
  pipeline: PipelineRow,
  person: CastBibleEntry,
  imageGenerator: ImageGenerator,
  uploader: VideoStorageUploader,
  aspectRatio?: '9:16' | '1:1' | '16:9',
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const generation = pipeline.current_generation
  const safeId = person.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40) || 'person'
  const path = `${pipeline.job_id}/cast-ref-${safeId}-g${generation}.png`
  const stepName = `generate_cast_ref:${safeId}`

  const existingUrl = videoStoragePublicUrl(client, path)
  try {
    const head = await fetchImpl(existingUrl, { method: 'HEAD' })
    if (head.ok) {
      console.log(`[${stepName}] reusing existing portrait ${path}`)
      return existingUrl
    }
  } catch {
    // Not reachable means not there yet — generate it below.
  }

  const { prompt } = composeCastRefPrompt(BRAND_PROFILE, person)
  try {
    const jobRef = await imageGenerator.submit({ prompt, aspectRatio })
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let fileUrl: string | undefined
    while (Date.now() < deadline) {
      if (await isPipelineFailed(client, pipeline.id)) return null
      let result: ImagePollResult
      try {
        result = await imageGenerator.poll(jobRef)
      } catch (err) {
        if (err instanceof ProviderCallError && err.httpStatus === 404) throw err
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        continue
      }
      if (result.status === 'ready') {
        fileUrl = result.fileUrl
        break
      }
      if (result.status === 'failed') throw new Error(`portrait generation failed: ${result.detail}`)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    if (!fileUrl) throw new Error('portrait poll timed out')

    const permanentUrl = await uploader.uploadFromUrl(path, fileUrl)
    await recordStepAttempt(client, {
      contentPipelineId: pipeline.id,
      stepName,
      generation,
      attemptNumber: 1,
      status: 'succeeded',
      provider: 'kie',
      inputSnapshot: { prompt },
      outputSnapshot: { fileUrl: permanentUrl },
    })
    return permanentUrl
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[${stepName}] skipped, scenes fall back to the text-only cast description: ${message}`)
    await recordStepAttempt(client, {
      contentPipelineId: pipeline.id,
      stepName,
      generation,
      attemptNumber: 1,
      status: 'failed_terminal',
      provider: 'kie',
      inputSnapshot: { prompt },
      errorMessage: message,
    }).catch(() => {})
    return null
  }
}
