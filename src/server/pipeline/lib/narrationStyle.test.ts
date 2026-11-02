import { describe, it, expect } from 'vitest'
import { findNarrationStyleIssues } from './narrationStyle'
import { writeNarration, narrationWordRange } from '../steps/video/localizeScript'
import { BRAND_PROFILE } from '../prompts/brand/fresh-can'
import { composeLocalizeScriptSystemPrompt } from '../prompts/index'
import { narrationWordCount } from '../../../lib/videoNarrationBudget'
import type { ScriptGenerator } from '../adapters/types'
import type { VideoSceneRow } from '../db'

const opts = { tells: BRAND_PROFILE.narrationTells, hardFacts: BRAND_PROFILE.narrationHardFacts }

// The real narration of job 7b18224d (the one that sounded machine-written).
const MECHANICAL = [
  'New home, first Thanksgiving hosting both families; an afternoon preparing their feast.',
  'One hour left. Both families coming. No fresh herbs, butter, cranberries. Their hearts sink.',
  "Fresh-CAN shows a nearby unit. Their account's ready, payment card linked.",
  "A short neighbourhood walk, then his app's QR code at the reader: access, not payment.",
  'Fresh herbs, butter, cranberries, close to home. Nothing needs scanning individually.',
  "Heading home, groceries sorted. Their card's charged automatically, without any checkout.",
  "The feast's ready as the doorbell rings. Less worry now, more room for being together.",
  'Plans change. Fresh-CAN keeps essentials close; family stories, laughter, and relieved smiles fill the table.',
].map((narration_text, i) => ({ scene_number: i + 1, narration_text }))

describe('findNarrationStyleIssues', () => {
  it('flags the machine-sounding narration of job 7b18224d (scene 3, the first mention of the mechanics, is allowed)', () => {
    const issues = findNarrationStyleIssues(MECHANICAL, opts)
    expect([...issues.keys()]).toEqual([1, 2, 4, 5, 6, 7, 8])
    expect(issues.get(1)!.join(' ')).toMatch(/semicolon/)
    expect(issues.get(2)!.join(' ')).toMatch(/hearts sink/)
    expect(issues.get(2)!.join(' ')).toMatch(/fragments|list/)
    // mechanics are covered once, then flagged where repeated
    expect(issues.has(3)).toBe(false)
    expect(issues.get(4)!.join(' ')).toMatch(/repeats payment|repeats the QR/)
    expect(issues.get(5)!.join(' ')).toMatch(/repeats the QR scan/)
    expect(issues.get(6)!.join(' ')).toMatch(/repeats payment/)
  })

  it('passes narration a person would actually say', () => {
    const human = [
      'It was their first Thanksgiving in the new house, and both families were on their way.',
      'Then he went pale. Nobody had bought butter, or herbs, or cranberries, and the clock said one hour.',
      'Luckily Fresh-CAN had a unit just around the corner, so they set off at a half-run.',
      'The doorbell rang as the last dish landed on the table, and the house filled with noise.',
    ].map((narration_text, i) => ({ scene_number: i + 1, narration_text }))
    expect([...findNarrationStyleIssues(human, opts).entries()]).toEqual([])
  })

  it('rejects first person and quoted dialogue, in English and French', () => {
    const issues = findNarrationStyleIssues(
      [
        { scene_number: 1, narration_text: 'We practically jogged there, and I was proud.' },
        { scene_number: 2, narration_text: 'He said "did we buy butter?" and went pale.' },
        { scene_number: 3, narration_text: 'Nous avons couru jusqu\'au bout de la rue.' },
        { scene_number: 4, narration_text: 'Elle sourit en voyant la table.' },
      ],
      opts,
    )
    expect(issues.get(1)!.join(' ')).toMatch(/I \/ we/)
    expect(issues.get(2)!.join(' ')).toMatch(/quotes dialogue/)
    expect(issues.get(3)!.join(' ')).toMatch(/I \/ we/)
    expect(issues.has(4)).toBe(false)
  })

  it('allows one "X, not Y" turn but flags a second', () => {
    const issues = findNarrationStyleIssues(
      [
        { scene_number: 1, narration_text: 'It was a quick trip, not a big one.' },
        { scene_number: 2, narration_text: 'She wanted comfort, not fuss, from the evening.' },
      ],
      opts,
    )
    expect(issues.has(1)).toBe(false)
    expect(issues.get(2)!.join(' ')).toMatch(/X, not Y/)
  })
})

describe('writeNarration style pass keeps the word band (audio/video sync)', () => {
  const row = (n: number): VideoSceneRow =>
    ({ id: `s${n}`, content_pipeline_id: 'p', generation: 1, scene_number: n, visual_description: 'v', shot_notes: null, narration_intent: { text: 'intent' }, target_duration_ms: 5000, created_at: '' }) as VideoSceneRow
  const range = narrationWordRange(5000, 2.65)
  const words = (n: number) => Array(n).fill('ok').join(' ')
  const inBand = (extra = '') => `${words(range.min + 2)}${extra}`

  const generatorReturning = (first: string, second: string): { gen: ScriptGenerator; calls: number } => {
    const state = { calls: 0 }
    const gen: ScriptGenerator = {
      async generate() {
        state.calls++
        return { parsed: { scenes: [{ scene_number: 1, narration_text: state.calls === 1 ? first : second }] }, raw: '' } as never
      },
    }
    return { gen, get calls() { return state.calls } } as never
  }

  it('keeps a clean rewrite that stays in the band', async () => {
    const bad = `${inBand()}; and the rest.`
    const good = words(range.min + 2) + '.'
    const g = generatorReturning(bad, good)
    const out = await writeNarration(g.gen, [row(1)], { language: 'English', wordsPerSecond: 2.65 })
    expect(out[0].narration_text).toBe(good)
  })

  it('discards a rewrite that fixes the style but leaves the band', async () => {
    const bad = `${inBand()}; and the rest.`
    const tooShort = 'Short and clean.'
    const g = generatorReturning(bad, tooShort)
    const out = await writeNarration(g.gen, [row(1)], { language: 'English', wordsPerSecond: 2.65 })
    expect(narrationWordCount(out[0].narration_text)).toBeGreaterThanOrEqual(range.min)
    expect(out[0].narration_text).not.toBe(tooShort)
  })
})

describe('narration prompt', () => {
  const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', wordsPerSecond: 2.65 })
  it('asks for one third-person storyteller, no dialogue, once-only mechanics, and lists the brand clichés', () => {
    expect(p).toContain('never say "I", "we", "our", "us"')
    expect(p).toContain('Never quote dialogue')
    expect(p).toContain('at most one scene of the whole video')
    expect(p).toContain('hearts sink')
    expect(p).toContain('NOTES on what to convey')
    expect(p).toContain('REGISTER: warm and clear')
    expect(p).toContain('at most ONE gentle figurative touch')
    expect(p).not.toContain('funny beat')
  })
})
