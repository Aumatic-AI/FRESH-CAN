// One switch for the camera-freedom behaviour (default ON; CAMERA_MOVES=off
// restores the old "every shot locked-off and static" rules everywhere at once:
// planner prompt, lockSceneCamera, motion writer, clip lint and clip prompt).
// The old rule came from real failures — a long moving shot made the video model
// repeat and morph the background (jobs a64ab879, 369ff9de) — so moves stay short,
// slow and single, and a clip that drifts is re-rendered once with a static camera
// (see generateSceneVisual.ts's CLIP_DRIFT_RETRY).
export function cameraMovesEnabled(): boolean {
  return process.env.CAMERA_MOVES !== 'off'
}

/** Does this text ask for a camera move (as opposed to a locked-off shot)? */
export function mentionsCameraMove(text: string | null | undefined): boolean {
  if (!text) return false
  return /\b(push[- ]?in|pull[- ]?(back|out)|dolly|slider|parallax|arc|zoom|handheld|hand-held|tracking|track(s|ing)? (in|out|left|right|alongside)|pan(s|ning)?|tilt(s|ing)?|crane|gimbal|reverse[- ]track|glide|glides|gliding)\b/i.test(text)
}
