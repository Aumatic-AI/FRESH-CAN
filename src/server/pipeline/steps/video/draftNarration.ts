import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptGenerator } from '../../adapters/types'
import {
  getMeasuredWordsPerSecond,
  getVideoPlanDraftData,
  getVideoScenes,
  recordStepAttempt,
  upsertVideoScenes,
} from '../../db'
import {
  narrationWordRange,
  readSceneNarration,
  resolveWordsPerSecond,
} from '../../../../lib/videoNarrationBudget'
import { writeNarration } from './localizeScript'
import { buildScriptSummary } from './updateScript'

/**
 * Draft-time narration (runs right after generate_script, before the user
 * approves). Writes the real, spoken English narration for every scene, sized
 * to each scene's word band, and stores it on the scene
 * (`narration_intent.narration`, plus the band it was written against as
 * `narration_limit` so the editor and the edit route enforce the same limits).
 * The dashboard shows and edits this text; on approval localize_script uses it
 * verbatim for EN and translates it for FR — so the approved script is what is
 * actually spoken.
 *
 * Fail-open: any error leaves the draft as it was (no narration written), the
 * dashboard then shows empty narration boxes, and localize_script falls back to
 * writing narration from the scene intents exactly as it did before.
 * Idempotent: scenes that already have narration are left alone.
 */
export async function runDraftNarration(
  client: SupabaseClient,
  contentPipelineId: string,
  scriptGenerator: ScriptGenerator,
  options?: { voiceId?: string | null; sceneNotes?: string | null },
): Promise<{ wrote: boolean }> {
  const scenes = await getVideoScenes(client, contentPipelineId)
  if (scenes.length === 0) return { wrote: false }
  if (scenes.every((s) => readSceneNarration(s.narration_intent).trim() !== '')) return { wrote: false }

  const generation = scenes[0].generation
  try {
    const measuredRate = options?.voiceId ? await getMeasuredWordsPerSecond(client, options.voiceId, 'EN') : null
    const wordsPerSecond = resolveWordsPerSecond(measuredRate)
    const localized = await writeNarration(scriptGenerator, scenes, {
      language: 'English',
      wordsPerSecond,
      sceneNotes: options?.sceneNotes,
    })

    const byScene = new Map(localized.map((l) => [l.scene_number, l.narration_text.trim()]))
    await upsertVideoScenes(client, {
      contentPipelineId,
      generation,
      scenes: scenes.map((s) => {
        const existing =
          s.narration_intent && typeof s.narration_intent === 'object' ? (s.narration_intent as Record<string, unknown>) : {}
        return {
          sceneNumber: s.scene_number,
          visualDescription: s.visual_description,
          shotNotes: s.shot_notes,
          narrationIntent: {
            ...existing,
            narration: byScene.get(s.scene_number) ?? '',
            narration_limit: narrationWordRange(s.target_duration_ms, wordsPerSecond),
          },
          targetDurationMs: s.target_duration_ms,
        }
      }),
    })

    // The dashboard's "Script" card now shows the real narration, in scene order.
    const script = buildScriptSummary(
      scenes.map((s) => ({ scene_number: s.scene_number, narrationText: byScene.get(s.scene_number) ?? '' })),
    )
    const draftData = await getVideoPlanDraftData(client, contentPipelineId)
    if (draftData) {
      await client
        .from('content_drafts')
        .update({ draft_data: { ...draftData, script }, updated_at: new Date().toISOString() })
        .eq('content_pipeline_id', contentPipelineId)
        .eq('content_type', 'video')
    }

    await recordStepAttempt(client, {
      contentPipelineId,
      stepName: 'draft_narration',
      generation,
      attemptNumber: 1,
      status: 'succeeded',
      provider: 'openai',
      outputSnapshot: { scenes: localized, wordsPerSecond },
    })
    return { wrote: true }
  } catch (err) {
    await recordStepAttempt(client, {
      contentPipelineId,
      stepName: 'draft_narration',
      generation,
      attemptNumber: 1,
      status: 'failed_retryable',
      provider: 'openai',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return { wrote: false }
  }
}
