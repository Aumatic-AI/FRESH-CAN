import { describe, it, expect } from 'vitest'
import { pickContainerCamera } from './containerCamera'
import { composeCharacterRefPrompt, composeSceneImagePrompt } from './compose'
import { BRAND_PROFILE } from '../brand/fresh-can'

describe('pickContainerCamera', () => {
  it('is stable for the same seed and scene (retries land on the same view)', () => {
    expect(pickContainerCamera('p1', 3)).toBe(pickContainerCamera('p1', 3))
  })
  it('gives consecutive scenes of one video different faces', () => {
    const faces = [1, 2, 3, 4, 5].map((n) => pickContainerCamera('pipeline-x', n).split(',')[0])
    expect(new Set(faces).size).toBe(5)
  })
  it('varies from video to video', () => {
    const views = new Set(Array.from({ length: 12 }, (_, i) => pickContainerCamera(`pipeline-${i}`, 1)))
    expect(views.size).toBeGreaterThan(3)
  })
  it("never produces the source photo's own view (door end with the wordmark side on its right) and never a vehicle", () => {
    for (let i = 0; i < 40; i++) {
      const c = pickContainerCamera(`p${i}`, i % 7)
      expect(c).not.toMatch(/wordmark side on its right|truck|cab|wheel/i)
      expect(c).toMatch(/door end|wordmark side|plain end/)
    }
  })
  it('can leave the distance out', () => {
    expect(pickContainerCamera('p', 1, { withDistance: false }).split(',')).toHaveLength(2)
  })
})

describe('character ref is a NEW view per video, not a copy', () => {
  it('asks for a camera view on plain neutral ground, scopes the brand photo as input only, and differs per pipeline', () => {
    const a = composeCharacterRefPrompt(BRAND_PROFILE, { pipelineId: 'video-a' })
    expect(a.referenceImageUrl).toBe(BRAND_PROFILE.referenceImages.exterior[0].url)
    expect(a.prompt).toContain('plain, neutral paved ground')
    expect(a.prompt).toContain('no buildings, trees or people')
    expect(a.prompt).toMatch(/Camera: .+\./)
    expect(a.prompt).toContain('does not dictate this image')
    expect(a.prompt).not.toContain('clean, well-lit reference photo')
    const prompts = new Set(Array.from({ length: 10 }, (_, i) => composeCharacterRefPrompt(BRAND_PROFILE, { pipelineId: `v${i}` }).prompt))
    expect(prompts.size).toBeGreaterThan(3)
  })
})

describe('exterior scenes: different camera per scene, same design', () => {
  const job = { pipelineId: 'vid-1', visualDescription: 'A woman holds her phone up beside the container', shotNotes: null, characterRefUrl: 'https://example.com/ref.png', unitPresence: 'featured' as const }
  it('two scenes of one video get different camera positions; the shot-notes angle is overridden', () => {
    const cam = (n: number) => /Camera position for the container: (.+?)\. This overrides/.exec(composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: n }).prompt)?.[1]
    expect(cam(5)).toBeTruthy()
    expect(cam(5)).not.toBe(cam(7))
  })
  it('a background container gets a position but no distance; an interior scene gets none', () => {
    const bg = composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: 2, unitPresence: 'background' }).prompt
    expect(/Camera position for the container: (.+?)\. This/.exec(bg)![1].split(',')).toHaveLength(2)
    expect(composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: 2, setting: 'interior' }).prompt).not.toContain('Camera position for the container')
  })
})
