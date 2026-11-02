import { describe, it, expect } from 'vitest'
import { findNarrationStyleIssues } from './narrationStyle'
import { planReviewRewrites, parseNarrationReview } from './narrationReview'
import { BRAND_PROFILE } from '../prompts/brand/fresh-can'
import { composeLocalizeScriptSystemPrompt, composeNarrationReviewSystemPrompt, composeVideoScriptSystemPrompt } from '../prompts/index'
import { narrationWordCount } from '../../../lib/videoNarrationBudget'

// Draft 556c357c: accurate but flat ("she picks up X, thinking Y" in every scene), reviewed 9/10 on everything.
const FLAT = [
  "Her tote's empty, and three meals need more than cupboard staples.",
  'At Fresh-CAN, she picks up an apple, already finding new uses for what\'s at home.',
  "Now she's looking forward to tomorrow's oats, with apple for a change.",
  'She chooses a carrot, already thinking beyond another lunch of plain beans.',
]
// The catchy rewrite of the same story: a hook with a count, relatable habit lines, a callback ending.
const CATCHY = [
  'Three meals, one empty tote, and a cupboard out of ideas.',
  "Fresh-CAN has the apples, and one of them already has plans for tomorrow's oats.",
  'Same old oats, now with a reason to get out of bed.',
  'Next, a carrot, because lunch has been beans, again, and everyone knows it.',
  'Grated into the beans, and suddenly lunch looks like it made an effort.',
  'And tomatoes, because pasta is the one dinner nobody argues about.',
  "Her daughter reaches for the bowl before it's even landed, which is how you know dinner worked.",
  'One full tote, three meals sorted, and a cupboard that finally has ideas again.',
]
const BANDS = [[11, 13], [14, 16], [11, 13], [11, 13], [11, 13], [11, 13], [16, 19], [14, 16]]
const scenes = (lines: string[]) => lines.map((narration_text, i) => ({ scene_number: i + 1, narration_text }))
const opts = {
  tells: BRAND_PROFILE.narrationTells, hardFacts: BRAND_PROFILE.narrationHardFacts, openers: BRAND_PROFILE.narrationBannedOpeners,
  closers: BRAND_PROFILE.narrationBannedClosers, abstractNouns: BRAND_PROFILE.narrationAbstractNouns,
  vaguePhrases: BRAND_PROFILE.narrationVaguePhrases, brandName: BRAND_PROFILE.name, hookMaxWords: 12,
}

describe('catchy-ad regression (draft 556c357c)', () => {
  it('the flat "she picks up X, already thinking Y" lines are flagged', () => {
    const issues = findNarrationStyleIssues(scenes(FLAT), opts)
    expect(issues.get(2)!.join(' ')).toMatch(/vague/)
    expect(issues.get(3)!.join(' ')).toMatch(/vague/)
    expect(issues.get(4)!.join(' ')).toMatch(/vague/)
  })
  it('the catchy rewrite is lint-clean, in every exact word band, brand once, third person', () => {
    expect([...findNarrationStyleIssues(scenes(CATCHY), opts).entries()]).toEqual([])
    CATCHY.forEach((l, i) => {
      const n = narrationWordCount(l)
      expect(n, `scene ${i + 1}`).toBeGreaterThanOrEqual(BANDS[i][0])
      expect(n, `scene ${i + 1}`).toBeLessThanOrEqual(BANDS[i][1])
    })
    expect(CATCHY.join(' ').match(/Fresh-CAN/g)).toHaveLength(1)
    expect(CATCHY.join(' ')).not.toMatch(/\b(?:I|we|our|us|my)\b/i)
  })
  it('the ending calls back to the hook (a payoff, not a summary)', () => {
    expect(CATCHY[0]).toMatch(/cupboard out of ideas/)
    expect(CATCHY[7]).toMatch(/cupboard that finally has ideas/)
  })
})

describe('the writer is given the ad craft, and the planner a spoken hook', () => {
  const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English' })
  it('narration prompt carries the catchy-ad rules from the knowledge base', () => {
    expect(p).toMatch(/CATCHY\./)
    expect(p).toMatch(/question about a small familiar annoyance/)
    expect(p).toMatch(/number promise/)
    expect(p).toMatch(/calling back|calls back|call(?:ing)? back/i)
    expect(p).toMatch(/Do not give every scene the same sentence shape/)
    expect(p).toMatch(/never "At Fresh-CAN, she\.\.\."/)
  })
  it('the planner records the SPOKEN hook line, not a picture description', () => {
    const planner = composeVideoScriptSystemPrompt(BRAND_PROFILE, { sceneNotes: 'x' } as never)
    expect(planner).toMatch(/the SPOKEN first line a viewer hears/)
    expect(planner).toMatch(/recorded in story\.hook as the SPOKEN first line itself/)
  })
})

describe('the review is strict and its low scores trigger a rewrite', () => {
  it('asks for strict scoring and treats flat lines as defects', () => {
    const r = composeNarrationReviewSystemPrompt(BRAND_PROFILE)
    expect(r).toMatch(/SCORE STRICTLY/)
    expect(r).toMatch(/A correct, ordinary line is a 5 or 6/)
    expect(r).toMatch(/share one sentence shape/)
    expect(r).toMatch(/count of things the video itself shows is not an invented fact/)
  })
  const review = (scores: Record<string, number>) =>
    parseNarrationReview({ scores, quotable: { present: true, scene: 7 }, auto_fail: [], scene_issues: [] }, [1, 2, 3, 4, 5, 6, 7, 8])!
  it('a weak hook or forgettable line becomes a rewrite note on the right scene', () => {
    const { notes } = planReviewRewrites(review({ hook: 5, memorable_line: 4 }), 8, 7, 1)
    expect(notes.get(1)!.join(' ')).toMatch(/sharpen the hook/)
    expect(notes.get(7)!.join(' ')).toMatch(/line a viewer would repeat/)
  })
  it('strong scores add nothing', () => {
    expect(planReviewRewrites(review({ hook: 8, memorable_line: 8 }), 8, 7, 1).notes.size).toBe(0)
  })
})
