// Pure helpers for the one-call narration review (see
// composeNarrationReviewSystemPrompt): parse the reviewer's answer leniently,
// decide which scenes may be rewritten, and re-check a rewrite in code. Nothing
// here calls a model.

export interface NarrationReview {
  scores: Record<string, number>
  motif_returns: { returns: boolean; carry_in_scene: number | null } | null
  quotable: { present: boolean; scene: number | null } | null
  ending_image_in_final_visual: boolean | null
  last_line_lands_on_ending: boolean | null
  auto_fail: { scene_number: number | null; kind: string; detail: string }[]
  scene_issues: { scene_number: number; problem: string; fix: string }[]
}

/** What happened after the review; stored internally, never shown on the approval screen. */
export interface NarrationReviewRecord extends NarrationReview {
  rewritten: number[]
  kept_original: number[]
  /** The final scene's picture does not show the planned ending image: the
   *  narration cannot fix that, so it is reported instead of rewritten. */
  ending_visual_mismatch: boolean
}

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null)
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Lenient parse: null only when the answer is not an object at all. Scene
 *  numbers that do not exist in the video are dropped. */
export function parseNarrationReview(parsed: unknown, sceneNumbers: readonly number[]): NarrationReview | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>
  const known = new Set(sceneNumbers)
  const sceneOrNull = (v: unknown) => {
    const n = num(v)
    return n !== null && known.has(n) ? n : null
  }

  const scores: Record<string, number> = {}
  if (p.scores && typeof p.scores === 'object') {
    for (const [k, v] of Object.entries(p.scores as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) scores[k] = Math.max(0, Math.min(10, v))
    }
  }
  const motif = p.motif_returns as Record<string, unknown> | undefined
  const quotable = p.quotable as Record<string, unknown> | undefined
  return {
    scores,
    motif_returns: motif && typeof motif === 'object' && typeof motif.returns === 'boolean'
      ? { returns: motif.returns, carry_in_scene: sceneOrNull(motif.carry_in_scene) }
      : null,
    quotable: quotable && typeof quotable === 'object' && typeof quotable.present === 'boolean'
      ? { present: quotable.present, scene: sceneOrNull(quotable.scene) }
      : null,
    ending_image_in_final_visual: bool(p.ending_image_in_final_visual),
    last_line_lands_on_ending: bool(p.last_line_lands_on_ending),
    auto_fail: (Array.isArray(p.auto_fail) ? p.auto_fail : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({ scene_number: sceneOrNull(x.scene_number), kind: text(x.kind), detail: text(x.detail) }))
      .filter((x) => x.kind !== ''),
    scene_issues: (Array.isArray(p.scene_issues) ? p.scene_issues : [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({ scene_number: sceneOrNull(x.scene_number), problem: text(x.problem), fix: text(x.fix) }))
      .filter((x): x is { scene_number: number; problem: string; fix: string } => x.scene_number !== null && (x.problem !== '' || x.fix !== '')),
  }
}

export const MAX_REVIEW_REWRITES = 4

/** Which scenes the single rewrite may touch, with the notes for each. Plan-level
 *  findings are mapped to the scene that can fix them. A problem only the picture
 *  can fix (the final scene does not show the ending image) is never turned into a
 *  narration rewrite. */
export function planReviewRewrites(
  review: NarrationReview,
  lastScene: number,
  spineQuotableScene?: number,
): { notes: Map<number, string[]>; endingVisualMismatch: boolean } {
  const notes = new Map<number, string[]>()
  const add = (n: number | null | undefined, note: string) => {
    if (n === null || n === undefined) return
    notes.set(n, [...(notes.get(n) ?? []), note])
  }
  for (const i of review.scene_issues) add(i.scene_number, [i.problem, i.fix && `Fix: ${i.fix}`].filter(Boolean).join(' '))
  for (const f of review.auto_fail) {
    if (f.kind === 'hook_unpaid') continue // a whole-video problem; no single scene is the cause
    add(f.scene_number, `${f.kind.replace(/_/g, ' ')}${f.detail ? `: ${f.detail}` : ''}`)
  }
  if (review.motif_returns && !review.motif_returns.returns) {
    add(review.motif_returns.carry_in_scene ?? lastScene, 'bring the story\'s recurring object or gesture back here, in a new form (the same thing, not necessarily the same words)')
  }
  if (review.quotable && !review.quotable.present) {
    add(review.quotable.scene ?? spineQuotableScene, 'give the video one plain, specific line worth quoting; never a slogan')
  }
  const endingVisualMismatch = review.ending_image_in_final_visual === false
  if (review.last_line_lands_on_ending === false && !endingVisualMismatch) {
    add(lastScene, 'end on the planned final image as a small concrete moment that matches what this scene shows')
  }
  const kept = new Map([...notes].slice(0, MAX_REVIEW_REWRITES))
  return { notes: kept, endingVisualMismatch }
}

const NUMERIC = /[\d$€£%]/

/** Rules a rewrite must still meet that no model call re-checks: no invented
 *  figures, no vehicle/cashier words, brand name count unchanged in kind. */
export function reviewRewriteViolations(
  candidate: string,
  current: string,
  opts: { forbiddenTerms?: readonly string[] },
): string[] {
  const problems: string[] = []
  if (NUMERIC.test(candidate) && !NUMERIC.test(current)) problems.push('introduces a figure')
  const lower = candidate.toLowerCase()
  for (const t of opts.forbiddenTerms ?? []) {
    if (new RegExp(`\\b${t}\\b`, 'i').test(lower)) problems.push(`uses "${t}"`)
  }
  return problems
}

/** Mentions of the brand name across the whole narration. */
export function brandMentionCount(texts: readonly string[], brandName: string): number {
  const re = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return texts.reduce((sum, t) => sum + (t.match(re)?.length ?? 0), 0)
}
