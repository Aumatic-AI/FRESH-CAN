import { describe, it, expect } from 'vitest'
import { findNarrationStyleIssues } from './narrationStyle'
import { BRAND_PROFILE } from '../prompts/brand/fresh-can'
import { composeLocalizeScriptSystemPrompt, composeNarrationReviewSystemPrompt } from '../prompts/index'

const opts = {
  vaguePhrases: BRAND_PROFILE.narrationVaguePhrases,
  tells: BRAND_PROFILE.narrationTells,
  hardFacts: BRAND_PROFILE.narrationHardFacts,
  openers: BRAND_PROFILE.narrationBannedOpeners,
  closers: BRAND_PROFILE.narrationBannedClosers,
  abstractNouns: BRAND_PROFILE.narrationAbstractNouns,
  brandName: BRAND_PROFILE.name,
}
const toScenes = (lines: string[]) => lines.map((narration_text, i) => ({ scene_number: i + 1, narration_text }))
const issuesFor = (lines: string[], extra = {}) => findNarrationStyleIssues(toScenes(lines), { ...opts, ...extra })

// The owner's liked reference direction (a style example, never a template), minus "no fuss", which is a banned word.
const REFERENCE = [
  "Breaking news, she's officially unavailable for unnecessary stress.",
  'The phone can wait, the evening has other plans.',
  "With Fresh-CAN just around the corner, getting something fresh is the easiest part of her evening.",
  'Strawberries? Absolutely, some choices make themselves.',
  'Grab what she loves, payment happens automatically, no checkout, no waiting.',
  'No plans, no deadlines, just her, a handful of strawberries and an evening that is finally hers.',
]

describe('conversational flow', () => {
  it('accepts the reference direction (witty, comma-joined, negation triplet is not a list)', () => {
    expect([...issuesFor(REFERENCE).entries()]).toEqual([])
  })

  it('flags "fuss", which the owner banned, even inside an otherwise good line', () => {
    const lines = [...REFERENCE]
    lines[4] = 'Grab what she loves, payment happens automatically, no checkout, no fuss.'
    expect(issuesFor(lines).get(5)!.join(' ')).toMatch(/fuss/)
  })

  it('flags a scene chopped into tiny sentences', () => {
    const lines = [...REFERENCE]
    lines[1] = 'She stops. The phone buzzes. She waits.'
    expect(issuesFor(lines).get(2)!.join(' ')).toMatch(/fragments|chopped/)
  })

  it('flags a stop-start video where most lines are tiny full-stop sentences', () => {
    const choppy = ['She is done. Phone down.', 'Evening starts. No rush.', 'The shop is near. Easy.', 'She picks fruit. Berries.', 'Home now. Quiet.', 'It is hers. Finally.']
    const issues = issuesFor(choppy)
    const joined = [...issues.values()].flat().join(' ')
    expect(joined).toMatch(/stop-start|chopped|fragments/)
  })

  it('does not punish a single short punchy line among longer ones', () => {
    const lines = ['She had one rule tonight, and it was no emails, no calls, nothing with a screen.', 'Done.', 'Then the evening opened up, slowly, the way a window does when someone finally pushes it.']
    expect([...issuesFor(lines).entries()]).toEqual([])
  })

  it('applies the same flow rules to French', () => {
    const fr = issuesFor(['Elle est partie. Vite. Sans rien.', 'Le soir est à elle, et le téléphone peut bien attendre.'])
    expect(fr.get(1)!.join(' ')).toMatch(/fragments|chopped/)
    expect(fr.has(2)).toBe(false)
  })
})

describe('generic advertising clichés', () => {
  it.each([
    'fuss', 'agenda', 'vibe', 'little moment', "life's little pleasures", 'main character energy', 'a whole new level',
    "it's the little things", 'more than just', 'because you deserve it', 'fresh feels', 'making memories',
  ])('flags the owner-listed phrase "%s" (brand data, not a code literal)', (phrase) => {
    expect(BRAND_PROFILE.narrationTells).toContain(phrase)
    const issues = issuesFor([`She says it is ${phrase}, and goes back to her tea.`, 'The phone can wait, the evening has other plans.'])
    expect(issues.get(1)!.join(' ')).toMatch(/stock phrase/)
  })

  it('catches inflections but not unrelated words', () => {
    expect(issuesFor(['The whole street has a good vibes thing going on.']).get(1)!.join(' ')).toMatch(/stock phrase/)
    expect(issuesFor(['The vibrant tomatoes glow on the sill.']).has(1)).toBe(false)
  })

  it('catches French clichés', () => {
    expect(issuesFor(['Un souper sans tracas, enfin.']).get(1)!.join(' ')).toMatch(/stock phrase/)
  })

  it('still rejects stock openers and slogan closers', () => {
    const issues = issuesFor(['Imagine a quiet evening at home.', 'She picks berries.', 'Fresh food, for everyone.'])
    expect(issues.get(1)!.join(' ')).toMatch(/stock opener/)
    expect(issues.get(3)!.join(' ')).toMatch(/slogan-like/)
  })
})

describe('describing the picture', () => {
  it('flags narration that only repeats what the scene shows, but not one that adds a thought', () => {
    const onScreen = new Map([[1, 'A woman picks strawberries from a glass-door fridge inside the narrow aisle and puts the strawberries in a paper bag']])
    const echo = findNarrationStyleIssues(toScenes(['She picks strawberries from the fridge in the aisle and puts strawberries in a bag.']), { ...opts, onScreen })
    expect(echo.get(1)!.join(' ')).toMatch(/repeats what the picture shows/)
    const adds = findNarrationStyleIssues(toScenes(['She is checking each one like a jeweller, because tonight the only deadline is dessert.']), { ...opts, onScreen })
    expect(adds.has(1)).toBe(false)
  })
})

