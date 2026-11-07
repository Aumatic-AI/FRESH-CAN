import { describe, expect, it, vi } from 'vitest'
import { BRAND_PROFILE } from '../../prompts/index'
import { narrationWordRange } from '../../prompts/singleShotNarration'
import { continuesPrevious, normalizeNarration, writeSingleShotNarration } from './writeNarration'

const db = vi.hoisted(() => ({ hasSucceededStep: vi.fn(), getLastSucceededStepOutput: vi.fn(), recordStepAttempt: vi.fn() }))
vi.mock('../../db', async (orig) => ({ ...(await orig<typeof import('../../db')>()), ...db }))

const beats = ['sign up once', 'scan the QR code', 'pick items', 'AI keeps the tally', 'card charged']
// 78 words, 7 lines, connected: connectors, repeated nouns, varied openers.
const good = [
  'Fresh-CAN starts with a free app, set up once with a card.',
  'Once that is done, your phone becomes the key at the door.',
  'Hold the app code to the white panel and the door opens.',
  'Then you lift what you need, from snacks to fresh salad.',
  'Cameras and AI follow every item you lift, so the tally builds.',
  'When you step outside, the linked card is charged automatically.',
  'So there is no queue and no checkout, just your groceries.',
]
const reply = (lines: string[], over: Record<string, unknown> = {}) => ({
  kind: 'narration',
  pace: 'brisk',
  pace_reason: 'many steps',
  beats,
  lines: lines.map((text, i) => ({ text, beat_index: Math.min(i, beats.length - 1) })),
  ...over,
})
const norm = (parsed: unknown, language: 'EN' | 'FR' | 'BOTH' = 'EN') => normalizeNarration(parsed, language, BRAND_PROFILE)

describe('narration word ranges', () => {
  it('brisk keeps the big script: EN/FR 70-80, BOTH 64-70 (the French voice runs longer in the same slots)', () => {
    expect(narrationWordRange('EN', 'brisk')).toEqual({ min: 70, max: 80 })
    expect(narrationWordRange('FR', 'brisk')).toEqual({ min: 70, max: 80 })
    expect(narrationWordRange('BOTH', 'brisk')).toEqual({ min: 64, max: 70 })
  })
  it('the narration is never under 60 words, at any pace or language', () => {
    for (const lang of ['EN', 'FR', 'BOTH'] as const) {
      for (const p of ['calm', 'balanced', 'brisk'] as const) {
        expect(narrationWordRange(lang, p).min).toBeGreaterThanOrEqual(60)
      }
    }
    expect(narrationWordRange('EN', 'calm')).toEqual({ min: 60, max: 72 })
    expect(narrationWordRange('BOTH', 'calm')).toEqual({ min: 60, max: 66 })
  })
  it('BOTH is never wider than EN at the same pace', () => {
    for (const p of ['calm', 'balanced', 'brisk'] as const) {
      expect(narrationWordRange('BOTH', p).max).toBeLessThanOrEqual(narrationWordRange('EN', p).max)
    }
  })
})

describe('pace: a calm idea calms the pictures, not the voice', () => {
  const calm = [
    'The container stays exactly where it is, quiet under the morning light.',
    'Then a shopper walks up, and the door opens for the app code.',
    'Once inside, she takes her time choosing what she needs.',
    'Cameras and AI keep the tally while she browses, so nothing is rushed.',
    'When she steps out, the linked card is charged without a word.',
    'Afterwards the container stays quiet, ready for whoever arrives next.',
  ]
  const calmReply = (lines: string[], over: Record<string, unknown> = {}) => ({
    kind: 'narration', pace: 'calm', pace_reason: 'a still, observational idea', beats: ['stands still', 'a shopper arrives', 'shops', 'tally', 'leaves and pays', 'stays'],
    lines: lines.map((text, i) => ({ text, beat_index: Math.min(i, 5) })), ...over,
  })
  it('accepts a calm idea with a full 60+ word voice', () => {
    expect(norm(calmReply(calm))).toMatchObject({ kind: 'lines', pace: 'calm' })
  })
  it('rejects a calm narration under 60 words (the voice is not thinned)', () => {
    const thin = [...calm.slice(0, 3), 'Cameras and AI keep the tally while she browses.', 'When she steps out, the linked card is charged.']
    expect(norm(calmReply(thin, { beats: ['a', 'b', 'c', 'd', 'e'] }))).toMatch(/too few spoken words for a calm narration \(\d+, need 60-72\)/)
  })
  it('rejects a script that is too big even for calm, so calm is not just brisk with a label', () => {
    expect(norm(reply(good, { pace: 'calm' }))).toMatch(/too many spoken words for a calm narration/)
  })
  it('requires a valid pace for narration', () => {
    expect(norm(reply(good, { pace: 'sprint' }))).toMatch(/pace must be/)
    expect(norm(reply(good, { pace: undefined }))).toMatch(/pace must be/)
  })
  it('keeps the pace on a skipped dialogue idea so the video prompt can follow it', () => {
    expect(norm({ kind: 'dialogue', pace: 'balanced', beats: [], lines: [] })).toMatchObject({ kind: 'skip', pace: 'balanced' })
  })
})

