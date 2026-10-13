import {
  ProviderCallError,
  type ScriptGenerator,
  type ScriptGenerationInput,
  type ScriptGenerationResult,
  type ImageValidator,
  type ImageValidationInput,
  type ClipValidationInput,
  type ClipValidator,
  type ClipMotionInput,
  type ClipMotionWriter,
  type ImageValidationResult,
} from './types'

// Models routinely wrap JSON answers in a Markdown code fence (```json ... ```)
// even when explicitly asked for "strictly valid JSON" — confirmed against
// the real API (gpt-4o-mini) during the Phase 2 e2e test run, where this
// caused JSON.parse to fail silently and finalize_draft to write a raw
// fenced string as content_drafts.draft_data instead of the expected
// post_title/content/seo fields. Stripping a wrapping fence before parsing
// fixes that without needing prompt-engineering to be perfectly reliable.
function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  return match ? match[1] : text
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(stripCodeFence(text))
  } catch {
    return null
  }
}

/**
 * Real OpenAI Chat Completions call — this is a documented, stable API and
 * implemented here with confidence (unlike the KIE.ai adapter). Not yet
 * exercised against the live API in this session (no OPENAI_API_KEY
 * available) — unit-tested against a mocked fetch instead.
 */
export class OpenAIScriptGenerator implements ScriptGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(input: ScriptGenerationInput): Promise<ScriptGenerationResult> {
    const res = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        // Text generation (scripts, outlines, copy, localization, intent): moved
        // from gpt-4o to gpt-6.1-sol on 2026-10-12 (verified live on chat
        // completions with response_format json_object). The vision validators
        // below stay on gpt-4o.
        model: input.model ?? 'gpt-6.1-sol',
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt },
        ],
        // Every caller's system prompt already asks for "strictly valid
        // JSON" and describes the exact shape, but without this the model
        // is free to preface the JSON with conversational text (e.g. "Sure,
        // here's the script:") — stripCodeFence's anchored regex only
        // strips a fence wrapping the ENTIRE response, so any preamble
        // makes JSON.parse fail on the whole string, not just the fence.
        // Confirmed live: generate_script (the video scriptwriter prompt,
        // a more "creative writing" framing than blog/image's more
        // clinical prompts) hit exactly this failure mode 3 attempts in a
        // row. json_object mode makes the API itself guarantee a bare JSON
        // object — no prompt-engineering reliability needed.
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('openai', res.status, detail)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new ProviderCallError('openai', res.status, 'response had no message content')
    }

    return { raw: content, parsed: safeJsonParse(content) }
  }
}

// Kept short and scoped to the exact high-value defect classes this gate
// exists for — a longer, exhaustive checklist would just make the model
// nitpick minor stylistic/lighting issues that were never the problem (see
// generateSceneVisual.ts's own header for why this is deliberately narrow).
//
// Revised 2026-09-23 to cut false positives: every rejection costs a paid
// KIE regeneration, and real data showed the old prompt flagging
// "unexplained hand on the left side of frame" on scenes whose own
// description REQUIRES hands (tapping a phone, picking produce, cooking,
// reading a note). Hands the scene implies are now explicitly allowed, and
// each issue carries a severity + confidence so only a clear, blocking
// defect rejects the image (see isRejectingIssue below).
const IMAGE_VALIDATION_SYSTEM_PROMPT =
  'You are a visual QA checker for AI-generated marketing images. Each rejection triggers a paid ' +
  'regeneration, so only report defects a typical viewer would clearly notice. Check ONLY for: an extra ' +
  'person not implied by the scene, a hand or arm that clearly belongs to no visible or implied person ' +
  '(disembodied, floating, or coming out of an impossible place), duplicate or malformed limbs on one ' +
  'person, a floating or impossible object, a required subject missing entirely, or an obviously ' +
  'illogical scene, or a collage / split-screen / stacked multi-panel layout (the image must be ONE ' +
  'single continuous photograph). NOT defects: hands or arms of a visible person, or hands implied by the described ' +
  'action (holding, tapping, picking up, cooking, reading, eating, first-person or over-the-shoulder ' +
  'framing) even when the rest of the body is cropped out of frame; any person the scene describes ' +
  '(e.g. a vendor, a friend); and any stylistic, lighting, or composition preference. ' +
  'Respond with strictly valid JSON: { "issues": [ { "text": string, "severity": "blocking" | "minor", ' +
  '"confidence": "high" | "medium" | "low" } ] } — an empty array when there are no defects. "text" is one ' +
  'short, specific phrase (e.g. "disembodied hand floating above the counter"), never a generic verdict. ' +
  'Use "blocking" only for a defect that would make the image unusable in a professional ad; use "high" ' +
  'confidence only when the defect is unambiguous, not merely possible.'

