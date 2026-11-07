import { describe, expect, it } from 'vitest'
import { BRAND_PROFILE } from '../../prompts/index'
import { normalizeEnhancedPrompt as normalizeWithBrand } from './enhancePrompt'

const normalizeEnhancedPrompt = (parsed: unknown, idea: string) => normalizeWithBrand(parsed, idea, BRAND_PROFILE)

const pad = ' A slow push-in on a quiet street at golden hour, soft grain, one continuous camera drift.'.repeat(3)

const narrationPrompt =
  `Create a 30-second reel. Voiceover only: nobody on screen speaks and no mouth moves. A calm, warm female voice says: "Imagine a world without colour."${pad}`
const narration = {
  container_shown: 'none',
  audio_mode: 'narration',
  audio_reason: 'surreal film with creator voiceover',
  prompt: narrationPrompt,
  hook: 'colour drains',
  speakers: [],
  spoken_lines: [{ speaker: 'narrator', text: 'Imagine a world without colour.' }],
}

const dialoguePrompt =
  `Create a 30-second reel. The cook in the green apron faces the camera, mouth clearly visible, and says in a warm, cheerful voice, lip-synced: "Is that really fresh?" ` +
  `The shopper in the yellow coat smiles, mouth visible, and says in a calm voice, lip-synced: "Picked this morning."${pad}`
const dialogue = {
  container_shown: 'none',
  audio_mode: 'dialogue',
  audio_reason: 'two people talk',
  prompt: dialoguePrompt,
  hook: 'a question over the counter',
  speakers: [
    { label: 'the cook in the green apron', description: 'warm, cheerful' },
    { label: 'the shopper in the yellow coat', description: 'calm' },
  ],
  spoken_lines: [
    { speaker: 'the cook in the green apron', text: 'Is that really fresh?' },
    { speaker: 'the shopper in the yellow coat', text: 'Picked this morning.' },
  ],
}

describe('normalizeEnhancedPrompt: narration mode', () => {
  it('accepts a voiceover prompt and keeps the decision', () => {
    const r = normalizeEnhancedPrompt(narration, 'my idea')
    expect(r).toMatchObject({ audioMode: 'narration', speakers: [], originalIdea: 'my idea' })
    expect(typeof r).toBe('object')
  })
  it('tolerates plain-string lines (older cached shape) as narrator lines', () => {
    const r = normalizeEnhancedPrompt({ ...narration, spoken_lines: ['Imagine a world without colour.'] }, 'x')
    expect(r).toMatchObject({ spokenLines: [{ speaker: 'narrator', text: 'Imagine a world without colour.' }] })
  })
  it('rejects lip sync wording, a missing voiceover statement and non-narrator speakers', () => {
    expect(normalizeEnhancedPrompt({ ...narration, prompt: narrationPrompt + ' She speaks, lip-synced.' }, 'x')).toMatch(/lip sync/)
    expect(normalizeEnhancedPrompt({ ...narration, prompt: narrationPrompt.replace(/Voiceover only[^.]*\./, 'A voice says:') }, 'x')).toMatch(/voiceover/)
    expect(
      normalizeEnhancedPrompt({ ...narration, spoken_lines: [{ speaker: 'the cook', text: 'Imagine a world without colour.' }] }, 'x'),
    ).toMatch(/narrator/)
  })
})

describe('normalizeEnhancedPrompt: dialogue mode', () => {
  it('accepts two on-camera, lip-synced speakers', () => {
    const r = normalizeEnhancedPrompt(dialogue, 'x')
    expect(r).toMatchObject({ audioMode: 'dialogue' })
    expect(typeof r === 'object' && r.speakers).toHaveLength(2)
  })
  it('rejects missing lip sync, unknown speaker, too many speakers and an overlong line', () => {
    expect(normalizeEnhancedPrompt({ ...dialogue, prompt: dialoguePrompt.replace(/lip-synced/g, 'spoken') }, 'x')).toMatch(/lip-synced/)
    expect(
      normalizeEnhancedPrompt({ ...dialogue, spoken_lines: [{ speaker: 'someone else', text: 'Is that really fresh?' }] }, 'x'),
    ).toMatch(/not in speakers/)
    expect(
      normalizeEnhancedPrompt({ ...dialogue, speakers: [...dialogue.speakers, { label: 'a third', description: '' }] }, 'x'),
    ).toMatch(/at most 2/)
    const longLine = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'
    expect(
      normalizeEnhancedPrompt(
        {
          ...dialogue,
          prompt: dialoguePrompt + ` The cook says, lip-synced: "${longLine}"`,
          spoken_lines: [{ speaker: 'the cook in the green apron', text: longLine }],
        },
        'x',
      ),
    ).toMatch(/too long/)
  })
  it('rejects a speaker label that is never used in the prompt', () => {
    expect(
      normalizeEnhancedPrompt({ ...dialogue, speakers: [{ label: 'the mayor', description: '' }], spoken_lines: [{ speaker: 'the mayor', text: 'Is that really fresh?' }] }, 'x'),
    ).toMatch(/not used in the prompt/)
  })
})