describe('normalizeNarration', () => {
  it('accepts a connected, detailed passage that covers every beat', () => {
    const r = norm(reply(good))
    expect(typeof r).toBe('object')
    expect(r).toMatchObject({ kind: 'lines', lines: good })
  })

  it('rejects a thin script under the minimum (the 56-word case)', () => {
    const thin = [
      'One strawberry begins a simple trip for everyday groceries.',
      'A basket fills with fresh choices and a few familiar favourites.',
      'Each small choice becomes part of a meal to share.',
      'At the door, the free app identifies each shopper with a QR code.',
      'Payment happens automatically through the linked card after leaving.',
      'Then, home for dinner.',
    ]
    expect(norm(reply(thin), 'EN')).toMatch(/too few spoken words|bare label|filler/)
  })

  it('rejects a bare label, a filler line and a line with no ending punctuation', () => {
    const l = (i: number, t: string) => good.map((x, j) => (j === i ? t : x))
    expect(norm(reply(l(6, 'Payment is automatic.')))).toMatch(/bare label/)
    expect(norm(reply(l(6, "It's that simple, and that is the whole point of it all.")))).toMatch(/filler/)
    expect(norm(reply(l(6, 'So there is no queue and no checkout, just your groceries')))).toMatch(/punctuation/)
  })

  it('rejects a missing beat', () => {
    const r = reply(good)
    ;(r.lines as { beat_index: number }[]).forEach((x) => { if (x.beat_index === 4) x.beat_index = 3 })
    expect(norm(r)).toMatch(/no line covers the beat/)
  })

  it('rejects separate captions: same opener twice in a row, or no linking between lines', () => {
    const same = good.map((t, i) => (i === 1 ? 'Fresh-CAN then makes the phone the key at the door for you.' : t))
    expect(norm(reply(same))).toMatch(/same word/)
    const captions = [
      'Registration takes about one minute on the free application today.',
      'Shoppers carry nothing except a phone in their coat pocket.',
      'Doors open after a quick scan of the panel outside.',
      'Cameras cover every aisle of the little shop inside it.',
      'Charges land on the saved card as people leave happily.',
      'Families enjoy fresh produce close to their own homes tonight.',
      'Neighbours appreciate dependable access whenever hunger strikes late at night.',
    ]
    expect(norm(reply(captions))).toMatch(/separate captions/)
  })

  it('rejects music words and a line that is too long', () => {
    expect(norm(reply(good.map((t, i) => (i === 0 ? 'Soft music plays while the free app is set up one time with a card linked.' : t))))).toMatch(/music/)
    expect(norm(reply(good.map((t, i) => (i === 3 ? `${t} ${t}` : t))))).toMatch(/line too long|too many/)
  })

  it('skips creator copy and dialogue ideas; BOTH can never be dialogue', () => {
    expect(norm({ kind: 'creator_copy', beats: [], lines: [] })).toMatchObject({ kind: 'skip' })
    expect(norm({ kind: 'dialogue', beats: [], lines: [] }, 'EN')).toMatchObject({ kind: 'skip' })
    expect(norm({ kind: 'dialogue', beats: [], lines: [] }, 'BOTH')).toMatch(/must be "narration"/)
  })
})

describe('continuesPrevious', () => {
  it('detects a connector opener or a repeated content word', () => {
    expect(continuesPrevious('The door opens.', 'Then the shopper walks in.')).toBe(true)
    expect(continuesPrevious('Cameras follow every item.', 'Each item adds to the tally.')).toBe(true)
    expect(continuesPrevious('The door opens wide.', 'Prices stay fair always.')).toBe(false)
  })
})

describe('writeSingleShotNarration', () => {
  const client = {} as never
  const gen = (parsed: unknown) => ({ generate: vi.fn(async () => ({ parsed })) }) as never

  it('retries with the rejection reason and returns the first valid reply', async () => {
    db.hasSucceededStep.mockResolvedValue(false)
    db.recordStepAttempt.mockResolvedValue(undefined)
    const generate = vi.fn().mockResolvedValueOnce({ parsed: reply(good.slice(0, 5)) }).mockResolvedValueOnce({ parsed: reply(good) })
    const r = await writeSingleShotNarration(client, 'p', 1, { generate } as never, BRAND_PROFILE, { idea: 'i', topic: 't', language: 'EN' })
    expect(r).toMatchObject({ kind: 'lines' })
    expect(generate).toHaveBeenCalledTimes(2)
    expect(generate.mock.calls[1][0].userPrompt).toMatch(/previous reply was rejected/)
  })

  it('reuses a cached result and makes no OpenAI call', async () => {
    db.hasSucceededStep.mockResolvedValue(true)
    db.getLastSucceededStepOutput.mockResolvedValue(reply(good))
    const g = gen(null)
    const r = await writeSingleShotNarration(client, 'p', 1, g, BRAND_PROFILE, { idea: 'i', topic: 't', language: 'EN' })
    expect(r).toMatchObject({ kind: 'lines' })
    expect((g as unknown as { generate: ReturnType<typeof vi.fn> }).generate).not.toHaveBeenCalled()
  })

  it('fails after three rejected attempts', async () => {
    db.hasSucceededStep.mockResolvedValue(false)
    await expect(writeSingleShotNarration(client, 'p', 1, gen({ kind: 'nope' }), BRAND_PROFILE, { idea: 'i', topic: 't', language: 'EN' })).rejects.toThrow(/failed after 3 attempts/)
  })
})
