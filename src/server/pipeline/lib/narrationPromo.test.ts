import { describe, it, expect } from 'vitest'
import { findNarrationStyleIssues } from './narrationStyle'
import { BRAND_PROFILE } from '../prompts/brand/fresh-can'
import { composeLocalizeScriptSystemPrompt, composeNarrationReviewSystemPrompt, composeVideoScriptSystemPrompt } from '../prompts/index'
import { narrationSpineFromStory } from '../steps/video/generateScript'
import { narrationDescribesCrossing } from '../steps/video/localizeScript'
import { narrationWordCount } from '../../../lib/videoNarrationBudget'

// Promo voiceover for the "dodge the queue" idea (draft ddf3c3f7): direct address, brand once, no tech recital.
const PROMO = [
  'You know that moment you spot the queue and your feet vote to turn around before you do?',
  'Lucky for you, Fresh-CAN is right around the corner, stocked with fresh produce, no checkout line, and nobody making you stand and wait.',
  "Here, the only thing that gets your full attention is the tomato, and yes, you're allowed to inspect it like it owes you money.",
  "You wanted tomatoes, not a test of patience, and now the tote's full and the errand barely made a dent.",
  "So next time the queue makes your feet vote to turn around, you'll already know exactly where they're headed.",
]
const BANDS = [[16, 19], [22, 26], [22, 26], [19, 22], [19, 22]]
const scenes = (lines: string[]) => lines.map((narration_text, i) => ({ scene_number: i + 1, narration_text }))
const opts = {
  tells: BRAND_PROFILE.narrationTells, hardFacts: BRAND_PROFILE.narrationHardFacts, openers: BRAND_PROFILE.narrationBannedOpeners,
  closers: BRAND_PROFILE.narrationBannedClosers, abstractNouns: BRAND_PROFILE.narrationAbstractNouns,
  vaguePhrases: BRAND_PROFILE.narrationVaguePhrases, brandName: BRAND_PROFILE.name, promo: true,
}

describe('promo voice: direct address for product-led ideas', () => {
  it('the promo rewrite is lint-clean, in band, says the brand once, speaks to "you", never crosses the door', () => {
    expect([...findNarrationStyleIssues(scenes(PROMO), opts).entries()]).toEqual([])
    PROMO.forEach((l, i) => {
      const n = narrationWordCount(l)
      expect(n, `scene ${i + 1}`).toBeGreaterThanOrEqual(BANDS[i][0])
      expect(n, `scene ${i + 1}`).toBeLessThanOrEqual(BANDS[i][1])
      expect(narrationDescribesCrossing(l)).toBe(false)
    })
    expect(PROMO.join(' ').match(/Fresh-CAN/g)).toHaveLength(1)
    expect(PROMO.join(' ')).toMatch(/\byou\b/i)
    expect(PROMO.join(' ')).not.toMatch(/\b(?:I|we|our|us|my)\b/)
    expect(PROMO.join(' ')).not.toMatch(/\b(?:meet|imagine|introducing)\b/i)
  })

  it('the old mechanical draft is flagged in promo mode: it narrates the character', () => {
    const old = [
      'She will turn around before she will queue.',
      'Her familiar stop leaves time for choosing.',
      'She gives this one a proper inspection.',
      'She settles the tote on her shoulder and smiles.',
    ]
    const issues = findNarrationStyleIssues(scenes(old), opts)
    expect([...issues.values()].flat().join(' ')).toMatch(/narrates the character/)
    // the same lines in a third-person story are not judged that way
    expect([...findNarrationStyleIssues(scenes(old), { ...opts, promo: false }).values()].flat().join(' ')).not.toMatch(/narrates the character/)
  })

  it('the planner decides the voice from the idea, with no promo default', () => {
    const planner = composeVideoScriptSystemPrompt(BRAND_PROFILE, { sceneNotes: 'x' } as never)
    expect(planner).toMatch(/"voice": "promo" or "story"/)
    expect(planner).toMatch(/Choose the narration voice from the idea itself/)
    expect(planner).not.toMatch(/Default to "promo"/)
    expect(planner).toMatch(/convenience or errand gag/)
    expect(planner).toMatch(/Use "story" \(calm third person/)
    expect(planner).not.toMatch(/When unsure, choose "promo"/)
    expect(narrationSpineFromStory({ concept: 'c', voice: 'promo' })?.voice).toBe('promo')
    expect(narrationSpineFromStory({ concept: 'c', voice: 'story' })?.voice).toBe('story')
    expect(narrationSpineFromStory({ concept: 'c', voice: 'weird' })?.voice).toBeUndefined()
  })

  it('a promo prompt speaks to the viewer; a story prompt keeps the third-person rule', () => {
    const promo = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', spine: { concept: 'c', voice: 'promo' } })
    expect(promo).toMatch(/PROMO VOICE/)
    expect(promo).toMatch(/speak to the viewer as "you"/)
    expect(promo).toMatch(/never narrate what they are doing or feeling/)
    expect(promo).toMatch(/never an invented tagline/)
    expect(promo).not.toMatch(/only "he", "she", "they"/)
    expect(promo).toMatch(/never say "I", "we", "our", "us" or "my"/)
    const story = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', spine: { concept: 'c', voice: 'story' } })
    expect(story).not.toMatch(/PROMO VOICE\./)
    expect(story).toMatch(/only "he", "she", "they"/)
    const none = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English' })
    expect(none).toMatch(/only "he", "she", "they"/)
  })

  it('French promo uses casual "tu"; French story stays third person', () => {
    const fr = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'French', spine: { concept: 'c', voice: 'promo' } })
    expect(fr).toMatch(/"tu" and "ton\/ta\/tes"/)
    const frStory = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'French', spine: { concept: 'c', voice: 'story' } })
    expect(frStory).toMatch(/third person \(il, elle, ils/)
  })

  it('the review accepts second person for a promo and judges it as direct-address copy', () => {
    const r = composeNarrationReviewSystemPrompt(BRAND_PROFILE, { voice: 'promo' })
    expect(r).toMatch(/second person is correct/)
    expect(r).toMatch(/invented tagline are defects/)
    expect(composeNarrationReviewSystemPrompt(BRAND_PROFILE)).not.toMatch(/PROMO voice/)
  })
})

