import { describe, it, expect } from 'vitest'
import { findNarrationStyleIssues, openersEcho, echoShare } from './narrationStyle'
import { writeNarration, narrationWordRange } from '../steps/video/localizeScript'
import { summarizeRecentStory, narrationSpineFromStory } from '../steps/video/generateScript'
import { firstSentence } from '../steps/video/draftNarration'
import { BRAND_PROFILE } from '../prompts/brand/fresh-can'
import { composeLocalizeScriptSystemPrompt, composeNarrationReviewSystemPrompt } from '../prompts/index'
import { narrationWordCount } from '../../../lib/videoNarrationBudget'
import type { ScriptGenerator } from '../adapters/types'
import type { VideoSceneRow } from '../db'

// The approved "to-do list vs strawberries" narration: a quality benchmark, never a template.
const BENCHMARK = [
  "The laptop's shut, but her to-do list is waiting up for her.",
  "Phone off, jacket on, and she's out before the list can object.",
  "No destination yet, but there's a Fresh-CAN nearby, and she's suddenly hungry.",
  "One scan, and that's the most anyone's asked of her all day.",
  'She grabs the strawberries first, as if someone else might have the same idea.',
  "Then the park, because the strawberries won't last the walk home.",
  'The first bite is so good she briefly forgets she has a to-do list, then remembers, and takes another.',
  "She's saving the last strawberry for the walk home, which is optimistic of her.",
]
const BANDS = [[11, 12], [11, 12], [11, 12], [11, 12], [13, 15], [11, 12], [16, 19], [13, 15]]
const BENCHMARK_FR = [
  "L'ordi est fermé, mais sa liste de choses à faire l'attend toujours.",
  'Téléphone éteint, manteau enfilé, et la voilà dehors avant que la liste proteste.',
  "Pas encore de destination, mais il y a un Fresh-CAN tout près, et soudain, elle a faim.",
  "Un scan, et c'est tout ce qu'on lui a demandé de la journée.",
  "Elle prend les fraises en premier, comme si quelqu'un d'autre pouvait avoir la même idée.",
  'Ensuite, le parc, parce que les fraises ne survivront pas à la marche jusqu’à la maison.',
  "À la première bouchée, elle oublie un instant sa liste de choses à faire, puis s'en souvient, et en reprend une.",
  'Elle garde la dernière fraise pour le retour, ce qui est bien optimiste de sa part.',
]
const ON_SCREEN = [
  'A woman is midway through snapping her laptop shut at her small desk, her black phone lighting up beside it with notifications.',
  'She presses the side button of her black phone, extinguishing its screen, while gathering the navy jacket from her chair.',
  'Already outdoors in her navy jacket she has briefly reopened her phone to find the unit.',
  'She holds her phone toward the exterior entry reader beside the shipping-container grocery unit.',
  'Wholly inside the store, she lifts a clear punnet of ripe strawberries from the chilled produce shelf.',
  'Already outside with her purchases in a plain paper bag, she walks toward the park.',
  'Seated on dry grass beneath the park tree, she raises a strawberry and takes a bite.',
  'In a wider view of the same tree, she rests against the trunk in her navy jacket.',
]

const brandOpts = {
  tells: BRAND_PROFILE.narrationTells,
  hardFacts: BRAND_PROFILE.narrationHardFacts,
  openers: BRAND_PROFILE.narrationBannedOpeners,
  closers: BRAND_PROFILE.narrationBannedClosers,
  abstractNouns: BRAND_PROFILE.narrationAbstractNouns,
  vaguePhrases: BRAND_PROFILE.narrationVaguePhrases,
  brandName: BRAND_PROFILE.name,
  hookMaxWords: 12,
}
const scenes = (lines: string[]) => lines.map((narration_text, i) => ({ scene_number: i + 1, narration_text }))

