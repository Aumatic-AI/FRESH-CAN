// Layer 4 (PROMPT_REFACTOR_BRIEF.md §4.5/§7) — the single source of truth
// for every per-endpoint prompt character budget. Each number is verified
// against real provider behavior, not guessed: see docs/PROMPT_ARCHITECTURE.md's
// Phase 5 section for the full write-up of which adapter is actually wired
// in production today (not just what's defined) and the owner's own
// confirmation of the numbers below.
export const PROMPT_LIMITS = {
  /** Budget for video scene-image and character-ref prompts, sent to
   *  NanoBananaImageGenerator (nano-banana-2 on KIE.ai).
   *
   *  Raised 2995 -> 8000 on 2026-10-13. 2995 was measured against the old
   *  Flux Kontext endpoint (confirmed live error: "The prompt word cannot
   *  exceed 3000 characters."), which stopped being used on 2026-09-23.
   *  nano-banana-2 has no documented prompt limit, and blog/image_post send
   *  unbounded prompts to this same model without a length failure. At 2995
   *  the ~2000-3100 chars of fixed brand text left almost nothing for the
   *  scene: in job d289e3af shot notes were dropped in all 7 scenes, scene
   *  descriptions were cut to 9-970 chars, and scene 5's scene block was
   *  empty (docs/DEBUG_JOB_d289e3af.md), so stills came back with missing
   *  legs, cropped people and a wrong truck. The cascade in
   *  composeSceneImagePrompt still applies if a prompt ever exceeds this. */
  sceneImage: 8000,
  /** KieVideoGenerator — Seedance 2.0 mini. Documented at
   *  docs.kie.ai/market/bytedance/seedance-2-mini: `input.prompt` is
   *  3-20000 characters; kept at the old 1.5 Pro ~2500 cap as a conservative ceiling. */
  sceneVideo: 2450,
} as const

// Blog hero/inline and image_post's photo (composeHeroPrompt/
// composeInlinePrompt/composePhotoPrompt) are deliberately NOT budgeted
// here. They're permanently routed through NanoBananaImageGenerator
// (nano-banana-2, see inngest/functions/blog.ts's and image.ts's own
// comments) with no documented prompt-length limit found, and have never
// hit a real length failure in production — owner-confirmed
// (PROMPT_REFACTOR_BRIEF.md §16.1 follow-up) to leave unbounded rather
// than budget them against a limit that may not even apply to this model.
// Video's scene images/character-ref share this same adapter as of
// 2026-09-23 but keep their own PROMPT_LIMITS.sceneImage budget above as a
// conservative ceiling — the two call sites made independent choices
// here, not a rule that nano-banana-2 callers are always unbounded.