// Appended only when the unit can appear in the scene (ImageValidationInput.
// unitPresence). The truck's front and side panels are solid steel; the model
// keeps drawing a door/hatch there wherever a scene shows someone entering,
// leaving or shopping. Same blocking/high bar as every other check.
export const UNIT_STRUCTURE_VALIDATION_CLAUSE =
  ' ALSO, when the white box truck with a maroon cargo container appears: report as blocking a door, hatch, ' +
  'service window, vent or any other opening on the truck\'s LONG side panel (the long face carrying the ' +
  '"Fresh CAN" wordmark) or on its front face, and a "Fresh CAN" wordmark appearing more than once on one ' +
  'side panel. The truck\'s REAR face holds its only opening, a black-frame glass double door: that door, and ' +
  'the rear face next to the long side in a three-quarter view, are normal and must NOT be reported. Use the ' +
  'text "door or opening drawn on the truck\'s side or front".'

// Always on (every scene): a readable third-party brand on packaging, clothing
// or signage (real job a64ab879: a chip bag legibly reading "Doritos") breaks
// the no-other-brands rule and raises a trademark question. Same blocking +
// high-confidence bar, so only a clearly legible real brand rejects.
export const THIRD_PARTY_BRAND_VALIDATION_CLAUSE =
  ' ALSO report as blocking any clearly legible real third-party brand name or logo (on packaging, clothing, ' +
  'vehicles or signs) other than Fresh-CAN; blurred, tiny or invented-looking text is not a defect. Use the ' +
  'text "legible third-party brand name or logo".'

// Appended when the plan says the shot frames the unit's rear: the glass
// double door (and the small white QR panel beside it) is then expected, so a
// rear 3/4 view is never rejected as a "door on the side".
export const REAR_VIEW_VALIDATION_CLAUSE =
  ' This scene is planned as a view of the truck\'s REAR: the rear glass double door, and the small white QR panel ' +
  'beside it, are expected and must NOT be reported.'

export function buildImageValidationSystemPrompt(
  unitPresence?: 'none' | 'background' | 'featured',
  unitView?: 'side' | 'rear34' | 'rear',
): string {
  let prompt = IMAGE_VALIDATION_SYSTEM_PROMPT + THIRD_PARTY_BRAND_VALIDATION_CLAUSE
  if (unitPresence === 'background' || unitPresence === 'featured') {
    prompt += UNIT_STRUCTURE_VALIDATION_CLAUSE
    if (unitView === 'rear' || unitView === 'rear34') prompt += REAR_VIEW_VALIDATION_CLAUSE
  }
  return prompt
}

// Only a blocking, high-confidence issue rejects an image — anything
// softer is kept for observability (ImageValidationResult.ignoredIssues)
// but never spends another KIE generation.
function isRejectingIssue(issue: { severity?: unknown; confidence?: unknown }): boolean {
  return issue.severity === 'blocking' && issue.confidence === 'high'
}

/** Turns the validator model's `issues` array into a result: only issues that
 *  are blocking AND high-confidence reject (isRejectingIssue); the rest are
 *  logged as ignored. A bare string carries no severity, so it never rejects. */
