import { describe, it, expect } from 'vitest'
import { BRAND_PROFILE } from '../brand/fresh-can'
import {
  composeSceneImagePrompt,
  composeCastRefPrompt,
  composePhotoPrompt,
  composeHeroPrompt,
} from './compose'
import { composeVideoScriptSystemPrompt } from './composeText'
import { buildImageValidationSystemPrompt, DRESS_ISSUE } from '../../adapters/openai'
import { isDressIssue, buildCorrectionInstruction } from '../../steps/video/generateSceneVisual'

const RULE = BRAND_PROFILE.dressRule!

describe('everyone is modestly dressed: rule in the brand file, prompts, planner and validator', () => {
  it('the brand owns the rule', () => {
    expect(RULE).toMatch(/modestly dressed in fully covering everyday clothes/)
    expect(RULE.length).toBeLessThan(80) // scene text must stay a meaningful share of the prompt
  })
  it('scene stills, cast portraits, photos and blog images all carry it', () => {
    const scene = composeSceneImagePrompt(BRAND_PROFILE, { pipelineId: 'p', sceneNumber: 1, visualDescription: 'A woman picks lemons', shotNotes: null, characterRefUrl: 'https://example.com/r.png', unitPresence: 'none' })
    expect(scene.prompt).toContain(RULE)
    expect(composeCastRefPrompt(BRAND_PROFILE, { id: 'a', wardrobe: 'navy cardigan, jeans' }).prompt).toContain(RULE)
    const photo = composePhotoPrompt(BRAND_PROFILE, { jobId: 'j', scene: 'A woman at a market', imageStyle: 'photorealistic' } as never)
    expect(photo.prompt).toContain(RULE)
    const hero = composeHeroPrompt(BRAND_PROFILE, { jobId: 'j', topic: 't', sceneNotes: 'a woman shopping' } as never)
    expect(hero.prompt).toContain(RULE)
  })
  it('the planner is told each outfit must follow it', () => {
    const planner = composeVideoScriptSystemPrompt(BRAND_PROFILE, { sceneNotes: 'x' } as never)
    expect(planner).toContain(RULE)
  })
  it('the validator flags clearly skimpy clothing as blocking, and not ordinary casual wear', () => {
    const v = buildImageValidationSystemPrompt('none', false)
    expect(v).toContain(DRESS_ISSUE)
    expect(v).toMatch(/Ordinary casual everyday clothes are NOT a defect/)
    expect(isDressIssue(DRESS_ISSUE)).toBe(true)
    expect(isDressIssue('skimpy outfit')).toBe(true)
    expect(isDressIssue('lamppost repeated')).toBe(false)
  })
  it('a dress rejection regenerates with a dress instruction', () => {
    expect(buildCorrectionInstruction([DRESS_ISSUE])).toMatch(/fully and modestly in ordinary everyday clothes/)
  })
})
