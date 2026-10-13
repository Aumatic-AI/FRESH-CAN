
import { describe, it, expect } from 'vitest'
import { applyScriptEdits, buildScriptSummary } from './updateScript'
import { maxNarrationWords, narrationWordRange, NARRATION_WORDS_PER_SECOND, resolveWordsPerSecond } from '../../../../lib/videoNarrationBudget'
import { composeLocalizeScriptSystemPrompt, BRAND_PROFILE } from '../../prompts/index'
import type { VideoSceneRow } from '../../db'

function scene(overrides: Partial<VideoSceneRow> = {}): VideoSceneRow {
  return {
    id: 'scene-1',
    content_pipeline_id: 'pipeline-1',
    generation: 1,
    scene_number: 1,
    visual_description: 'The truck pulls up.',
    shot_notes: null,
    narration_intent: { text: 'Original narration.', beat: 'setup', unit_presence: 'featured' },
    target_duration_ms: 10_000,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('applyScriptEdits', () => {
  it('stores the edit as the spoken narration while preserving every other field, including the intent text', () => {
    const result = applyScriptEdits([scene()], [{ id: 'scene-1', narration: 'New narration.' }])
    expect('error' in result).toBe(false)
    if ('error' in result) return
    expect(result.updates).toEqual([
      {
        sceneNumber: 1,
        narrationIntent: { text: 'Original narration.', narration: 'New narration.', beat: 'setup', unit_presence: 'featured' },
      },
    ])
  })

  it('trims narration text', () => {
    const result = applyScriptEdits([scene()], [{ id: 'scene-1', narration: '  spaced  ' }])
    if ('error' in result) throw new Error('expected success')
    expect(result.updates[0].narrationIntent.narration).toBe('spaced')
  })

  it('only returns updates for edited scenes, not every scene', () => {
    const scenes = [scene({ id: 'scene-1', scene_number: 1 }), scene({ id: 'scene-2', scene_number: 2 })]
    const result = applyScriptEdits(scenes, [{ id: 'scene-2', narration: 'Only this one.' }])
    if ('error' in result) throw new Error('expected success')
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].sceneNumber).toBe(2)
  })

  it('rejects an unknown scene id — a stale/regenerated scene plan, not a partial-apply case', () => {
    const result = applyScriptEdits([scene()], [{ id: 'not-a-real-scene', narration: 'x' }])
    expect('error' in result).toBe(true)
  })

  it('rejects an empty scenes array', () => {
    expect('error' in applyScriptEdits([scene()], [])).toBe(true)
  })

  it('rejects a non-array payload', () => {
    expect('error' in applyScriptEdits([scene()], { id: 'scene-1', narration: 'x' })).toBe(true)
  })

  it('rejects blank narration text', () => {
    const result = applyScriptEdits([scene()], [{ id: 'scene-1', narration: '   ' }])
    expect('error' in result).toBe(true)
  })

  it('rejects a malformed edit shape', () => {
    expect('error' in applyScriptEdits([scene()], [{ id: 'scene-1' }])).toBe(true)
  })

  it('handles a scene with no pre-existing narration_intent object', () => {
    const result = applyScriptEdits(
      [scene({ narration_intent: null })],
      [{ id: 'scene-1', narration: 'Fresh text.' }],
    )
    if ('error' in result) throw new Error('expected success')
    expect(result.updates[0].narrationIntent).toEqual({ narration: 'Fresh text.' })
  })

  it("rejects narration over the scene's word limit (the approved text is spoken verbatim, so it must fit)", () => {
    const { max } = narrationWordRange(5_000)
    const over = Array.from({ length: max + 1 }, (_, i) => `word${i}`).join(' ')
    const result = applyScriptEdits([scene({ target_duration_ms: 5_000 })], [{ id: 'scene-1', narration: over }])
    expect('error' in result && result.error).toContain(`over the ${max}-word limit`)
  })

  it('accepts narration exactly at the limit', () => {
    const { max } = narrationWordRange(5_000)
    const atMax = Array.from({ length: max }, (_, i) => `word${i}`).join(' ')
    expect('error' in applyScriptEdits([scene({ target_duration_ms: 5_000 })], [{ id: 'scene-1', narration: atMax }])).toBe(false)
  })

  it("uses the band stored with the scene (the voice's real rate) instead of the default one", () => {
    const tight = scene({
      target_duration_ms: 10_000,
      narration_intent: { text: 'x', narration: 'old', narration_limit: { min: 3, max: 5 } },
    })
    expect('error' in applyScriptEdits([tight], [{ id: 'scene-1', narration: 'one two three four five six' }])).toBe(true)
    expect('error' in applyScriptEdits([tight], [{ id: 'scene-1', narration: 'one two three four five' }])).toBe(false)
  })

  it('rejects a possessive brand name (speech-to-text mishears it)', () => {
    const result = applyScriptEdits([scene()], [{ id: 'scene-1', narration: "Thanks to Fresh-CAN's ease." }])
    expect('error' in result && result.error).toContain('never possessive')
  })

  it('rejects narration describing someone entering or leaving the unit', () => {
    const result = applyScriptEdits([scene()], [{ id: 'scene-1', narration: 'She enters the unit and shops.' }])
    expect('error' in result && result.error).toContain('entering or leaving')
  })
})

describe('maxNarrationWords', () => {
  it('scales with duration and stays a strict ceiling above the raw (untoleranced) rate', () => {
    const words10s = maxNarrationWords(10_000)
    const words20s = maxNarrationWords(20_000)
    expect(words20s).toBeGreaterThan(words10s)
    expect(words10s).toBeGreaterThan(10 * NARRATION_WORDS_PER_SECOND) // tolerance adds real slack
  })

  it('derives from the exact same rate composeLocalizeScriptSystemPrompt targets — the two can never silently diverge', () => {
    const prompt = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English' })
    expect(prompt).toContain(`${NARRATION_WORDS_PER_SECOND} words per second`)
  })
})

describe('buildScriptSummary', () => {
  it('joins narration text in scene order regardless of input order', () => {
    const summary = buildScriptSummary([
      { scene_number: 2, narrationText: 'Second.' },
      { scene_number: 1, narrationText: 'First.' },
    ])
    expect(summary).toBe('First.\n\nSecond.')
  })

  it('drops scenes with blank narration text', () => {
    const summary = buildScriptSummary([
      { scene_number: 1, narrationText: 'First.' },
      { scene_number: 2, narrationText: '   ' },
    ])
    expect(summary).toBe('First.')
  })
})

describe('resolveWordsPerSecond', () => {
  it('uses a plausible measured rate as-is (rounded to 2dp)', () => {
    expect(resolveWordsPerSecond(2.4412)).toBe(2.44)
  })

  it('falls back to the fleet default for missing, non-finite or implausible measurements', () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0.4, 9]) {
      expect(resolveWordsPerSecond(bad as number | null | undefined)).toBe(NARRATION_WORDS_PER_SECOND)
    }
  })

  it('the fleet default is the re-measured ~2.65, not the old 3.1', () => {
    expect(NARRATION_WORDS_PER_SECOND).toBe(2.65)
  })

  it('maxNarrationWords honours a voice-specific rate', () => {
    expect(maxNarrationWords(10_000, 2.44)).toBeLessThan(maxNarrationWords(10_000, 3.1))
  })
})
