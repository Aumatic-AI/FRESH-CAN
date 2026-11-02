import { describe, it, expect } from 'vitest'
import { findNarrationStyleIssues, echoShare } from './narrationStyle'
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

describe('story-spine lints', () => {
  const brandOpts = {
    ...opts,
    openers: BRAND_PROFILE.narrationBannedOpeners,
    closers: BRAND_PROFILE.narrationBannedClosers,
  }
  const scenes = (...texts: string[]) => texts.map((narration_text, i) => ({ scene_number: i + 1, narration_text }))

  it('flags a stock opener on the first scene only', () => {
    const issues = findNarrationStyleIssues(scenes('Imagine a Sunday with no lemons.', 'Imagine that again.'), brandOpts)
    expect(issues.get(1)?.join(' ')).toContain('stock opener')
    expect(issues.get(2)).toBeUndefined()
  })

  it('flags a slogan-like closer on the last scene only', () => {
    const issues = findNarrationStyleIssues(scenes('Freshness delivered, to her door.', 'Fresh food, for everyone.'), brandOpts)
    expect(issues.get(1)).toBeUndefined()
    expect(issues.get(2)?.join(' ')).toContain('slogan-like')
  })

  it('caps the hook only when asked to', () => {
    const long = 'On a quiet Sunday morning her grandfather reached for the last lemon and found the bowl was empty.'
    expect(findNarrationStyleIssues(scenes(long), { ...brandOpts, hookMaxWords: 12 }).get(1)?.join(' ')).toContain('hook')
    expect(findNarrationStyleIssues(scenes(long), brandOpts).get(1)).toBeUndefined()
  })

  it('flags a line that only repeats the picture, and leaves one that adds a thought', () => {
    const picture = 'A grandfather holds a bright yellow lemon above a wooden kitchen counter beside a baking tin.'
    const onScreen = new Map([[1, picture]])
    const echo = 'The grandfather holds a yellow lemon above the wooden counter beside the baking tin.'
    const adds = 'He is thinking about the recipe his late wife always wrote in pencil and never once measured.'
    expect(echoShare(echo, picture)).toBeGreaterThanOrEqual(0.6)
    expect(echoShare(adds, picture)).toBeLessThan(0.6)
    expect(findNarrationStyleIssues(scenes(echo), { onScreen }).get(1)?.join(' ')).toContain('repeats what the picture shows')
    expect(findNarrationStyleIssues(scenes(adds), { onScreen }).get(1)).toBeUndefined()
  })

  it('does nothing extra without the spine options (older jobs)', () => {
    expect(findNarrationStyleIssues(scenes('Imagine this.', 'Fresh food, for everyone.'), opts).size).toBe(0)
  })
})

describe('writeNarration with a story spine', () => {
  const row = (extra: Record<string, unknown> = {}): VideoSceneRow =>
    ({
      id: 's1', content_pipeline_id: 'p1', generation: 1, scene_number: 1,
      visual_description: 'A girl scans a phone at a maroon container.', shot_notes: null,
      narration_intent: { text: 'She is proud to be trusted.', ...extra },
      target_duration_ms: 4000, created_at: '',
    }) as VideoSceneRow
  const fit = (n: number) => Array(n).fill('word').join(' ')
  const gen = (systemPrompts: string[], userPrompts: string[], text: string): ScriptGenerator => ({
    async generate(input) {
      systemPrompts.push(input.systemPrompt)
      userPrompts.push(input.userPrompt)
      return { parsed: { scenes: [{ scene_number: 1, narration_text: text }] }, raw: '' } as never
    },
  })
  const spine = { motif: 'the crayon chart', ending_image: 'a crown drawn on the chart', quotable: 'some Saturdays are the best ones' }

  it('puts the spine in the prompt and the scene role and adds in the request', async () => {
    const sys: string[] = []
    const usr: string[] = []
    const text = fit(narrationWordRange(4000).min)
    await writeNarration(gen(sys, usr, text), [row({ story_role: 'hook', adds: 'her pride' })], { language: 'English', wordsPerSecond: 2.65, spine })
    expect(sys[0]).toContain('STORY SPINE')
    expect(sys[0]).toContain('motif: the crayon chart')
    expect(JSON.parse(usr[0])[0]).toMatchObject({ story_role: 'hook', adds: 'her pride' })
  })

  it('is unchanged for a plan without a spine', async () => {
    const sys: string[] = []
    const usr: string[] = []
    const text = fit(narrationWordRange(4000).min)
    await writeNarration(gen(sys, usr, text), [row()], { language: 'English', wordsPerSecond: 2.65 })
    expect(sys[0]).not.toContain('STORY SPINE')
    expect(JSON.parse(usr[0])[0]).not.toHaveProperty('story_role')
    expect(JSON.parse(usr[0])[0]).not.toHaveProperty('adds')
  })

  const b15 = 'She reached for the last lemon on the shelf and found only the bowl, empty.'
  it('does not apply the 12-word hook cap when the first scene\'s band minimum is longer (a long opening scene)', async () => {
    const calls: string[] = []
    const g: ScriptGenerator = {
      async generate(input) {
        calls.push(input.userPrompt)
        const text = b15
        return { parsed: { scenes: [{ scene_number: 1, narration_text: text }] }, raw: '' } as never
      },
    }
    const longRow = { ...row(), target_duration_ms: 6000 } as VideoSceneRow
    expect(narrationWordRange(6000, 2.65).min).toBeGreaterThan(12)
    expect(narrationWordCount(b15)).toBeGreaterThanOrEqual(narrationWordRange(6000, 2.65).min)
    await writeNarration(g, [longRow], { language: 'English', wordsPerSecond: 2.65, spine })
    expect(calls).toHaveLength(1)
  })

})

