import { describe, expect, it } from 'vitest'
import { BRAND_PROFILE } from '../../prompts/index'
import { applySingleShotEdits, readSingleShotDraft, spokenScript, type SingleShotDraft } from './updateSingleShot'

const pad = ' A slow push-in on a quiet street at golden hour, soft grain, one continuous camera drift.'.repeat(3)
const draft: SingleShotDraft = {
  prompt: `Create a 30-second reel. Voiceover only: nobody on screen speaks and no mouth moves. A calm, warm female voice says: "Imagine a world without colour." Then: "It comes back slowly."${pad}`,
  audio_mode: 'narration',
  audio_reason: 'surreal',
  hook: 'colour drains',
  speakers: [],
  spoken_lines: [
    { speaker: 'narrator', text: 'Imagine a world without colour.' },
    { speaker: 'narrator', text: 'It comes back slowly.' },
  ],
  container_shown: 'none',
  reference_image_urls: [],
  original_idea: 'my idea',
  aspect_ratio: '9:16',
}

describe('applySingleShotEdits', () => {
  it('edits a spoken line and swaps it inside the prompt', () => {
    const r = applySingleShotEdits(draft, { lines: ['Imagine a street without colour.', 'It comes back slowly.'] }, BRAND_PROFILE)
    if ('error' in r) throw new Error(r.error)
    expect(r.draft.spoken_lines[0].text).toBe('Imagine a street without colour.')
    expect(r.draft.prompt).toContain('"Imagine a street without colour."')
    expect(r.draft.prompt).not.toContain('a world without colour')
  })
  it('accepts a prompt-only edit that keeps every line verbatim', () => {
    const r = applySingleShotEdits(draft, { prompt: draft.prompt.replace('golden hour', 'blue hour') }, BRAND_PROFILE)
    expect('draft' in r && r.draft.prompt.includes('blue hour')).toBe(true)
  })
  it('rejects a prompt edit that drops a spoken line', () => {
    const r = applySingleShotEdits(draft, { prompt: draft.prompt.replace('"It comes back slowly."', 'Then it returns.') }, BRAND_PROFILE)
    expect(r).toMatchObject({ error: expect.stringContaining('not in the prompt word for word') })
  })
  it('rejects too many spoken words, blank lines and a wrong line count', () => {
    const long = Array(80).fill('word').join(' ')
    expect(applySingleShotEdits(draft, { lines: [long, 'It comes back slowly.'] }, BRAND_PROFILE)).toMatchObject({
      error: expect.stringContaining('too many spoken words'),
    })
    expect(applySingleShotEdits(draft, { lines: ['  ', 'x'] }, BRAND_PROFILE)).toHaveProperty('error')
    expect(applySingleShotEdits(draft, { lines: ['only one'] }, BRAND_PROFILE)).toHaveProperty('error')
  })
  it('still forbids the container arriving, but lets an edited line talk about going in', () => {
    const shown: SingleShotDraft = {
      ...draft,
      container_shown: 'exterior',
      reference_image_urls: BRAND_PROFILE.referenceImages.exterior.map((r) => r.url),
      prompt: draft.prompt + ' The container matches the attached reference images as a design guide only.',
    }
    const ok = applySingleShotEdits(shown, { lines: ['She walks in and shops.', 'It comes back slowly.'] }, BRAND_PROFILE)
    expect('draft' in ok).toBe(true)
    const bad = applySingleShotEdits({ ...shown, prompt: shown.prompt + ' The container pulls up to the curb.' }, { lines: [...shown.spoken_lines.map((l) => l.text)] }, BRAND_PROFILE)
    expect(bad).toMatchObject({ error: expect.stringContaining('arriving') })
  })
})

describe('French lines (BOTH)', () => {
  const both: SingleShotDraft = { ...draft, languages: 'BOTH', french_lines: ['Imagine un monde sans couleur.', 'Elle revient doucement.'] }
  it('keeps French lines through an English-only edit when they still fit', () => {
    const r = applySingleShotEdits(both, { prompt: both.prompt.replace('golden hour', 'blue hour') }, BRAND_PROFILE)
    expect('draft' in r && r.draft.french_lines).toEqual(both.french_lines)
  })
  it('saves edited French lines and rejects a wrong count or a line too long', () => {
    const ok = applySingleShotEdits(both, { frenchLines: ['Un monde sans couleur.', 'Elle revient.'] }, BRAND_PROFILE)
    expect('draft' in ok && ok.draft.french_lines).toEqual(['Un monde sans couleur.', 'Elle revient.'])
    expect(applySingleShotEdits(both, { frenchLines: ['une seule'] }, BRAND_PROFILE)).toHaveProperty('error')
    const long = Array(30).fill('mot').join(' ')
    expect(applySingleShotEdits(both, { frenchLines: [long, 'ok'] }, BRAND_PROFILE)).toMatchObject({ error: expect.stringContaining('French:') })
  })
  it('refuses French edits on a draft with no French track, and round-trips through the stored shape', () => {
    expect(applySingleShotEdits(draft, { frenchLines: ['a', 'b'] }, BRAND_PROFILE)).toMatchObject({ error: expect.stringContaining('no French track') })
    expect(readSingleShotDraft({ single_shot: both })).toMatchObject({ languages: 'BOTH', french_lines: both.french_lines })
    expect(readSingleShotDraft({ single_shot: draft })?.languages).toBe('EN')
  })
})

describe('draft helpers', () => {
  it('reads a stored draft and ignores scene-pipeline drafts', () => {
    expect(readSingleShotDraft({ single_shot: draft })?.prompt).toBe(draft.prompt)
    expect(readSingleShotDraft({ script: 'x', scenes: [] })).toBeNull()
    expect(readSingleShotDraft(null)).toBeNull()
  })
  it('joins spoken lines for the script summary', () => {
    expect(spokenScript(draft.spoken_lines)).toBe('Imagine a world without colour.\n\nIt comes back slowly.')
  })
})
