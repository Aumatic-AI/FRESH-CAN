// Requests exactly the scene's planned slot (whole seconds), clamped to 4..8s.
//
// Cost and quality both scale with requested seconds, and a clip longer than
// the video needs is paid for and then trimmed. Narration is already corrected
// to within ~8% of its slot (localize's MAX_FILL 1.05, transcribeAudio's
// OVERSHOOT_HARD_TOLERANCE 1.08), and the render step absorbs that residue for
// free with a <=1.25x slow-down (avMerger.ts buildSceneDurationMatchCommand), so
// no headroom is bought here. A clip Seedance returns short is handled by
// generateSceneVisual (slot clamped to the real clip, lib/effectiveSceneDuration).
// Capped at 8s because long takes repeat their background (real job a64ab879's
// 11s clip) and the planner targets scenes of <=7s (8s only when the scene
// count forces it).
//
// History: 5/10s buckets -> planned slot -> slot + 1s (2026-09-26) -> slot*1.15+1
// (2026-10-12, over-provisioned: ~28% more paid video than the plan) -> now.
const MIN_CLIP_SECONDS = 4
const MAX_CLIP_SECONDS = 8

export function pickClipDurationSeconds(targetDurationMs: number): number {
  const slotSeconds = Math.round(targetDurationMs / 1000)
  return Math.min(MAX_CLIP_SECONDS, Math.max(MIN_CLIP_SECONDS, slotSeconds))
}
