import { describe, it, expect } from 'vitest'
import { buildImageValidationSystemPrompt, UNIT_STRUCTURE_VALIDATION_CLAUSE, REAR_VIEW_VALIDATION_CLAUSE, HEADCOUNT_VALIDATION_CLAUSE } from './openai'
import { isUnitDoorIssue, buildCorrectionInstruction } from '../steps/video/generateSceneVisual'

describe('unit-structure validation', () => {
  it('adds the truck clause only when the unit can appear', () => {
    const base = buildImageValidationSystemPrompt('none')
    expect(base).not.toContain(UNIT_STRUCTURE_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt(undefined)).toBe(base)
    expect(buildImageValidationSystemPrompt('featured')).toBe(base + UNIT_STRUCTURE_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('background')).toContain('REAR face')
  })
  it('recognises the door issue and corrects with a positive rule', () => {
    const issue = "door or opening drawn on the truck's side or front"
    expect(isUnitDoorIssue(issue)).toBe(true)
    expect(isUnitDoorIssue('disembodied hand floating above the counter')).toBe(false)
    expect(buildCorrectionInstruction([issue])).toMatch(/solid, unbroken maroon/)
  })
})

describe('validator scope (post job a64ab879)', () => {
  it('always checks third-party brands, and never calls a rear 3/4 door a defect', async () => {
    const { THIRD_PARTY_BRAND_VALIDATION_CLAUSE } = await import('./openai')
    expect(buildImageValidationSystemPrompt('none')).toContain(THIRD_PARTY_BRAND_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('featured')).toContain('must NOT be reported')
  })
  it('routes a third-party brand finding to a from-scratch correction', async () => {
    const { isThirdPartyBrandIssue } = await import('../steps/video/generateSceneVisual')
    expect(isThirdPartyBrandIssue('legible third-party brand name or logo')).toBe(true)
    expect(buildCorrectionInstruction(['legible third-party brand name or logo'])).toMatch(/no readable brand names/)
  })
})

describe('headcount validation (job e31d325e: duplicate daughter in scene 2)', () => {
  it('adds the headcount clause only for a sane planned count', async () => {
    const { HEADCOUNT_VALIDATION_CLAUSE } = await import('./openai')
    expect(buildImageValidationSystemPrompt('featured', 2)).toContain(HEADCOUNT_VALIDATION_CLAUSE)
    for (const bad of [undefined, 0, -1, 2.5, 9, Number.NaN]) {
      expect(buildImageValidationSystemPrompt('featured', bad as number)).not.toContain(HEADCOUNT_VALIDATION_CLAUSE)
    }
    // unit clause behaviour is unchanged by the new argument
    expect(buildImageValidationSystemPrompt('none', 2)).not.toContain('REAR face')
  })

  it('tells the validator the planned count in the scene text', async () => {
    const { OpenAIImageValidator } = await import('./openai')
    let body = ''
    const fakeFetch = (async (_u: unknown, init: { body: string }) => {
      body = init.body
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"issues":[]}' } }] }) }
    }) as unknown as typeof fetch
    await new OpenAIImageValidator('k', fakeFetch).validate({ imageUrl: 'u', visualDescription: 'v', expectedPeople: 2 })
    expect(body).toContain('The plan shows exactly 2 people.')
    await new OpenAIImageValidator('k', fakeFetch).validate({ imageUrl: 'u', visualDescription: 'v' })
    expect(body).not.toContain('The plan shows exactly')
  })

  it('routes an extra-person finding to a from-scratch correction that restates the count', async () => {
    const { isExtraPersonIssue } = await import('../steps/video/generateSceneVisual')
    expect(isExtraPersonIssue('more people than planned or a duplicated person')).toBe(true)
    expect(isExtraPersonIssue('disembodied hand floating above the counter')).toBe(false)
    expect(buildCorrectionInstruction(['more people than planned or a duplicated person'], 2)).toMatch(/Exactly 2 different people/)
    expect(buildCorrectionInstruction(['more people than planned or a duplicated person'])).toMatch(/exactly once/)
  })
})

describe('rear-view validator clause', () => {
  it('is added only for a unit-present rear / rear34 scene', () => {
    const base = buildImageValidationSystemPrompt('featured')
    expect(buildImageValidationSystemPrompt('featured', undefined, 'rear')).toBe(base + REAR_VIEW_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('background', undefined, 'rear34')).toContain(REAR_VIEW_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('featured', undefined, 'side')).toBe(base)
    expect(buildImageValidationSystemPrompt('none', undefined, 'rear')).not.toContain(REAR_VIEW_VALIDATION_CLAUSE)
  })
})

describe('headcount clause and reflections (job 369ff9de: a man in the glass facing the camera while the real man walked away)', () => {
  it('counts a reflection with an extra or differently-facing figure as an extra person, but not a matching mirror image, screen or photo', () => {
    expect(HEADCOUNT_VALIDATION_CLAUSE).toContain('A reflection in glass, a window or a mirror that matches the real subject')
    expect(HEADCOUNT_VALIDATION_CLAUSE).toContain('a figure facing a different way than the real subject, counts as an extra person')
    expect(HEADCOUNT_VALIDATION_CLAUSE).toContain('Screens and photos do not count as people')
    expect(HEADCOUNT_VALIDATION_CLAUSE).toContain('"more people than planned or a duplicated person"')
  })

  it('is added only when the plan gives a headcount', () => {
    expect(buildImageValidationSystemPrompt('none', 1)).toContain(HEADCOUNT_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('none')).not.toContain(HEADCOUNT_VALIDATION_CLAUSE)
  })
})