describe('regression: the approved benchmark narration stays clean', () => {
  it('has no style issues in English, with the picture-echo check on', () => {
    const onScreen = new Map(ON_SCREEN.map((t, i) => [i + 1, t] as const))
    expect([...findNarrationStyleIssues(scenes(BENCHMARK), { ...brandOpts, onScreen }).entries()]).toEqual([])
  })
  it('fits every exact word band', () => {
    BENCHMARK.forEach((line, i) => {
      const n = narrationWordCount(line)
      expect(n, `scene ${i + 1}`).toBeGreaterThanOrEqual(BANDS[i][0])
      expect(n, `scene ${i + 1}`).toBeLessThanOrEqual(BANDS[i][1])
    })
  })
  it('says the brand once and stays third person', () => {
    expect(BENCHMARK.join(' ').match(/Fresh-CAN/g)).toHaveLength(1)
    expect(BENCHMARK.join(' ')).not.toMatch(/\b(?:I|we|our|us|my)\b/i)
  })
  it('adds meaning beyond the picture (low overlap with what each scene shows)', () => {
    BENCHMARK.forEach((line, i) => expect(echoShare(line, ON_SCREEN[i]), `scene ${i + 1}`).toBeLessThan(0.5))
  })
  it('has the Canadian French adaptation clean too, one brand mention, third person', () => {
    expect([...findNarrationStyleIssues(scenes(BENCHMARK_FR), brandOpts).entries()]).toEqual([])
    expect(BENCHMARK_FR.join(' ').match(/Fresh-CAN/g)).toHaveLength(1)
  })
})

describe('regression: the weak draft patterns are all caught', () => {
  it.each([
    ['a stock opener', ['Imagine a quiet evening.', 'She picks berries.']],
    ['a moral ending', ['She picks berries and leaves.', 'It reminds us what really matters.']],
    ['an abstract ending', ['She picks berries and leaves.', 'And that is pure happiness.']],
    ['vague mood filler', ['She picks berries and leaves.', 'That can be the whole reason.']],
    ['a repeated brand', ['Fresh-CAN is close by.', 'She thanks Fresh-CAN and leaves.']],
  ])('flags %s', (_label, lines) => {
    expect(findNarrationStyleIssues(scenes(lines), brandOpts).size).toBeGreaterThan(0)
  })
})

describe('diversity: videos must not open or be planned the same way', () => {
  it('detects an echoed opening, in wording or in move', () => {
    expect(openersEcho("The laptop's shut, but her list is waiting.", "The laptop's shut, but his inbox keeps buzzing.")).toBe(true)
    expect(openersEcho('The kettle clicks off and nobody moves.', "The laptop's shut, but her list is waiting up.")).toBe(false)
  })
  it('flags a new video that opens like a recent one, and passes a different one', () => {
    const recent = ["The laptop's shut, but her to-do list is waiting up for her."]
    const same = findNarrationStyleIssues(scenes(["The laptop's shut, but his emails are waiting up for him.", 'He leaves.']), { recentOpeners: recent })
    expect(same.get(1)!.join(' ')).toMatch(/opens the same way/)
    const fresh = findNarrationStyleIssues(scenes(['Nobody told the kettle it was Saturday.', 'He leaves.']), { recentOpeners: recent })
    expect(fresh.has(1)).toBe(false)
  })
  it('puts recent openers and recent concepts in front of the writer and the planner', () => {
    const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', recentOpeners: ['A first line.'] })
    expect(p).toMatch(/Recent videos opened with these lines/)
    expect(p).toMatch(/"A first line\."/)
    const none = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English' })
    expect(none).not.toMatch(/Recent videos opened/)
    expect(summarizeRecentStory({ story: { concept: 'A bet with herself.', framework: 'small_quest', hook_type: 'question', motif: 'a lemon' } })).toMatch(/concept "A bet with herself\."/)
  })
  it('extracts a stored script\'s first sentence', () => {
    expect(firstSentence('One. Two. Three.')).toBe('One.')
    expect(firstSentence(undefined)).toBe('')
  })
})