describe('a line that only repeats the picture is caught even when one sentence of it is the echo (draft cd6804ac)', () => {
  const onScreen = new Map([[5, 'He is already outside with his groceries and slips his folded paper shopping list into his jacket pocket.']])
  it('flags the closing description, passes a line that adds something', () => {
    const bad = findNarrationStyleIssues(scenes(["His list is finished, but his afternoon's still free. He tucks the folded paper into his jacket pocket."].map((t) => t)).map((s) => ({ ...s, scene_number: 5 })), { ...opts, promo: false, onScreen })
    expect(bad.get(5)!.join(' ')).toMatch(/repeats what the picture shows/)
    const good = findNarrationStyleIssues([{ scene_number: 5, narration_text: 'Three items, zero queue, and still time to be properly smug about it.' }], { ...opts, promo: false, onScreen })
    expect(good.has(5)).toBe(false)
  })
})

describe('regression: draft 8df014d1 (cryptic "yellow clip", "whole trip" said four times, brand definition)', () => {
  const BAD = [
    'Does one bread heel really call for a whole trip? Save that yellow clip.',
    'When lunch is already halfway made, a few minutes on foot sounds much better than putting the whole thing off.',
    'Fresh-CAN is for the shopping list that barely deserves the name, not the kind that needs its own afternoon.',
    'Bread, tomatoes and milk are enough to get lunch back on track without a grand restock.',
    "A few groceries don't have to become a whole outing. Without queues or crowded aisles, this stop stays small.",
    "Lunch didn't become a whole outing. That yellow clip's back beside the finished tomato sandwich.",
  ]
  const GOOD = [
    "What if running out of bread didn't have to turn into a whole trip?",
    "Because normally it's shoes, keys, a long queue, and somehow one sandwich ends up as an entire afternoon errand.",
    'Fresh-CAN is the neighbourhood shortcut, with fresh produce, everyday essentials, no crowded aisles and no queues, just down the street.',
    "Bread, tomatoes and milk, and the errand's over before it has even properly started.",
    "And the best bit is the walk back, because nobody's counting minutes, and lunch is still waiting right where you left it.",
    'Same kitchen, same sandwich, and nobody had to give up an afternoon for bread.',
  ]
  const bands = [[14, 16], [19, 22], [19, 22], [14, 16], [19, 22], [14, 16]]
  it('the repeated word is caught', () => {
    const issues = findNarrationStyleIssues(scenes(BAD), opts)
    expect([...issues.values()].flat().join(' ')).toMatch(/leans on "whole"/)
  })
  it('the understandable rewrite (built from the creator\'s own copy) is clean, in band, brand once', () => {
    expect([...findNarrationStyleIssues(scenes(GOOD), opts).entries()]).toEqual([])
    GOOD.forEach((l, i) => {
      const n = narrationWordCount(l)
      expect(n, `scene ${i + 1}`).toBeGreaterThanOrEqual(bands[i][0])
      expect(n, `scene ${i + 1}`).toBeLessThanOrEqual(bands[i][1])
    })
    expect(GOOD.join(' ').match(/Fresh-CAN/g)).toHaveLength(1)
    expect(GOOD.join(' ')).not.toMatch(/clip/i)
  })
  it('the writer is told to be understandable and to build from creator-written copy; promo never names the motif', () => {
    const p = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', sceneNotes: 'Voiceover: "What if...?"', spine: { concept: 'c', motif: 'the yellow clip', voice: 'promo' } })
    expect(p).toMatch(/UNDERSTANDABLE/)
    expect(p).toMatch(/no "that yellow clip", "the tote"/)
    expect(p).toMatch(/THAT copy is the narration/)
    expect(p).toMatch(/never mention props, colours or small details that only the picture shows/)
    expect(p).not.toMatch(/motif: the yellow clip/)
    expect(p).not.toMatch(/The motif is named early/)
    const story = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, { language: 'English', spine: { concept: 'c', motif: 'a lemon', voice: 'story' } })
    expect(story).toMatch(/The motif is named early/)
  })
  it('the planner treats creator-written copy as the concept, and the review wants plain fixes', () => {
    const planner = composeVideoScriptSystemPrompt(BRAND_PROFILE, { sceneNotes: 'x' } as never)
    expect(planner).toMatch(/that copy IS the narration/)
    expect(planner).toMatch(/never spoken/)
    expect(composeNarrationReviewSystemPrompt(BRAND_PROFILE)).toMatch(/cryptic reference/)
  })
})
