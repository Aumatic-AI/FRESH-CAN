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

describe('several container references: dynamic scenes, never a copy of a photo', () => {
  it('the container photos name distinct camera faces, and a scene never picks its source photo\'s face', () => {
    const pool = BRAND_PROFILE.referenceImages.exterior
    const faces = pool.map((r) => r.cameraFace).filter(Boolean)
    expect(new Set(faces).size).toBe(faces.length)
    for (const r of pool) {
      for (let i = 0; i < 60; i++) {
        const c = pickContainerCamera(`vid${i}`, i % 9, { avoid: r.cameraFace as never })
        if (r.cameraFace === 'door-end-straight') expect(c).not.toMatch(/^straight-on to the door end/)
        if (r.cameraFace === 'long-side-straight') expect(c).not.toMatch(/^straight-on to the long wordmark side/)
        if (r.cameraFace === 'door-end-3q') expect(c).not.toMatch(/^a three-quarter view of the door end/)
      }
    }
  })
  it('scenes in one video draw different source photos and different cameras, and a retry is stable', () => {
    const job = { pipelineId: 'vid-x', visualDescription: 'A woman holds her phone beside the container', shotNotes: null, characterRefUrl: 'https://example.com/ref.png', unitPresence: 'featured' as const }
    const outs = Array.from({ length: 12 }, (_, i) => composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: i + 1 }))
    const sources = new Set(outs.map((o) => o.extraReferenceImageUrls![0]))
    expect(sources.size).toBeGreaterThanOrEqual(3)
    const cams = new Set(outs.map((o) => /Camera position for the container: (.+?)\. This/.exec(o.prompt)![1]))
    expect(cams.size).toBeGreaterThan(5)
    expect(composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: 5 }).prompt).toBe(outs[4].prompt)
  })
  it('every reference is described as a design guide only (never an angle, background or lighting)', () => {
    for (const r of BRAND_PROFILE.referenceImages.exterior) expect(r.whatItShows).toMatch(/never its angle|design guide only|only for the container's design/i)
    const out = composeSceneImagePrompt(BRAND_PROFILE, { pipelineId: 'v', sceneNumber: 2, visualDescription: 'x', shotNotes: null, characterRefUrl: 'https://example.com/r.png', unitPresence: 'featured' })
    expect(out.prompt).toMatch(/do not reuse either photo's angle, framing, background or people/)
  })
})

describe('the container is a new picture made from the references, never a copy', () => {
  const job = { pipelineId: 'vid-copy', visualDescription: 'A man holds his phone beside the container', shotNotes: null, characterRefUrl: 'https://example.com/ref.png', unitPresence: 'featured' as const }
  it('when the plan names no surroundings, code picks one per scene (stable, varied, never the reference backdrop)', async () => {
    const { pickContainerSurroundings } = await import('./containerCamera')
    const outs = Array.from({ length: 10 }, (_, i) => composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: i + 1 }))
    const places = new Set(outs.map((o) => /Surroundings: (.+?)\./.exec(o.prompt)?.[1]))
    expect(places.size).toBeGreaterThan(3)
    expect(composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: 4 }).prompt).toBe(outs[3].prompt)
    for (let i = 0; i < 30; i++) expect(pickContainerSurroundings(`v${i}`, i)).not.toMatch(/glass|office|plaza|skyline|[A-Z][a-z]+ Street/)
    // a planner-supplied setting still wins
    expect(composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: 2, sceneEnvironment: 'a snowy lane' } as never).prompt).toMatch(/Surroundings: a snowy lane\./)
  })
  it('the prompt forbids the reference\'s trees, buildings and paving as well as its angle', () => {
    expect(composeSceneImagePrompt(BRAND_PROFILE, { ...job, sceneNumber: 1 }).prompt).toMatch(/never its trees, buildings or paving/)
  })
  it('the validator sees every container photo and rejects a near-copy with a regeneration instruction', async () => {
    const { buildImageValidationSystemPrompt, REFERENCE_COPY_ISSUE } = await import('../../adapters/openai')
    const { isReferenceCopyIssue, buildCorrectionInstruction, referenceUrlsForValidation } = await import('../../steps/video/generateSceneVisual')
    expect(buildImageValidationSystemPrompt('featured', true)).toContain(REFERENCE_COPY_ISSUE)
    expect(buildImageValidationSystemPrompt('featured', false)).not.toContain(REFERENCE_COPY_ISSUE)
    expect(isReferenceCopyIssue(REFERENCE_COPY_ISSUE)).toBe(true)
    expect(buildCorrectionInstruction([REFERENCE_COPY_ISSUE])).toMatch(/NEW composition/)
    expect(referenceUrlsForValidation({ unit_presence: 'featured', setting: 'exterior' })).toHaveLength(4)
  })
})
