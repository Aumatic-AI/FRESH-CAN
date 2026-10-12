// Narration is written to each scene's time slot (video_scenes.target_duration_ms),
// and the clip for that scene is generated once, before any language's narration
// exists. Seedance does not reliably render the requested length, so a clip can
// come back shorter than the slot; the render step then has to stretch or hold
// it. Instead, once the real clip length is known the slot is clamped to it, so
// localize / voice-fit / captions all write to the footage that actually exists
// and no gap needs filling. The planned slot is kept (narration_intent.
// planned_duration_ms) so a later, longer clip can restore it.

/** A clip within this much of its planned slot counts as a full-length clip. */
export const CLIP_SHORTFALL_TOLERANCE_MS = 250
/** Never shrink a slot below this, whatever the probe says. */
export const MIN_SLOT_MS = 2000

export const PLANNED_DURATION_KEY = 'planned_duration_ms'

/** The slot a scene should use given its planned slot and the real clip length
 *  (seconds, from the MP4 header; null/invalid = unknown -> planned). */
export function effectiveSlotMs(plannedMs: number, realClipSeconds: number | null | undefined): number {
  if (typeof realClipSeconds !== 'number' || !Number.isFinite(realClipSeconds) || realClipSeconds <= 0) {
    return plannedMs
  }
  const realMs = Math.floor(realClipSeconds * 10) * 100 // whole 0.1s, rounded down
  if (realMs >= plannedMs - CLIP_SHORTFALL_TOLERANCE_MS) return plannedMs
  return Math.min(plannedMs, Math.max(MIN_SLOT_MS, realMs))
}

/** The planned slot for a scene: the stored original if a previous clamp saved
 *  one, else the row's current target (which has never been clamped). */
export function plannedSlotMs(narrationIntent: unknown, currentTargetMs: number): number {
  if (narrationIntent && typeof narrationIntent === 'object') {
    const v = (narrationIntent as Record<string, unknown>)[PLANNED_DURATION_KEY]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  }
  return currentTargetMs
}
