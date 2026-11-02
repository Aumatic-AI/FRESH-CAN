import { describe, it, expect } from 'vitest'
import { parseNarrationReview, quoteAppearsIn, planReviewRewrites, reviewRewriteViolations, brandMentionCount, MAX_REVIEW_REWRITES } from './narrationReview'
import { composeNarrationReviewSystemPrompt } from '../prompts/index'
import { BRAND_PROFILE } from '../prompts/brand/fresh-can'

const SCENES = [1, 2, 3, 4]

describe('parseNarrationReview', () => {
  it('parses a full answer and drops scene numbers that do not exist', () => {
    const r = parseNarrationReview(
      {
        scores: { arc: 8, hook: 12, voice: 'x' },
        motif_returns: { returns: false, carry_in_scene: 9 },
        quotable: { present: true, scene: 2 },
        ending_image_in_final_visual: true,
        last_line_lands_on_ending: false,
        auto_fail: [{ scene_number: 3, kind: 'invented_fact', detail: 'a price' }, { kind: '' }],
        scene_issues: [{ scene_number: 2, problem: 'describes the picture', fix: 'add a worry' }, { scene_number: 99, problem: 'x', fix: 'y' }],
      },
      SCENES,
    )!
    expect(r.scores).toEqual({ arc: 8, hook: 10 })
    expect(r.motif_returns).toEqual({ returns: false, carry_in_scene: null })
    expect(r.quotable).toEqual({ present: true, scene: 2 })
    expect(r.auto_fail).toEqual([{ scene_number: 3, kind: 'invented_fact', detail: 'a price' }])
    expect(r.scene_issues).toHaveLength(1)
  })

  it('returns null for a non-object and an empty review for an empty object', () => {
    expect(parseNarrationReview(null, SCENES)).toBeNull()
    expect(parseNarrationReview('nope', SCENES)).toBeNull()
    const r = parseNarrationReview({}, SCENES)!
    expect(r.scene_issues).toEqual([])
    expect(r.motif_returns).toBeNull()
  })
})

describe('planReviewRewrites', () => {
  const base = parseNarrationReview({}, SCENES)!

  it('maps plan-level findings to the scene that can fix them', () => {
    const r = { ...base, motif_returns: { returns: false, carry_in_scene: 4 }, quotable: { present: false, scene: null }, last_line_lands_on_ending: false, ending_image_in_final_visual: true }
    const { notes, endingVisualMismatch } = planReviewRewrites(r, 4, 3)
    expect(endingVisualMismatch).toBe(false)
    expect([...notes.keys()].sort()).toEqual([3, 4])
    expect(notes.get(4)?.join(' ')).toContain('recurring object')
    expect(notes.get(4)?.join(' ')).toContain('final image')
    expect(notes.get(3)?.join(' ')).toContain('worth quoting')
  })

  it('never turns a picture problem into a narration rewrite', () => {
    const { notes, endingVisualMismatch } = planReviewRewrites({ ...base, ending_image_in_final_visual: false, last_line_lands_on_ending: false }, 4)
    expect(endingVisualMismatch).toBe(true)
    expect(notes.size).toBe(0)
  })

  it('ignores a whole-video hook_unpaid flag and caps the rewrites', () => {
    const many = { ...base, auto_fail: [{ scene_number: null, kind: 'hook_unpaid', detail: '' }], scene_issues: [1, 2, 3, 4].map((n) => ({ scene_number: n, problem: 'p', fix: 'f' })).concat([{ scene_number: 1, problem: 'again', fix: 'f' }]) }
    const { notes } = planReviewRewrites(many, 4)
    expect(notes.size).toBeLessThanOrEqual(MAX_REVIEW_REWRITES)
    expect(notes.get(1)).toHaveLength(2)
  })
})

describe('reviewRewriteViolations and brandMentionCount', () => {
  const opts = { forbiddenTerms: BRAND_PROFILE.narrationForbiddenTerms }
  it('rejects an invented figure but allows one the line already had', () => {
    expect(reviewRewriteViolations('It saves her 20 minutes.', 'It saves her time.', opts)).toContain('introduces a figure')
    expect(reviewRewriteViolations('She has 2 bags.', 'She has 2 bags.', opts)).toEqual([])
  })
  it('rejects vehicle and cashier words, whole words only', () => {
    expect(reviewRewriteViolations('The truck waits.', 'It waits.', opts)).toContain('uses "truck"')
    expect(reviewRewriteViolations('A trucker waves.', 'x', opts)).toEqual([])
  })
  it('counts brand mentions across the video', () => {
    expect(brandMentionCount(['Fresh-CAN is close.', 'No fresh-can here', 'x'], 'Fresh-CAN')).toBe(2)
  })
})

describe('composeNarrationReviewSystemPrompt', () => {
  const p = composeNarrationReviewSystemPrompt(BRAND_PROFILE)
  it('asks for the semantic motif check and compares the ending with the FINAL scene\'s picture', () => {
    expect(p).toContain('in meaning, not necessarily in the same words')
    expect(p).toContain('FINAL scene\'s on_screen')
  })
  it('lists the auto-fail kinds and the real facts', () => {
    for (const k of ['invented_fact', 'fake_testimonial', 'place_name', 'crossing', 'cashier_or_checkout', 'vehicle', 'contradicts_picture', 'hook_unpaid']) expect(p).toContain(k)
    expect(p).toContain(BRAND_PROFILE.statistics[0])
  })
})

describe('auto-fail flags must quote the narration', () => {
  const lines = new Map([[1, 'After her night shift, a tired nurse grips her tote.'], [2, 'Fresh-CAN by her bus stop is open.']])
  const flags = [
    { scene_number: 1, kind: 'invented_fact', detail: 'an hour', quote: 'At seven' },
    { scene_number: 2, kind: 'invented_fact', detail: 'sourcing', quote: 'Locally grown' },
    { scene_number: 2, kind: 'place_name', detail: 'no quote given' },
    { scene_number: 1, kind: 'vehicle', detail: 'real', quote: '“A TIRED nurse”' },
    { scene_number: null, kind: 'hook_unpaid', detail: 'whole video' },
    { scene_number: null, kind: 'invented_fact', detail: 'no scene, no quote' },
  ]

  it('quoteAppearsIn ignores case, curly marks, spacing and surrounding quotes, and rejects words that are not there', () => {
    expect(quoteAppearsIn('“A TIRED  nurse”', lines.get(1)!)).toBe(true)
    expect(quoteAppearsIn('At seven', lines.get(1)!)).toBe(false)
    expect(quoteAppearsIn('', lines.get(1)!)).toBe(false)
    expect(quoteAppearsIn('it', lines.get(1)!)).toBe(false) // too short to mean anything
  })

  it('keeps only flags whose quote is in that scene\'s line (and a whole-video hook_unpaid)', () => {
    const r = parseNarrationReview({ auto_fail: flags }, [1, 2], lines)!
    expect(r.auto_fail.map((f) => f.kind)).toEqual(['vehicle', 'hook_unpaid'])
  })

  it('does not verify quotes when no lines are given (older callers)', () => {
    expect(parseNarrationReview({ auto_fail: flags }, [1, 2])!.auto_fail).toHaveLength(6)
  })

  it('the prompt asks for the quote and tells the reviewer the creator\'s idea is not invented', () => {
    const p = composeNarrationReviewSystemPrompt(BRAND_PROFILE)
    expect(p).toContain('"quote": string')
    expect(p).toContain('creator_idea')
    expect(p).toContain('is NOT invented')
    expect(p).toContain('judge only the words in each scene')
  })
})
