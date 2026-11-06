import { describe, it, expect } from 'vitest'
import { normalizeCreativeTwist, TWIST_AXES } from './creativeTwist'

describe('normalizeCreativeTwist', () => {
  it('accepts a complete twist', () => {
    expect(normalizeCreativeTwist({ axis: 'macro', visual: ' A bee on a tomato. ', secondaryVisual: 'Dusk market.' })).toEqual({
      axis: 'macro',
      visual: 'A bee on a tomato.',
      secondaryVisual: 'Dusk market.',
    })
  })
  it('defaults a missing secondaryVisual to empty', () => {
    expect(normalizeCreativeTwist({ axis: 'a', visual: 'v' })?.secondaryVisual).toBe('')
  })
  it('rejects malformed or empty-visual input', () => {
    expect(normalizeCreativeTwist(null)).toBeNull()
    expect(normalizeCreativeTwist({ axis: 'a', visual: '  ' })).toBeNull()
    expect(normalizeCreativeTwist({ visual: 'v' })).toBeNull()
  })
  it('has axes to rotate through', () => {
    expect(TWIST_AXES.length).toBeGreaterThan(3)
  })
})

import { BRAND_PROFILE } from '../../prompts/brand/fresh-can'
import { composeCreativeTwistSystemPrompt, composePhotoPrompt, composeHeroPrompt, composeInlinePrompt } from '../../prompts/index'

const brief = {
  intent: 'promo', coreMessage: 'fresh food reaches you', audience: 'a', emotionalTone: 't', desiredResponse: 'd',
  unitRelevance: { value: 'none' as const, rationale: 'r' }, improvements: '', constraintsFromAdmin: '',
}

describe('creative twist prompts', () => {
  it('lists recent concepts to avoid and the banned default', () => {
    const p = composeCreativeTwistSystemPrompt(BRAND_PROFILE, { contentType: 'blog', recent: ['macro: a bee'], suggestedAxis: 'x' }, brief)
    expect(p).toContain('do NOT repeat')
    expect(p).toContain('macro: a bee')
    expect(p).toContain('baskets')
    expect(p).toContain('secondaryVisual')
  })
  it('folds the twist into photo and blog prompts, inline uses secondaryVisual', () => {
    const photo = composePhotoPrompt(BRAND_PROFILE, { pipelineId: 'p', topic: 't', category: 'c', scene: 's', twist: 'TWISTA' })
    expect(photo.prompt).toContain('TWISTA')
    const job = { pipelineId: 'p', topic: 't', category: 'c', twist: { visual: 'HEROV', secondaryVisual: 'INLINEV' } }
    expect(composeHeroPrompt(BRAND_PROFILE, job).prompt).toContain('HEROV')
    const inline = composeInlinePrompt(BRAND_PROFILE, job).prompt
    expect(inline).toContain('INLINEV')
    expect(inline).not.toContain('HEROV')
  })
})
