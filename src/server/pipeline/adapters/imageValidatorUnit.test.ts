import { describe, it, expect } from 'vitest'
import { buildImageValidationSystemPrompt, UNIT_STRUCTURE_VALIDATION_CLAUSE } from './openai'
import { isUnitDoorIssue, buildCorrectionInstruction } from '../steps/video/generateSceneVisual'

describe('unit-structure validation', () => {
  it('adds the truck clause only when the unit can appear', () => {
    const base = buildImageValidationSystemPrompt('none')
    expect(base).not.toContain(UNIT_STRUCTURE_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt(undefined)).toBe(base)
    expect(buildImageValidationSystemPrompt('featured')).toBe(base + UNIT_STRUCTURE_VALIDATION_CLAUSE)
    expect(buildImageValidationSystemPrompt('background')).toContain('ONE end face')
  })
  it('recognises the door issue and corrects with a positive rule', () => {
    const issue = "door or opening drawn on the container's side or plain end"
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

describe('container-only validator clause', () => {
  it('is angle-agnostic: flags truck/cab/wheels, accepts the one door end from any view', () => {
    const p = buildImageValidationSystemPrompt('featured')
    expect(p).toContain('truck, cab or wheels visible')
    expect(p).toContain('from any angle')
    expect(buildImageValidationSystemPrompt('none')).not.toContain('truck, cab or wheels visible')
  })
  it('a visible truck/cab/wheels finding gets a container-only correction', async () => {
    const { buildCorrectionInstruction, isUnitVehicleIssue } = await import('../steps/video/generateSceneVisual')
    expect(isUnitVehicleIssue('truck, cab or wheels visible')).toBe(true)
    expect(buildCorrectionInstruction(['truck, cab or wheels visible'])).toMatch(/no truck, cab,\s+wheels/)
  })
})