describe('shared narration logic (English and French) carries the creative diagnosis', () => {
  const spine = narrationSpineFromStory({ concept: 'A list that waits up.', thread: 'the to-do list', insight: 'i', motif: 'strawberries' })
  it('passes concept and running thread into the spine and the prompt', () => {
    expect(spine?.thread).toBe('the to-do list')
    const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', spine })
    expect(p).toMatch(/running thread \(returns two or three times, never every scene\): the to-do list/)
    expect(p).toMatch(/restate them in plain spoken words/)
  })
  it('asks for a plan before the lines: three approaches, a choice, one continuous telling', () => {
    const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English' })
    expect(p).toMatch(/"plan": \{ "approaches"/)
    expect(p).toMatch(/three genuinely different ways to tell this story/)
    expect(p).toMatch(/read the whole thing aloud/)
    expect(p).toMatch(/each ' ?\+? ?line growing out of the one before it|growing out of the one before it/)
  })
  it('French asks for Canadian vocabulary and the same personality', () => {
    const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'French', spine })
    expect(p).toMatch(/Canadian vocabulary/)
    expect(p).toMatch(/faire l'épicerie/)
    expect(p).toMatch(/recreate the wit/)
  })
  it('the review checks continuity, repeated beats, flow and plain words', () => {
    const r = composeNarrationReviewSystemPrompt(BRAND_PROFILE)
    expect(r).toMatch(/CONTINUITY/)
    expect(r).toMatch(/same emotional beat/)
    expect(r).toMatch(/PLAIN WORDS/)
  })
})

describe('writeNarration with a mocked model (no paid calls)', () => {
  const seconds = [4, 4, 4, 4, 5, 4, 6, 5]
  const rows = seconds.map(
    (s, i) =>
      ({ id: `s${i}`, content_pipeline_id: 'p', generation: 1, scene_number: i + 1, visual_description: ON_SCREEN[i], shot_notes: null, narration_intent: { text: 'intent' }, target_duration_ms: s * 1000, created_at: '' }) as VideoSceneRow,
  )
  const rate = 3.03 // yields exactly the 11-12 / 13-15 / 16-19 bands of the real draft
  const generator = (answers: string[][]) => {
    const state = { calls: 0, prompts: [] as string[] }
    const gen: ScriptGenerator = {
      async generate(req: { userPrompt: string }) {
        const lines = answers[Math.min(state.calls, answers.length - 1)]
        state.calls++
        state.prompts.push(req.userPrompt)
        const requested = (JSON.parse(req.userPrompt) as { scene_number: number }[]).map((r) => r.scene_number)
        return {
          parsed: {
            plan: { approaches: ['a', 'b', 'c'], chosen: 'a', thread: 't' },
            scenes: requested.map((n) => ({ scene_number: n, narration_text: lines[n - 1] })),
          },
          raw: '',
        } as never
      },
    }
    return { gen, state }
  }

  it('accepts output that carries a plan and keeps a clean narration without any rewrite', async () => {
    const { gen, state } = generator([BENCHMARK])
    const out = await writeNarration(gen, rows, { language: 'English', wordsPerSecond: rate })
    expect(out.map((o) => o.narration_text)).toEqual(BENCHMARK)
    expect(state.calls, state.prompts[1]).toBe(1)
  })

  it('rewrites a repeated brand mention once and keeps the better line', async () => {
    const twice = [...BENCHMARK]
    twice[7] = 'After Fresh-CAN, she keeps one strawberry back for the walk home, very optimistically.'
    const { gen, state } = generator([twice, BENCHMARK])
    const out = await writeNarration(gen, rows, { language: 'English', wordsPerSecond: rate })
    expect(state.calls).toBeGreaterThan(1)
    expect(out[7].narration_text).toBe(BENCHMARK[7])
  })

  it('restyles the French track too, handing the model the approved English', async () => {
    const approved = rows.map((r, i) => ({ ...r, narration_intent: { text: 'intent', narration: BENCHMARK[i] } })) as VideoSceneRow[]
    const bad = [...BENCHMARK_FR]
    bad[0] = "L'ordi est fermé. Liste. Toujours là. Sans tracas."
    const { gen, state } = generator([bad, BENCHMARK_FR])
    await writeNarration(gen, approved, { language: 'French', wordsPerSecond: 2.6 })
    expect(state.calls).toBeGreaterThan(1)
    expect(state.prompts[1]).toMatch(/approved_english_narration/)
  })

  it('never hands the rate to the band: word bands stay what the voice rate says', () => {
    expect(narrationWordRange(4000, rate).min).toBeLessThanOrEqual(narrationWordRange(4000, rate).max)
  })
})
