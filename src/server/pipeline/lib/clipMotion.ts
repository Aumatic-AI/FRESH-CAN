import { cameraMovesEnabled } from './cameraMoves'

// Lint for the AI-written clip motion line (adapters/openai.ts's
// OpenAIClipMotionWriter). The line is only used when it passes; otherwise the
// clip falls back to the deterministic scene-text prompt. Rejects anything the
// clip prompt must never ask the video model for: a doorway crossing, camera
// movement, a new person/object, or a reflection (job 369ff9de grew a man in
// the glass).

const MAX_MOTION_CHARS = 400
const MIN_MOTION_CHARS = 15

const REJECT_PATTERNS: readonly RegExp[] = [
  // crossing the unit's doorway (same intent as NO_ENTRY_EXIT_RULE)
  /\b(enter(s|ed|ing)?|exit(s|ed|ing)?|walks? (in|out|into|through)|steps? (in|out|into|inside|through)|stepping (in|out|into|through)|climb(s|ing)? (in|out|into)|comes? out of|leav(es|ing) the (unit|store|truck)|opens?( up)? the door|through the door)\b/i,
  // the container is not a vehicle: it never drives, arrives, parks or rolls
  /\b(drives?|driving|drove|pulls? (up|in|away|over)|pulling (up|in|away|over)|arriv(es|ing)|parks?|parking|parked|rolls?|rolling|truck|wheels?|cab)\b/i,
  // anything new arriving in frame
  /\b(another|a second|a third|new) (person|man|woman|child|figure|customer|worker|object|item)\b|\b(appears?|enters? the frame|walks? into (the )?frame|comes? into (the )?(frame|view))\b/i,
  // reflections (a reflected figure becomes a second person)
  /\breflect(s|ed|ion|ions|ing)?\b/i,
]

// Locked-off clips (CAMERA_MOVES=off, or a clip re-rendered after drift): any camera movement is rejected.
const CAMERA_ANY_PATTERN =
  /\b(pan(s|ning)?|tilt(s|ing)?|tracking shot|dolly|zoom(s|ing)?|push[- ]in|pull[- ]back|orbit|rack focus|handheld|camera (moves?|follows?|sweeps?|tracks?))\b/i
// Moving clips: only the moves known to break the video model are rejected.
const CAMERA_RISKY_PATTERN =
  /\b(orbit(s|ing)?|360|whip[- ]?pan|crash[- ]?zoom|fly(ing)?[- ]?through|drone|fpv|bullet[- ]time|rapid(ly)? (pan|zoom|spin)|spins? around)\b/i

/** Returns the cleaned motion line, or null when it must not be used. */
export function lintClipMotion(raw: unknown, opts: { cameraMoves?: boolean } = {}): string | null {
  const moves = opts.cameraMoves ?? cameraMovesEnabled()
  if (typeof raw !== 'string') return null
  const text = raw
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length < MIN_MOTION_CHARS || text.length > MAX_MOTION_CHARS) return null
  if (REJECT_PATTERNS.some((rx) => rx.test(text))) return null
  if ((moves ? CAMERA_RISKY_PATTERN : CAMERA_ANY_PATTERN).test(text)) return null
  return text
}
