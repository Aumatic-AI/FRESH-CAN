import { describe, it, expect } from 'vitest'
import * as sceneVisual from './generateSceneVisual'
import { composeSceneVideoPrompt } from '../../prompts/core/compose'

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
