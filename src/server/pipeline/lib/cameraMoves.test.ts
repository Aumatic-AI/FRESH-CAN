import { describe, it, expect, vi, afterEach } from 'vitest'
import { cameraMovesEnabled, mentionsCameraMove } from './cameraMoves'
import { lintClipMotion } from './clipMotion'
import { composeSceneVideoPrompt, composeVideoScriptSystemPrompt, BRAND_PROFILE } from '../prompts/index'
import { CLIP_MOTION_SYSTEM_PROMPT, CLIP_MOTION_SYSTEM_PROMPT_MOVING, OpenAIClipMotionWriter, buildImageValidationSystemPrompt, REFERENCE_MATCH_ISSUE, POSED_PEOPLE_ISSUE } from '../adapters/openai'
import { lockSceneCamera } from '../steps/video/generateScript'
import { buildCorrectionInstruction, isReferenceMismatchIssue, isPosedPeopleIssue, referenceUrlsForValidation } from '../steps/video/generateSceneVisual'

afterEach(() => vi.unstubAllEnvs())

describe('camera freedom switch', () => {
  it('is on by default and off only with CAMERA_MOVES=off', () => {
    expect(cameraMovesEnabled()).toBe(true)
    vi.stubEnv('CAMERA_MOVES', 'off')
    expect(cameraMovesEnabled()).toBe(false)
  })

  it('detects camera-move wording', () => {
    expect(mentionsCameraMove('slow push-in on her face')).toBe(true)
    expect(mentionsCameraMove('gentle handheld drift')).toBe(true)
    expect(mentionsCameraMove('static medium close-up')).toBe(false)
    expect(mentionsCameraMove(null)).toBe(false)
  })
})

describe('planner prompt', () => {
  const opts = { category: 'c', scriptType: 'SOLUTION', targetDurationSeconds: 36, sceneNotes: 'idea' }
  it('allows a named, slow, short move when moves are on; keeps the old rule when off', () => {
    const on = composeVideoScriptSystemPrompt(BRAND_PROFILE, { ...opts, cameraMoves: true })
    expect(on).toContain('Add ONE camera move when the moment calls for it')
    expect(on).toContain('Never an orbit around a face, a whip pan')
    expect(on).not.toContain('THE CAMERA NEVER MOVES')
    const off = composeVideoScriptSystemPrompt(BRAND_PROFILE, { ...opts, cameraMoves: false })
    expect(off).toContain('THE CAMERA NEVER MOVES')
  })
})

describe('lockSceneCamera', () => {
  const scene = { scene_number: 1, visual_description: 'v', shot_notes: 'slow push-in on her face', narration_intent: 'n', target_duration_seconds: 4, cast_present: ['a'] } as never
  it('leaves camera moves alone when moves are on, rewrites them when off', () => {
    expect(lockSceneCamera(scene)).toBe(scene)
    vi.stubEnv('CAMERA_MOVES', 'off')
    expect((lockSceneCamera(scene) as { shot_notes: string }).shot_notes).not.toMatch(/push-in/)
  })
})

describe('clip motion lint', () => {
  const ok = 'Over five seconds, the camera eases in slowly as she lifts the lemon and smiles. Everything else holds still.'
  it('accepts a slow move when moves are on; rejects any move when locked off', () => {
    expect(lintClipMotion(ok.replace('eases in slowly', 'does a slow push-in'), { cameraMoves: true })).not.toBeNull()
    expect(lintClipMotion('A slow push-in as she lifts the lemon and smiles warmly.', { cameraMoves: false })).toBeNull()
  })
  it('still rejects the moves that break the video model, even when moves are on', () => {
    for (const bad of ['The camera does a 360 orbit around her as she smiles warmly.', 'A whip pan to the shelf as she reaches out.', 'A crash zoom on her face as she smiles warmly.', 'The camera does a fly-through of the doorway as she waits.']) {
      expect(lintClipMotion(bad, { cameraMoves: true }), bad).toBeNull()
    }
  })
  it('rejects a container that drives, arrives or parks, in both modes', () => {
    for (const m of [true, false]) expect(lintClipMotion('The container slowly pulls up and parks at the kerb as wind moves the leaves.', { cameraMoves: m })).toBeNull()
  })
})