describe('narration review (one call, at most one rewrite)', () => {
  const sceneRow = (n: number, text = 'She is proud.'): VideoSceneRow =>
    ({
      id: `s${n}`, content_pipeline_id: 'p1', generation: 1, scene_number: n,
      visual_description: n === 2 ? 'A crown is drawn on the fridge chart.' : 'A girl scans a phone at a maroon container.',
      shot_notes: null, narration_intent: { text, story_role: n === 1 ? 'hook' : 'close', adds: 'her pride' },
      target_duration_ms: 4000, created_at: '',
    }) as VideoSceneRow
  const scenes = [sceneRow(1), sceneRow(2)]
  const spine = { motif: 'the crayon chart', ending_image: 'a crown drawn on the chart', quotable_scene: 1 }
  // 4s at 2.65 wps -> band 10-11 words
  const line = (w: string) => w.split(' ').length
  const L1 = 'Saturday starts with a rumour that the best apple is near.'
  const L2_OLD = 'By evening the chart has gained one more small mark today.'
  const L2_GOOD = 'By evening, the crayon chart wears a small crown for winners.'
  expect(line(L1)).toBeGreaterThanOrEqual(10)

  function run(opts: { review: any; rewrite?: string; language?: 'English' | 'French'; spine?: typeof spine | undefined; reviewThrows?: boolean }) {
    const calls: { step?: string; user: string }[] = []
    let narrationCall = 0
    const g: ScriptGenerator = {
      async generate(input) {
        calls.push({ step: input.stepName, user: input.userPrompt })
        if (input.stepName === 'review_narration') {
          if (opts.reviewThrows) throw new Error('boom')
          return { parsed: opts.review, raw: '' } as never
        }
        narrationCall += 1
        const req = JSON.parse(input.userPrompt) as { scene_number: number }[]
        if (narrationCall === 1) {
          return { parsed: { scenes: [{ scene_number: 1, narration_text: L1 }, { scene_number: 2, narration_text: L2_OLD }] }, raw: '' } as never
        }
        return { parsed: { scenes: req.map((r) => ({ scene_number: r.scene_number, narration_text: opts.rewrite ?? L2_GOOD })) }, raw: '' } as never
      },
    }
    const records: any[] = []
    return writeNarration(g, scenes, {
      language: opts.language ?? 'English', wordsPerSecond: 2.65,
      spine: 'spine' in opts ? opts.spine : spine, review: true, onReview: (r) => records.push(r),
    }).then((out) => ({ out, calls, records }))
  }
  const flagScene2 = { scene_issues: [{ scene_number: 2, problem: 'only describes the picture', fix: 'add what she feels' }] }

  it('runs one review and one rewrite, and keeps a rewrite that passes every check', async () => {
    const { out, calls, records } = await run({ review: flagScene2 })
    expect(calls.filter((c) => c.step === 'review_narration')).toHaveLength(1)
    expect(calls.filter((c) => c.step === 'localize_script')).toHaveLength(2)
    expect(out.find((o) => o.scene_number === 2)?.narration_text).toBe(L2_GOOD)
    expect(records[0].rewritten).toEqual([2])
    expect(JSON.parse(calls[2].user)[0].rewrite_note).toContain('A reviewer found')
  })

  it('drops a rewrite that introduces a figure, or a vehicle word, and records it as kept', async () => {
    for (const bad of ['By evening the chart has gained 3 more small marks today.', 'By evening the truck wears a small crown for the winner.']) {
      const { out, records } = await run({ review: flagScene2, rewrite: bad })
      expect(out.find((o) => o.scene_number === 2)?.narration_text).toBe(L2_OLD)
      expect(records[0].kept_original).toEqual([2])
    }
  })

  it('sends the creator\'s idea to the reviewer', async () => {
    const calls: { step?: string; user: string }[] = []
    const g: ScriptGenerator = {
      async generate(input) {
        calls.push({ step: input.stepName, user: input.userPrompt })
        if (input.stepName === 'review_narration') return { parsed: {}, raw: '' } as never
        return { parsed: { scenes: [{ scene_number: 1, narration_text: L1 }, { scene_number: 2, narration_text: L2_OLD }] }, raw: '' } as never
      },
    }
    await writeNarration(g, scenes, { language: 'English', wordsPerSecond: 2.65, spine, review: true, sceneNotes: 'a nurse gets home at 7 am' })
    expect(JSON.parse(calls.find((c) => c.step === 'review_narration')!.user).creator_idea).toBe('a nurse gets home at 7 am')
  })

  it('a flag that quotes words not in the line (e.g. from the story plan) never triggers a rewrite; a real quote does', async () => {
    const phantom = { auto_fail: [{ scene_number: 2, kind: 'invented_fact', detail: 'x', quote: 'locally grown berries' }] }
    const a = await run({ review: phantom })
    expect(a.calls.filter((c) => c.step === 'localize_script')).toHaveLength(1)
    expect(a.records[0].auto_fail).toEqual([])
    const real = { auto_fail: [{ scene_number: 2, kind: 'invented_fact', detail: 'x', quote: 'one more small mark' }] }
    const b = await run({ review: real })
    expect(b.calls.filter((c) => c.step === 'localize_script')).toHaveLength(2)
    expect(b.records[0].rewritten).toEqual([2])
  })

  it('drops a rewrite that fits the word band worse', async () => {
    const { out } = await run({ review: flagScene2, rewrite: 'A crown.' })
    expect(out.find((o) => o.scene_number === 2)?.narration_text).toBe(L2_OLD)
  })

  it('does not rewrite when the final picture does not show the planned ending, and says so', async () => {
    const { calls, records } = await run({ review: { ending_image_in_final_visual: false, last_line_lands_on_ending: false } })
    expect(calls.filter((c) => c.step === 'localize_script')).toHaveLength(1)
    expect(records[0].ending_visual_mismatch).toBe(true)
  })

  it('makes no second call when the review finds nothing, and ignores an unreadable or failing review', async () => {
    const clean = await run({ review: {} })
    expect(clean.calls.filter((c) => c.step === 'localize_script')).toHaveLength(1)
    const unreadable = await run({ review: 'garbage' })
    expect(unreadable.records).toHaveLength(0)
    expect(unreadable.out.find((o) => o.scene_number === 2)?.narration_text).toBe(L2_OLD)
    const throws = await run({ review: {}, reviewThrows: true })
    expect(throws.out).toHaveLength(2)
  })

  it('never reviews without a spine', async () => {
    expect((await run({ review: flagScene2, spine: undefined })).calls.some((c) => c.step === 'review_narration')).toBe(false)
  })
})