export function parseValidationIssues(rawIssues: unknown[]): ImageValidationResult {
  const issues: string[] = []
  const ignoredIssues: string[] = []
  for (const item of rawIssues) {
    if (typeof item === 'string') {
      ignoredIssues.push(item)
      continue
    }
    if (!item || typeof item !== 'object') continue
    const issue = item as { text?: unknown; severity?: unknown; confidence?: unknown }
    if (typeof issue.text !== 'string' || !issue.text.trim()) continue
    if (isRejectingIssue(issue)) issues.push(issue.text)
    else ignoredIssues.push(`${issue.text} (${String(issue.severity)}, ${String(issue.confidence)} confidence)`)
  }
  return { pass: issues.length === 0, issues, ...(ignoredIssues.length ? { ignoredIssues } : {}) }
}

/**
 * Vision-capable QA gate (see ImageValidator's own header, adapters/types.ts)
 * — same provider as OpenAIScriptGenerator above, reusing the existing
 * OpenAI credential/infrastructure rather than adding a second vision
 * provider. Uses gpt-4o rather than gpt-4o-mini (changed 2026-09-23): a
 * false positive here costs a paid KIE image, which is far more than the
 * difference in OpenAI cost for one vision call per scene.
 */
export class OpenAIImageValidator implements ImageValidator {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async validate(input: ImageValidationInput): Promise<ImageValidationResult> {
    const sceneText =
      'Scene description (the people, objects, and actions it names are expected, not defects): ' +
      `${input.visualDescription}${input.shotNotes ? ` Shot notes: ${input.shotNotes}` : ''}` 

