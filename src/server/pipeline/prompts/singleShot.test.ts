import { describe, expect, it } from 'vitest'
import { BRAND_PROFILE } from './index'
import {
  composeSingleShotSystemPrompt,
  composeSingleShotUserPrompt,
  SINGLE_SHOT_DURATION_SECONDS,
  SINGLE_SHOT_PROMPT_MAX_CHARS,
  pickContainerReferenceUrls,
} from './singleShot'

describe('single-shot prompt instructions', () => {
  const system = composeSingleShotSystemPrompt(BRAND_PROFILE)

  it('names the brand, the 30s length, the hook and the JSON shape', () => {
    expect(system).toContain(BRAND_PROFILE.name)
    expect(system).toContain(`${SINGLE_SHOT_DURATION_SECONDS}-second`)
    expect(system).toMatch(/HOOK/)
    expect(system).toMatch(/"prompt"/)
    expect(system).toContain(String(SINGLE_SHOT_PROMPT_MAX_CHARS))
  })

  it('asks for one continuous shot with native sound and no on-screen text', () => {
    expect(system).toMatch(/ONE continuous shot/)
    expect(system).toMatch(/SOUND/)
    expect(system).toMatch(/no on-screen text/i)
  })

  it('makes the AI choose narration or dialogue and spells out each convention', () => {
    expect(system).toMatch(/"narration"/)
    expect(system).toMatch(/"dialogue"/)
    expect(system).toMatch(/Voiceover only: nobody on screen speaks/)
    expect(system).toMatch(/lip-synced/)
    expect(system).toMatch(/audio_mode/)
    expect(system).toMatch(/never mix/i)
  })

  it('makes the AI decide whether the container is shown, and ties the photos to that decision', () => {
    expect(system).toMatch(/container_shown/)
    expect(system).toMatch(/STEP 0/)
    expect(system).toMatch(/do NOT write the word "container"/)
    expect(system).toMatch(/design guide only/)
    expect(system).toContain(BRAND_PROFILE.unit.interior.slice(0, 40))
  })

  it('carries the relaxed doorway rule, the keep-every-beat journey rule, the arrival rule and the "both" rule', () => {
    expect(system).toMatch(/DOORWAY \(relaxed/)
    expect(system).toMatch(/door may open and close/)
    expect(system).toMatch(/keep EVERY beat in order/)
    expect(system).not.toMatch(/DOORWAY RULE \(strict/)
    expect(system).not.toMatch(/wholly outside OR wholly inside/)
    expect(system).not.toMatch(/Narration must never describe anyone entering, exiting/)
    expect(system).toMatch(/never arrives, drives, pulls up/)
    expect(system).toMatch(/choose "interior" or "both", never "exterior"/)
    expect(system).toMatch(/including a journey that starts outside/)
  })

  it('asks for 70-80 connected spoken words (EN) and adds no narration style rules', () => {
    expect(system).toMatch(/LENGTH: .*write 70-80 spoken words in total/)
    expect(system).not.toMatch(/CINEMATIC NARRATION|CONCRETE ENDING|FULLER NARRATION/)
    expect(system).not.toMatch(/imagery-led|callback|evocative/i)
  })

  it('has no unfilled template placeholders', () => {
    expect(system).not.toMatch(/\$\{|undefined/)
  })

  it('user prompt carries the idea, aspect ratio and length; falls back to the topic', () => {
    const u = composeSingleShotUserPrompt({ idea: ' a surreal film ', topic: 'T', category: 'C', targetAudience: 'A', aspectRatio: '9:16' })
    expect(u).toContain('Idea: a surreal film')
    expect(u).toContain('9:16')
    expect(u).toContain('30 seconds')
    expect(
      composeSingleShotUserPrompt({ idea: 'i', topic: 'T', category: 'C', targetAudience: 'A', aspectRatio: '9:16', previousProblem: 'too long' }),
    ).toContain('previous reply was rejected: too long')
    expect(composeSingleShotUserPrompt({ idea: '  ', topic: 'Fallback topic', category: 'C', targetAudience: 'A', aspectRatio: '1:1' })).toContain(
      'Idea: Fallback topic',
    )
  })
})

describe('pickContainerReferenceUrls', () => {
  const ext = BRAND_PROFILE.referenceImages.exterior.map((r) => r.url)
  const int = BRAND_PROFILE.referenceImages.interior.map((r) => r.url)
  it('returns nothing for none, one set for exterior/interior, both for both', () => {
    expect(pickContainerReferenceUrls(BRAND_PROFILE, 'none')).toEqual([])
    expect(pickContainerReferenceUrls(BRAND_PROFILE, 'exterior')).toEqual(ext)
    expect(pickContainerReferenceUrls(BRAND_PROFILE, 'interior')).toEqual(int)
    expect(pickContainerReferenceUrls(BRAND_PROFILE, 'both')).toEqual([...ext, ...int])
  })
  it('stays within Seedance\'s 30-image limit', () => {
    expect(pickContainerReferenceUrls(BRAND_PROFILE, 'both').length).toBeLessThanOrEqual(30)
  })
})

import { singleShotLanguageDirective } from './singleShot'
describe('single-shot language directive', () => {
  it('EN adds nothing; BOTH forces narration; FR asks for Canadian French lines', () => {
    expect(singleShotLanguageDirective('EN')).toBe('')
    expect(singleShotLanguageDirective('BOTH')).toMatch(/audio_mode MUST be "narration"/)
    expect(singleShotLanguageDirective('BOTH')).toMatch(/English AND in French/)
    expect(singleShotLanguageDirective('FR')).toMatch(/Canadian French/)
    expect(composeSingleShotSystemPrompt(BRAND_PROFILE, 'BOTH')).toContain('LANGUAGE:')
    expect(composeSingleShotSystemPrompt(BRAND_PROFILE)).not.toContain('LANGUAGE:')
  })
})

describe('final narration handed to the video prompt', () => {
  const lines = ['Fresh-CAN starts with a free app.', 'Then the door opens for you.']
  it('lists every line verbatim, in order, and forces narration mode', () => {
    const user = composeSingleShotUserPrompt({ idea: 'i', topic: 't', category: 'c', targetAudience: 'a', aspectRatio: '9:16', lockedNarration: lines })
    expect(user).toMatch(/narration is FINAL/)
    expect(user).toContain('1. "Fresh-CAN starts with a free app."')
    expect(user.indexOf('2. "Then the door')).toBeGreaterThan(user.indexOf('1. "Fresh-CAN'))
    expect(user).toMatch(/audio_mode must be "narration"/)
  })
  it('adds nothing when there is no final narration', () => {
    expect(composeSingleShotUserPrompt({ idea: 'i', topic: 't', category: 'c', targetAudience: 'a', aspectRatio: '9:16' })).not.toMatch(/FINAL/)
  })
  it('says BOTH max is 70 and EN is 80', () => {
    expect(composeSingleShotSystemPrompt(BRAND_PROFILE, 'BOTH')).toMatch(/no more than 70/)
    expect(composeSingleShotSystemPrompt(BRAND_PROFILE, 'EN')).toMatch(/no more than 80/)
  })
})
