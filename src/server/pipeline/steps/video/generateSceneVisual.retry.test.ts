import { describe, it, expect } from 'vitest'
import * as sceneVisual from './generateSceneVisual'
import { buildCorrectionInstruction, isExtraPersonIssue, validationRetryBudget } from './generateSceneVisual'
import { composeSceneVideoPrompt } from '../../prompts/core/compose'

const PERSON = 'more people than planned or a duplicated person'

describe('validationRetryBudget (a wrong headcount gets one extra regeneration)', () => {
  it('allows 2 regenerations when every issue is a headcount problem', () => {
    expect(isExtraPersonIssue(PERSON)).toBe(true)
    expect(validationRetryBudget([PERSON])).toBe(2)
    expect(validationRetryBudget([PERSON, 'a duplicated person'])).toBe(2)
  })

  it('keeps the single retry for every other issue, or a mix', () => {
    expect(validationRetryBudget(['door or opening drawn on the truck\'s side or front'])).toBe(1)
    expect(validationRetryBudget(['legible third-party brand name or logo'])).toBe(1)
    expect(validationRetryBudget([PERSON, 'legible third-party brand name or logo'])).toBe(1)
    expect(validationRetryBudget([])).toBe(1)
  })
})

describe('headcount correction instruction', () => {
  it('also rules out an extra person in any reflection', () => {
    expect(buildCorrectionInstruction([PERSON], 1)).toContain('any reflection in glass')
    expect(buildCorrectionInstruction([PERSON])).toContain('any reflection in glass')
  })
})

describe('finished-clip check is report-only (no clip regeneration)', () => {
  it('exposes no clip-regeneration machinery', () => {
    expect(Object.keys(sceneVisual)).not.toContain('buildClipCorrection')
    expect(Object.keys(sceneVisual)).not.toContain('CLIP_VALIDATION_RETRY_PREFIX')
  })

  it('the clip prompt has no correction channel', () => {
    const base = { visualDescription: 'The worker holds an apple.', shotNotes: 'Static medium shot.', unitPresence: 'featured' as const }
    const withExtra = composeSceneVideoPrompt({ ...base, correction: 'Exactly 1 person in every frame' } as never)
    expect(withExtra).not.toContain('Exactly 1 person in every frame')
  })
})