describe('normalizeEnhancedPrompt: general checks', () => {
  it('rejects a bad mode, empty or missing lines, lines absent from the prompt, too many words, short, long and echoed prompts', () => {
    expect(normalizeEnhancedPrompt({ ...narration, audio_mode: 'both' }, 'x')).toMatch(/audio_mode/)
    expect(normalizeEnhancedPrompt({ ...narration, spoken_lines: [] }, 'x')).toMatch(/spoken_lines is empty/)
    expect(normalizeEnhancedPrompt({ ...narration, spoken_lines: [{ speaker: 'narrator', text: 'Not in the prompt at all.' }] }, 'x')).toMatch(/word for word/)
    const many = Array.from({ length: 81 }, (_, i) => `w${i}`).join(' ')
    expect(
      normalizeEnhancedPrompt({ ...narration, prompt: narrationPrompt + ` "${many}"`, spoken_lines: [{ speaker: 'narrator', text: many }] }, 'x'),
    ).toMatch(/too many spoken words/)
    expect(normalizeEnhancedPrompt({ ...narration, prompt: 'short' }, 'x')).toMatch(/too short/)
    expect(normalizeEnhancedPrompt({ ...narration, prompt: 'a'.repeat(5500) }, 'x')).toMatch(/too long/)
    expect(normalizeEnhancedPrompt({ ...narration }, narrationPrompt)).toMatch(/echoes/)
    expect(typeof normalizeEnhancedPrompt(null, 'x')).toBe('string')
  })
  it('matches a line despite curly quotes and case', () => {
    const r = normalizeEnhancedPrompt(
      { ...narration, prompt: narrationPrompt.replace('Imagine a world', 'IMAGINE a world').replace('"Imagine', '“Imagine').replace('colour."', 'colour.”') },
      'x',
    )
    expect(typeof r).toBe('object')
  })
})

describe('normalizeEnhancedPrompt: container reference images', () => {
  const withContainer = (shown: string, extra: string) => ({
    ...narration,
    container_shown: shown,
    prompt: narrationPrompt + extra,
  })
  const ext = BRAND_PROFILE.referenceImages.exterior.map((r) => r.url)
  const int = BRAND_PROFILE.referenceImages.interior.map((r) => r.url)

  it('attaches no photos when the container is not shown', () => {
    const r = normalizeEnhancedPrompt(narration, 'x')
    expect(r).toMatchObject({ containerShown: 'none', referenceImageUrls: [] })
  })
  it('attaches the exterior photos only, the interior photos only, or both (exterior first)', () => {
    const note = ' The container matches the attached reference images, as a design guide only.'
    expect(normalizeEnhancedPrompt(withContainer('exterior', note), 'x')).toMatchObject({ referenceImageUrls: ext })
    expect(normalizeEnhancedPrompt(withContainer('interior', note), 'x')).toMatchObject({ referenceImageUrls: int })
    expect(normalizeEnhancedPrompt(withContainer('both', note), 'x')).toMatchObject({ referenceImageUrls: [...ext, ...int] })
    expect(ext.length).toBeGreaterThan(0)
    expect(int.length).toBeGreaterThan(0)
  })
  it('rejects a shown container whose prompt never mentions the reference images', () => {
    expect(normalizeEnhancedPrompt(withContainer('exterior', ' The container sits on the ground.'), 'x')).toMatch(/reference images/)
  })
  it('rejects "none" when the prompt still mentions the container or reference images', () => {
    expect(normalizeEnhancedPrompt(withContainer('none', ' A shipping container stands behind her.'), 'x')).toMatch(/mentions the container/)
    expect(normalizeEnhancedPrompt(withContainer('none', ' Match the reference images.'), 'x')).toMatch(/reference images/)
  })
  it('rejects a missing or unknown container_shown', () => {
    expect(normalizeEnhancedPrompt({ ...narration, container_shown: undefined }, 'x')).toMatch(/container_shown/)
    expect(normalizeEnhancedPrompt({ ...narration, container_shown: 'roof' }, 'x')).toMatch(/container_shown/)
  })
})