    const res = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: buildImageValidationSystemPrompt(input.unitPresence, input.unitView) },
          {
            role: 'user',
            content: [
              { type: 'text', text: sceneText },
              { type: 'image_url', image_url: { url: input.imageUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('openai', res.status, detail)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content
    const parsed = typeof content === 'string' ? safeJsonParse(content) : null

    const rawIssues = parsed && typeof parsed === 'object' ? (parsed as { issues?: unknown }).issues : undefined
    if (!Array.isArray(rawIssues)) {
      // Fail OPEN, not closed — a malformed/unparseable validator response
      // (or a provider hiccup a caller chooses to swallow the same way)
      // must never itself block an otherwise-successful, already-paid-for
      // image from proceeding — this is a quality gate on top of a working
      // pipeline, never a new single point of failure for it.
      return { pass: true, issues: [] }
    }

    return parseValidationIssues(rawIssues)
  }
}

// ─── Finished-clip check ─────────────────────────────────────────────────

export const CLIP_ISSUE_PEOPLE = 'extra or duplicated person in the clip'
export const CLIP_ISSUE_DOORWAY = 'someone crossing or emerging from the unit, or its door swinging open'
export const CLIP_ISSUE_OBJECT = 'new object that is not in the source still'
export const CLIP_ISSUE_MORPH = 'truck or wordmark morphing or garbled'

export const CLIP_VALIDATION_SYSTEM_PROMPT =
  'You are a strict visual QA reviewer for short AI-generated video clips. Image 1 is the SOURCE STILL the clip was ' +
  'animated from. The remaining images are frames sampled from the finished clip, in time order (early, middle, ' +
  'late). Compare each frame to the still and the scene description. Report ONLY defects the video model ' +
  'introduced that the still does not have: ' +
  `(1) more distinct people than the still shows, a person appearing, walking in, or a ghostly or blurred duplicate figure — use the text "${CLIP_ISSUE_PEOPLE}"; ` +
  `(2) anyone stepping out of, emerging from, entering, or standing in the doorway of the white box truck with the maroon container, or its door swinging open or closed when the still shows it otherwise — use the text "${CLIP_ISSUE_DOORWAY}"; ` +
  `(3) a new significant object (a cup, box, bag, tool) in someone's hands or the scene that the still and description do not show — use the text "${CLIP_ISSUE_OBJECT}"; ` +
  `(4) the truck or its container clearly changing shape or size, or its "Fresh CAN" wordmark turning into clearly misspelled or garbled letters where it was legible in the still — use the text "${CLIP_ISSUE_MORPH}". ` +
  'Ignore ordinary subject motion, camera-consistent changes of pose, expression and lighting, motion blur on a ' +
  'moving limb, anything described in the scene description, and small or distant text that was never legible. ' +
  'Respond with strictly valid JSON: { "issues": [ { "text": string, "severity": "blocking" | "minor", ' +
  '"confidence": "high" | "medium" | "low" } ] } — an empty array when there are no defects. Use "blocking" only ' +
  'for a defect that would make the clip unusable in a professional ad, and "high" confidence only when the defect ' +
  'is unambiguous in the frames, not merely possible.'

export class OpenAIClipValidator implements ClipValidator {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async validate(input: ClipValidationInput): Promise<ImageValidationResult> {
    if (input.frames.length === 0) return { pass: true, issues: [] }
    const sceneText =
      `Scene description (what the clip is meant to show): ${input.visualDescription}` +
      `${input.shotNotes ? ` Shot notes: ${input.shotNotes}` : ''}` +
      (input.unitPresence === 'background' || input.unitPresence === 'featured'
        ? ' The Fresh-CAN truck is part of this scene.'
        : ' No truck is expected in this scene.')

    const res = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: CLIP_VALIDATION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: sceneText },
              { type: 'image_url', image_url: { url: input.stillUrl } },
              ...input.frames.map((f) => ({
                type: 'image_url' as const,
                image_url: { url: `data:image/jpeg;base64,${f.toString('base64')}` },
              })),
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('openai', res.status, detail)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    const parsed = typeof content === 'string' ? safeJsonParse(content) : null
    const rawIssues = parsed && typeof parsed === 'object' ? (parsed as { issues?: unknown }).issues : undefined
    // Fail OPEN on an unparseable reply — a quality gate on a clip that is already paid for.
    if (!Array.isArray(rawIssues)) return { pass: true, issues: [] }
    return parseValidationIssues(rawIssues)
  }
}

// The image-to-video model already sees the still, so this prompt must describe
// only what MOVES — never the image's contents (guides for Seedance 1.5 Pro and
// the clip defects seen in jobs a64ab879/369ff9de agree on this). Reflections
// are excluded because a reflected figure is animated into a second person.
export const CLIP_MOTION_SYSTEM_PROMPT =
  'You write the motion prompt for an image-to-video model. The model already sees the attached still frame, ' +
  'so describe only what moves, never what the image looks like. Write ONE or TWO plain sentences (under 260 ' +
  'characters): one or two small, concrete, natural actions of the people or things already visible in the frame ' +
  '(a gesture, a head turn, a step, a breath, a smile), plus light ambient motion only if the frame already ' +
  'implies it (a breeze in hair or leaves). Then say everything else holds still. Pace the actions to the clip ' +
  'length. Mention only people and objects that are visible in the frame, and keep everyone on the same side of ' +
  'any door or doorway they are on in the frame. Keep the camera out of it: it is locked off. Leave reflections ' +
  'and anything not in the frame out. Reply with the sentences only: no quotes, no labels.'

export class OpenAIClipMotionWriter implements ClipMotionWriter {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly model: string = 'gpt-6.1-sol',
  ) {}

  async write(input: ClipMotionInput): Promise<string> {
    const res = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: CLIP_MOTION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  `Scene intent: ${input.visualDescription}` +
                  `${input.shotNotes ? ` Shot notes: ${input.shotNotes}` : ''} ` +
                  `Clip length: ${input.durationSeconds} seconds.`,
              },
              { type: 'image_url', image_url: { url: input.stillUrl } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new ProviderCallError('openai', res.status, detail)
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content ?? ''
  }
}
