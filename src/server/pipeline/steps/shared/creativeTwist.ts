import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptGenerator } from '../../adapters/types'
import {
  hasSucceededStep,
  getLastSucceededStepOutput,
  getRecentStepOutputs,
  recordStepAttempt,
} from '../../db'
import { composeCreativeTwistSystemPrompt } from '../../prompts/index'
import { pickDeterministic } from '../../prompts/core/rotation'
import type { BrandProfile, CreativeBrief, CreativeTwist } from '../../prompts/types'

export interface CreativeTwistInput {
  contentType: 'image_post' | 'blog'
  topic: string
  category: string
  /** The admin's own idea (plus any clarifying answers) the twist is built on. */
  sceneNotes?: string | null
}

/** Starting axes the deterministic rotation suggests, so concurrent jobs
 *  don't all converge on the same one. A suggestion only, the model may override. */
export const TWIST_AXES = [
  'hands-only or detail close-up',
  'single telling object, still life',
  'place or environment with no people',
  'one person in a story moment, no basket',
  'aerial, macro or unusual vantage',
  'visual metaphor',
  'distinct time of day, season or weather',
  'distinct colour story',
  'different setting: outdoor market, roadside, school, workplace, rural or remote community',
  'different setting: harvest field, farm, community hall, or a walk home in unusual weather',
] as const

/** Exported for unit testing, see creativeTwist.test.ts. */
export function normalizeCreativeTwist(parsed: unknown): CreativeTwist | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>
  if (typeof p.axis !== 'string' || typeof p.visual !== 'string' || p.visual.trim() === '') return null
  return {
    axis: p.axis,
    visual: p.visual.trim(),
    secondaryVisual: typeof p.secondaryVisual === 'string' ? p.secondaryVisual.trim() : '',
  }
}

async function recentConcepts(client: SupabaseClient, excludePipelineId: string): Promise<string[]> {
  try {
    const rows = await getRecentStepOutputs(client, 'creative_twist', excludePipelineId)
    return rows
      .map(normalizeCreativeTwist)
      .filter((t): t is CreativeTwist => t !== null)
      .map((t) => `${t.axis}: ${t.visual}`)
  } catch {
    return []
  }
}

/**
 * Picks a distinct visual concept for an image-bearing content type. Same
 * lightweight idempotency ledger pattern as interpretIntent.ts. Fails open:
 * returns null on any failure, so callers fall back to the un-twisted prompt
 * path this pipeline always used.
 */
export async function generateCreativeTwist(
  client: SupabaseClient,
  scope: { contentPipelineId: string },
  generation: number,
  scriptGenerator: ScriptGenerator,
  brand: BrandProfile,
  brief: CreativeBrief,
  input: CreativeTwistInput,
): Promise<CreativeTwist | null> {
  if (await hasSucceededStep(client, scope, 'creative_twist', generation)) {
    const cached = normalizeCreativeTwist(
      await getLastSucceededStepOutput(client, scope, 'creative_twist', generation),
    )
    if (cached) return cached
  }

  try {
    const result = await scriptGenerator.generate({
      systemPrompt: composeCreativeTwistSystemPrompt(
        brand,
        {
          contentType: input.contentType,
          recent: await recentConcepts(client, scope.contentPipelineId),
          suggestedAxis: pickDeterministic(`${scope.contentPipelineId}:${generation}:twist`, TWIST_AXES),
        },
        brief,
      ),
      userPrompt:
        `Topic: ${input.topic}\nCategory: ${input.category}` +
        (input.sceneNotes ? `\nAdmin's own idea: ${input.sceneNotes}` : ''),
      stepName: 'creative_twist',
    })
    const twist = normalizeCreativeTwist(result.parsed)
    if (!twist) {
      await recordStepAttempt(client, {
        ...scope,
        stepName: 'creative_twist',
        generation,
        attemptNumber: 1,
        status: 'failed_retryable',
        provider: 'openai',
        errorMessage: 'Malformed or incomplete JSON from creative twist',
      })
      return null
    }
    await recordStepAttempt(client, {
      ...scope,
      stepName: 'creative_twist',
      generation,
      attemptNumber: 1,
      status: 'succeeded',
      provider: 'openai',
      outputSnapshot: twist,
    })
    return twist
  } catch (err) {
    await recordStepAttempt(client, {
      ...scope,
      stepName: 'creative_twist',
      generation,
      attemptNumber: 1,
      status: 'failed_retryable',
      provider: 'openai',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}