describe('clip prompts', () => {
  const base = { visualDescription: 'A woman holds a lemon.', shotNotes: 'slow push-in' }
  it('moving: no locked-off wording, background kept consistent; static retry restores it', () => {
    const moving = composeSceneVideoPrompt({ ...base, motion: 'Slow push-in as she lifts the lemon.' })
    expect(moving).not.toContain('Locked-off')
    expect(moving).toContain('single slow, smooth move')
    expect(composeSceneVideoPrompt({ ...base, motion: 'x', forceStaticCamera: true })).toContain('Locked-off, static camera')
    const fb = composeSceneVideoPrompt(base)
    expect(fb).not.toContain('Locked-off')
    expect(composeSceneVideoPrompt({ ...base, forceStaticCamera: true })).toContain('Locked-off, static camera')
  })
  it('motion writer prompt switches with the flag', async () => {
    const calls: string[] = []
    const fetchImpl = (async (_u: string, init?: RequestInit) => {
      calls.push(JSON.parse(init!.body as string).messages[0].content)
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'x' } }] }), text: async () => '' }
    }) as unknown as typeof fetch
    const w = new OpenAIClipMotionWriter('k', fetchImpl)
    const input = { stillUrl: 'u', visualDescription: 'v', durationSeconds: 5 }
    await w.write({ ...input, cameraMoves: true })
    await w.write({ ...input, cameraMoves: false })
    expect(calls).toEqual([CLIP_MOTION_SYSTEM_PROMPT_MOVING, CLIP_MOTION_SYSTEM_PROMPT])
  })
})

describe('reference-compared still check', () => {
  it('adds the reference clause only when references are attached, and judges design not angle', () => {
    expect(buildImageValidationSystemPrompt('featured', false)).not.toContain(REFERENCE_MATCH_ISSUE)
    const p = buildImageValidationSystemPrompt('none', true)
    expect(p).toContain(REFERENCE_MATCH_ISSUE)
    expect(p).toContain('must NOT be reported')
  })
  it('picks the right real photos per scene and corrects a mismatch with a positive rule', () => {
    expect(referenceUrlsForValidation({ unit_presence: 'none' })).toBeUndefined()
    expect(referenceUrlsForValidation({ unit_presence: 'featured', setting: 'exterior' })).toEqual([BRAND_PROFILE.referenceImages.exterior[0].url])
    expect(referenceUrlsForValidation({ unit_presence: 'background', setting: 'interior' })).toEqual(BRAND_PROFILE.referenceImages.interior.map((r) => r.url))
    expect(isReferenceMismatchIssue(REFERENCE_MATCH_ISSUE)).toBe(true)
    expect(buildCorrectionInstruction([REFERENCE_MATCH_ISSUE])).toMatch(/Match the real reference design exactly/)
  })
})


describe('purposeful action instead of posing', () => {
  it('planner asks for mid-action people and at most one to-camera scene', () => {
    const p = composeVideoScriptSystemPrompt(BRAND_PROFILE, { category: 'c', scriptType: 'SOLUTION', targetDurationSeconds: 36, sceneNotes: 'idea' })
    expect(p).toContain('caught IN THE MIDDLE of a purposeful action')
    expect(p).toContain('at most one scene of the whole video may have a person looking straight into the lens')
  })
  it('both motion-writer prompts ask for purposeful task actions, not posing or smiling at the camera', () => {
    for (const p of [CLIP_MOTION_SYSTEM_PROMPT, CLIP_MOTION_SYSTEM_PROMPT_MOVING]) {
      expect(p).toContain('purposeful actions')
      expect(p).toContain('never idle posing')
      expect(p).not.toContain('a head turn, a step, a breath, a smile)')
    }
  })
  it('the still check blocks only an all-people-idle, all-looking-at-lens image and retries with a positive instruction', () => {
    expect(buildImageValidationSystemPrompt('none')).toContain(POSED_PEOPLE_ISSUE)
    expect(buildImageValidationSystemPrompt('none')).toContain('is NOT a defect')
    expect(isPosedPeopleIssue(POSED_PEOPLE_ISSUE)).toBe(true)
    expect(buildCorrectionInstruction([POSED_PEOPLE_ISSUE])).toMatch(/mid-action/)
  })
})