describe('hook quality and word limits', () => {
  it('caps the spoken hook at 12 words when asked to', () => {
    const long = 'On a perfectly ordinary Tuesday evening she decided that nothing at all would spoil her mood.'
    expect(issuesFor([long, 'Next.'], { hookMaxWords: 12 }).get(1)!.join(' ')).toMatch(/past 12 words/)
    expect(issuesFor(['The phone can wait, the evening has other plans.', 'Next.'], { hookMaxWords: 12 }).has(1)).toBe(false)
  })
})

describe('endings and brand integration', () => {
  const body = ['The phone can wait, the evening has other plans.']
  it('flags an abstract or moral ending, accepts a concrete image', () => {
    expect(issuesFor([...body, 'And that is the true happiness of a quiet evening.']).get(2)!.join(' ')).toMatch(/abstract/)
    expect(issuesFor([...body, 'It reminds us what really matters.']).get(2)!.join(' ')).toMatch(/moral/)
    expect(issuesFor([...body, 'She eats the last strawberry on the balcony, stem and all.']).has(2)).toBe(false)
  })

  it('flags a second brand mention but allows one', () => {
    const once = issuesFor(['The phone can wait.', 'With Fresh-CAN around the corner, dinner is easy.', 'She eats the last strawberry.'])
    expect(once.size).toBe(0)
    const twice = issuesFor(['Fresh-CAN is around the corner, so dinner is easy.', 'She grabs berries, and Fresh-CAN does the rest.'])
    expect(twice.get(2)!.join(' ')).toMatch(/says Fresh-CAN again/)
  })
})

describe('shared prompt wiring', () => {
  const english = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', wordsPerSecond: 2.65 })
  it('asks for flowing, witty, specific narration and drops the old no-jokes register', () => {
    expect(english).toMatch(/FLOW/)
    expect(english).toMatch(/PERSONALITY/)
    expect(english).toMatch(/HOOK/)
    expect(english).not.toMatch(/never slang, banter, jokes/)
    expect(english).toMatch(/third-person|"he", "she", "they"/)
    expect(english).toMatch(/min_words/)
  })
  it('does not paste the reference lines into the prompt', () => {
    expect(english).not.toMatch(/unnecessary stress/)
    expect(english).not.toMatch(/some choices make themselves/)
  })
  it('sends the brand cliché list to the model', () => {
    expect(english).toMatch(/main character energy/)
  })
  it('keeps the story and its personality in French, not a literal translation', () => {
    const french = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, {
      language: 'French', wordsPerSecond: 2.4, spine: { insight: 'x', hook: 'y' },
    })
    expect(french).toMatch(/recreate the wit/)
    expect(french).toMatch(/no English idiom carried over/)
  })
  it('review judges flow, personality and brand fit', () => {
    const review = composeNarrationReviewSystemPrompt(BRAND_PROFILE)
    expect(review).toMatch(/FLOW/)
    expect(review).toMatch(/PERSONALITY/)
    expect(review).toMatch(/"brand_fit"/)
  })
})

describe('idea becomes a tweaked concept that drives the narration', () => {
  it('the planner is told to tweak the raw idea into a catchier concept, keeping constraints', async () => {
    const { composeVideoScriptSystemPrompt } = await import('../prompts/index')
    const p = composeVideoScriptSystemPrompt(BRAND_PROFILE, { sceneNotes: 'A dad and son buy apples.' } as never)
    expect(p).toMatch(/RAW MATERIAL/)
    expect(p).toMatch(/"concept"/)
    expect(p).toMatch(/explicitly required or ruled out/)
  })
  it('the concept reaches the narration spine and the narration prompt', async () => {
    const { narrationSpineFromStory } = await import('../steps/video/generateScript')
    const spine = narrationSpineFromStory({ concept: 'A dad bets his daughter she cannot shop alone.', hook: 'h' })
    expect(spine?.concept).toMatch(/bets his daughter/)
    const prompt = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', spine })
    expect(prompt).toMatch(/build everything around this\): A dad bets/)
  })
})

describe('regression: weak draft 4928a5e5 (mood piece, brand twice, flat lines)', () => {
  const draft = [
    "She's finished work, but her evening still wants one thing after another.",
    'She locks her phone before anything else can ask for her.',
    'Fresh-CAN is around the corner. She can decide what happens after.',
    "She knows this street, but usually she's hurrying somewhere else entirely.",
    'She chooses strawberries simply because she likes them. That can be the whole reason.',
    "Dinner still isn't sorted, but she's heading for the park anyway.",
    "Her day doesn't need another finished task to count. She's quite happy sitting here eating a strawberry.",
    'After Fresh-CAN, she watches the world pass, with a strawberry resting in her lap.',
  ]
  it('is caught for the repeated brand name, and for the vague filler lines', () => {
    const issues = issuesFor(draft)
    expect(issues.get(8)!.join(' ')).toMatch(/says Fresh-CAN again/)
    expect(issues.get(5)!.join(' ')).toMatch(/vague/)
    expect(issues.get(7)!.join(' ')).toMatch(/vague/)
  })
})