describe('French narration with a story spine', () => {
  const frRow = (n: number): VideoSceneRow =>
    ({
      id: `s${n}`, content_pipeline_id: 'p1', generation: 1, scene_number: n,
      visual_description: n === 2 ? 'A crown is drawn on the fridge chart.' : 'A girl scans a phone at a maroon container.',
      shot_notes: null,
      narration_intent: { text: 'pride', story_role: n === 1 ? 'hook' : 'close', adds: 'her pride', narration: n === 1 ? 'Saturday starts with a rumour that the best apple is near.' : 'By evening, the crayon chart wears a small crown for winners.' },
      target_duration_ms: 4000, created_at: '',
    }) as VideoSceneRow
  const scenes = [frRow(1), frRow(2)]
  const spine = { motif: 'the crayon chart', ending_image: 'a crown drawn on the chart', quotable_scene: 1 }
  // 4s at 2.65 wps -> band 10-11 words
  const FR1 = 'Samedi commence par une rumeur, la meilleure pomme est tout près.'
  const FR2_OLD = 'Le soir venu, le tableau au crayon porte une petite couronne.'
  const FR2_GOOD = 'Au soir, le tableau de crayons arbore une couronne de gagnant.'
  const words = (t: string) => t.split(/\s+/).length

  function runFr(rewrite: string, review: unknown) {
    const calls: { step?: string; system: string; user: string }[] = []
    let n = 0
    const g: ScriptGenerator = {
      async generate(input) {
        calls.push({ step: input.stepName, system: input.systemPrompt, user: input.userPrompt })
        if (input.stepName === 'review_narration') return { parsed: review, raw: '' } as never
        n += 1
        const req = JSON.parse(input.userPrompt) as { scene_number: number }[]
        if (n === 1) return { parsed: { scenes: [{ scene_number: 1, narration_text: FR1 }, { scene_number: 2, narration_text: FR2_OLD }] }, raw: '' } as never
        return { parsed: { scenes: req.map((r) => ({ scene_number: r.scene_number, narration_text: rewrite })) }, raw: '' } as never
      },
    }
    const records: any[] = []
    return writeNarration(g, scenes, { language: 'French', wordsPerSecond: 2.65, spine, review: true, onReview: (r) => records.push(r) }).then((out) => ({ out, calls, records }))
  }
  const flag = { scene_issues: [{ scene_number: 2, problem: 'sounds like a translation', fix: 'say it the French way' }] }

  it('keeps the test lines inside the band', () => {
    for (const t of [FR1, FR2_OLD, FR2_GOOD]) {
      expect(words(t)).toBeGreaterThanOrEqual(narrationWordRange(4000, 2.65).min)
      expect(words(t)).toBeLessThanOrEqual(narrationWordRange(4000, 2.65).max)
    }
  })

  it('sends the spine and the French adaptation rules, and the English beside each French line to the reviewer', async () => {
    const { calls } = await runFr(FR2_GOOD, flag)
    expect(calls[0].system).toContain('STORY SPINE')
    expect(calls[0].system).toContain('Adapt the story, do not translate it word for word')
    const review = calls.find((c) => c.step === 'review_narration')!
    expect(review.system).toContain('FRENCH track')
    expect(review.system).toContain('mistranslation')
    const body = JSON.parse(review.user)
    expect(body.language).toBe('French')
    expect(body.scenes[1].english_narration).toContain('crayon chart')
    expect(body.scenes[1].narration_text).toBe(FR2_OLD)
  })

  it('keeps a French rewrite that passes every check', async () => {
    const { out, records } = await runFr(FR2_GOOD, flag)
    expect(out.find((o) => o.scene_number === 2)?.narration_text).toBe(FR2_GOOD)
    expect(records[0].rewritten).toEqual([2])
  })

  it('drops French rewrites with a French vehicle word, a new figure, or a first-person narrator', async () => {
    for (const bad of [
      'Au soir, le camion de crayons arbore une couronne de gagnant.',
      'Au soir, le tableau de crayons arbore 3 couronnes de gagnant.',
      'Au soir, notre tableau de crayons arbore une couronne de gagnant.',
    ]) {
      const { out, records } = await runFr(bad, flag)
      expect(out.find((o) => o.scene_number === 2)?.narration_text).toBe(FR2_OLD)
      expect(records[0].kept_original).toEqual([2])
    }
  })

  it('French opener, closer and first-person lints use the brand lists', () => {
    const o = { openers: BRAND_PROFILE.narrationBannedOpeners, closers: BRAND_PROFILE.narrationBannedClosers }
    const issues = findNarrationStyleIssues(
      [{ scene_number: 1, narration_text: 'Imaginez un samedi sans citrons.' }, { scene_number: 2, narration_text: 'Je pense à la fraîcheur livrée.' }],
      o,
    )
    expect(issues.get(1)?.join(' ')).toContain('stock opener')
    expect(issues.get(2)?.join(' ')).toContain('slogan-like')
    expect(issues.get(2)?.join(' ')).toContain('I / we / our')
  })

  it('a plan without a spine translates exactly as before: no spine block, no review', async () => {
    const calls: { step?: string; system: string }[] = []
    const g: ScriptGenerator = {
      async generate(input) {
        calls.push({ step: input.stepName, system: input.systemPrompt })
        return { parsed: { scenes: [{ scene_number: 1, narration_text: FR1 }, { scene_number: 2, narration_text: FR2_GOOD }] }, raw: '' } as never
      },
    }
    await writeNarration(g, scenes, { language: 'French', wordsPerSecond: 2.65 })
    expect(calls).toHaveLength(1)
    expect(calls[0].system).not.toContain('STORY SPINE')
    expect(calls[0].system).not.toContain('FRENCH. Adapt')
  })
})
