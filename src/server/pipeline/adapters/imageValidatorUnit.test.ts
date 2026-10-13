import { describe, it, expect } from 'vitest'
import { buildImageValidationSystemPrompt, UNIT_STRUCTURE_VALIDATION_CLAUSE, REAR_VIEW_VALIDATION_CLAUSE } from './openai'
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

describe('rear-view validator clause', () => {
  it('is added only for a unit-present rear / rear34 scene', () => {
    const base = buildImageValidationSystemPrompt('featured')
    expect(buildImageValidationSystemPrompt('featured', 'rear')).toBe(base + REAR_VIEW_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('background', 'rear34')).toContain(REAR_VIEW_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('featured', 'side')).toBe(base)
    expect(buildImageValidationSystemPrompt('none', 'rear')).not.toContain(REAR_VIEW_VALIDATION_CLAUSE)
  })
})

