// Shared by both sides of video's script-editing feature: the SERVER side
// (composeText.ts's composeLocalizeScriptSystemPrompt, which targets this
// exact rate when writing per-language narration wording; and
// updateScript.ts's applyScriptEdits, which enforces the budget derived
// below on a user's pre-approval narration edit) and the CLIENT side
// (VideoTabContent's live word-budget counter, page.tsx) — kept here rather
// than under server/pipeline so the dashboard page can import it directly
// without pulling in the rest of the prompt-composition module tree.
//
// Fallback narration rate for a voice with no measured history. Re-measured
// 2026-10-08 from real finished jobs (words / AssemblyAI-measured duration,
// trailing-silence buffer included, which is the slot a scene actually
// occupies): 2.4-2.9 words/sec, mean ~2.65. The previous 3.1 (measured
// 2026-09-24 for a different voice) overshot every recent job, e.g. job
// 790b8771's 36s request rendered at 44.2s because scene narration was
// budgeted at 3.1 wps but spoken at ~2.5. Per-voice measured rates (see
// db.getMeasuredWordsPerSecond) override this wherever history exists.
export const NARRATION_WORDS_PER_SECOND = 2.65

// A measured rate outside this band is treated as noise (a handful of scenes
// from a degenerate run), not a real property of the voice.
const MIN_PLAUSIBLE_WPS = 2.0
const MAX_PLAUSIBLE_WPS = 3.6

/** The rate to budget narration against: the voice's measured rate when it
 *  is plausible, else the fleet-wide fallback above. */
export function resolveWordsPerSecond(measured?: number | null): number {
  if (typeof measured !== 'number' || !Number.isFinite(measured)) return NARRATION_WORDS_PER_SECOND
  if (measured < MIN_PLAUSIBLE_WPS || measured > MAX_PLAUSIBLE_WPS) return NARRATION_WORDS_PER_SECOND
  return Math.round(measured * 100) / 100
}

// Slack above the raw rate — the render step already tolerates narration
// that runs "a little long" by holding a scene's last frame, so the budget
// only needs to block an edit that would force localize_script's
// per-language rewrite to badly compress the semantic content just to fit
// the scene's time slot, not one that's merely a bit generous.
export const NARRATION_TOLERANCE = 1.15

/** The hard word-count ceiling for a scene's narration_intent text, derived
 *  from its own target_duration_ms. Both the client counter and the
 *  server-side enforcement call this same function, so they can never
 *  disagree at the boundary. */
export function maxNarrationWords(targetDurationMs: number, wordsPerSecond = NARRATION_WORDS_PER_SECOND): number {
  return Math.ceil((targetDurationMs / 1000) * wordsPerSecond * NARRATION_TOLERANCE)
}

export function narrationWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// Word band for a scene's SPOKEN narration, derived from the scene's slot.
// Moved here from localizeScript.ts (still re-exported there) so the dashboard
// editor, the edit route and the narration writer all use one definition.
// MIN_FILL/MAX_FILL: a video's length is the sum of its scenes' real narration
// lengths, so a scene far under its slot shrinks the video; MAX is kept at
// 1.05 because an overshoot triggers a paid ElevenLabs resynthesis in
// transcribeAudio.ts.
export const MIN_FILL = 0.85
export const MAX_FILL = 1.05

export function narrationWordRange(
  targetDurationMs: number,
  wordsPerSecond = NARRATION_WORDS_PER_SECOND,
): { min: number; max: number } {
  const seconds = targetDurationMs / 1000
  return {
    min: Math.max(1, Math.ceil(seconds * wordsPerSecond * MIN_FILL)),
    max: Math.max(1, Math.floor(seconds * wordsPerSecond * MAX_FILL)),
  }
}

/** The approved/draft spoken narration stored on a scene (narration_intent.narration,
 *  English), or '' when none was written yet (legacy drafts). */
export function readSceneNarration(narrationIntent: unknown): string {
  if (!narrationIntent || typeof narrationIntent !== 'object') return ''
  const v = (narrationIntent as Record<string, unknown>).narration
  return typeof v === 'string' ? v : ''
}

/** The word band stored with the narration when it was written (so the editor
 *  and the server enforce the voice's real rate), else the default-rate band. */
export function readSceneNarrationLimit(
  narrationIntent: unknown,
  targetDurationMs: number,
): { min: number; max: number } {
  if (narrationIntent && typeof narrationIntent === 'object') {
    const l = (narrationIntent as Record<string, unknown>).narration_limit
    if (l && typeof l === 'object') {
      const { min, max } = l as { min?: unknown; max?: unknown }
      if (typeof min === 'number' && typeof max === 'number' && max >= 1) return { min, max }
    }
  }
  return narrationWordRange(targetDurationMs)
}