describe('normalizeEnhancedPrompt: doorway relaxed, container arrival still forbidden', () => {
  const note = ' The container matches the attached reference images, as a design guide only.'
  const shown = (extra: string, lines = narration.spoken_lines) => ({
    ...narration,
    container_shown: 'both',
    prompt: narrationPrompt + note + extra,
    spoken_lines: lines,
  })

  it('allows people to go in and out, and the door to open and close (one flowing shot)', () => {
    for (const ok of [
      ' The shopper enters the container.',
      ' She steps inside the Fresh-CAN unit as the glass door opens.',
      ' He walks out of the container with a bag and the doors close behind him.',
    ]) {
      expect(typeof normalizeEnhancedPrompt(shown(ok), 'x')).toBe('object')
    }
  })
  it('allows spoken lines about going in and leaving', () => {
    const line = (text: string) => [{ speaker: 'narrator', text }]
    const p = (text: string) => ({ ...shown(` Voiceover says "${text}".`, line(text)) })
    expect(typeof normalizeEnhancedPrompt(p('She steps in, shops, and walks out with her bag.'), 'x')).toBe('object')
  })
  it('rejects the container itself arriving, driving, parking or being delivered', () => {
    expect(normalizeEnhancedPrompt(shown(' The container pulls up to the curb.'), 'x')).toMatch(/arriving, driving/)
    expect(normalizeEnhancedPrompt(shown(' The Fresh-CAN unit is delivered at dawn.'), 'x')).toMatch(/arriving, driving/)
  })
  it('does not apply the container-doorway checks when the container is not shown', () => {
    const r = normalizeEnhancedPrompt(
      { ...narration, spoken_lines: [{ speaker: 'narrator', text: 'Imagine a world without colour.' }] },
      'x',
    )
    expect(typeof r).toBe('object')
  })
})

describe('normalizeEnhancedPrompt: BOTH requires narration', () => {
  it('rejects dialogue when the clip is also released in French, accepts narration', () => {
    expect(normalizeWithBrand(dialogue, 'x', BRAND_PROFILE, { requireNarration: true })).toMatch(/narration/)
    expect(typeof normalizeWithBrand(narration, 'x', BRAND_PROFILE, { requireNarration: true })).toBe('object')
    expect(typeof normalizeWithBrand(dialogue, 'x', BRAND_PROFILE)).toBe('object')
  })
})

describe('prompt length cap', () => {
  it('accepts a long journey prompt that the old 3500 cap rejected, and tells the model how far over a too-long one is', () => {
    const ok = normalizeEnhancedPrompt({ ...narration, prompt: narration.prompt + ' x'.repeat(1500) }, 'x')
    expect(ok).toMatchObject({ audioMode: 'narration' })
    const bad = normalizeEnhancedPrompt({ ...narration, prompt: 'a'.repeat(5500) }, 'x')
    expect(bad).toMatch(/over the 3000 target/)
  })
})

import { promptRequestsMusic, withNoMusicClause } from './enhancePrompt'
import { SINGLE_SHOT_NO_MUSIC_CLAUSE } from '../../prompts/singleShot'

describe('no background music', () => {
  it('flags a request for music but allows negated mentions', () => {
    expect(promptRequestsMusic('A gentle musical mood with soft piano music.')).toBe(true)
    expect(promptRequestsMusic('Cinematic score swells at the end.')).toBe(true)
    expect(promptRequestsMusic('Ambient room tone. No background music, no musical score, no singing.')).toBe(false)
    expect(promptRequestsMusic('Footsteps and the door closing, without music.')).toBe(false)
  })
  it('rejects a prompt that asks for music', () => {
    const r = normalizeEnhancedPrompt({ ...narration, prompt: narration.prompt + ' A gentle musical mood underneath.' }, 'x')
    expect(r).toMatch(/music/)
  })
  it('appends the no-music clause when the model never said it, and keeps it once when it did', () => {
    const r = normalizeEnhancedPrompt({ ...narration }, 'x')
    expect(typeof r === 'object' && r.prompt).toContain(SINGLE_SHOT_NO_MUSIC_CLAUSE)
    expect(withNoMusicClause('Ambient sound only. No background music.')).toBe('Ambient sound only. No background music.')
  })
  it('applies the length cap after the clause is added', () => {
    const almost = 'a'.repeat(5000 - 10)
    expect(normalizeEnhancedPrompt({ ...narration, prompt: almost }, 'x')).toMatch(/too long/)
  })
})

describe('normalizeEnhancedPrompt: word limits and final narration', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
  const withLine = (text: string) => ({ ...narration, prompt: narrationPrompt + ` "${text}"`, spoken_lines: [{ speaker: 'narrator', text }] })

  it('allows 80 words for EN but only 70 for BOTH (French runs longer in the same slots)', () => {
    expect(typeof normalizeWithBrand(withLine(words(80)), 'x', BRAND_PROFILE, { language: 'EN' })).toBe('object')
    expect(normalizeWithBrand(withLine(words(75)), 'x', BRAND_PROFILE, { language: 'BOTH', requireNarration: true })).toMatch(/too many spoken words \(75, max 70\)/)
  })

  it('requires the spoken lines to be exactly the final narration, in order', () => {
    const locked = ['Imagine a world without colour.']
    expect(typeof normalizeWithBrand(narration, 'x', BRAND_PROFILE, { lockedLines: locked })).toBe('object')
    expect(normalizeWithBrand(narration, 'x', BRAND_PROFILE, { lockedLines: ['Something else entirely here.'] })).toMatch(/exactly the final narration/)
  })

  it('does not apply the word cap to final narration (it was already checked) but still demands narration mode', () => {
    expect(typeof normalizeWithBrand(withLine(words(90)), 'x', BRAND_PROFILE, { lockedLines: [words(90)] })).toBe('object')
  })
})
