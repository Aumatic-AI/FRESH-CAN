// Single-shot test path (branch test/seedance-single-shot) — the INSTRUCTIONS
// half of the prompt-enhancement step. Pure and deterministic: no network, no
// DB. The executor that sends these to OpenAI is
// steps/singleShot/enhancePrompt.ts.
//
// Turns a short, plain idea into ONE prompt for a single 30-second Seedance 2.5
// text-to-video generation with native audio. There is no script, no scene
// plan, no ElevenLabs narration and no FFmpeg assembly in this path, so the
// prompt itself must carry the hook, the timing, the camera plan and the sound.
//
// Seedance 2.5 has no dialogue/lip-sync API parameter (docs.kie.ai/market/
// bytedance/seedance-2-5, 2026-11-05): speech is produced from the prompt text
// alone. So the AI picks ONE audio mode per video and writes the prompt in the
// matching convention:
//   narration - an unseen voiceover over the visuals, nobody on screen speaks
//   dialogue  - one or two visible people speak on camera, lip-synced
// enhancePrompt.ts then verifies the reply actually follows the chosen mode.
import { SAFE_ZONE_RADIUS_FRACTION } from '../lib/watermarkGeometry'
import type { BrandProfile } from './types'

export const SINGLE_SHOT_DURATION_SECONDS = 30

/** Seedance 2.5's documented prompt ceiling is 20,480 chars; an ad-reel prompt
 *  should be far shorter, and an over-long one dilutes the hook. The hard cap
 *  leaves headroom over the target the model is told to aim for: a journey
 *  idea (door, shopping, payment, exit) legitimately needs ~3.7k chars and a
 *  3500 cap rejected it on every attempt (job 6daa6b34). */
export const SINGLE_SHOT_PROMPT_TARGET_CHARS = 3000
export const SINGLE_SHOT_PROMPT_MAX_CHARS = 5000
export const SINGLE_SHOT_PROMPT_MIN_CHARS = 200

export type SingleShotAudioMode = 'narration' | 'dialogue'
export const SINGLE_SHOT_AUDIO_MODES: readonly SingleShotAudioMode[] = ['narration', 'dialogue']

/** Total spoken words across the whole 30s (calm pace, room for pauses and beats). */
export const SINGLE_SHOT_MAX_SPOKEN_WORDS = 70
/** Longest single dialogue line; long speeches break lip sync. */
export const SINGLE_SHOT_MAX_DIALOGUE_LINE_WORDS = 18
export const SINGLE_SHOT_MAX_SPEAKERS = 2

export type SingleShotContainerShown = 'none' | 'exterior' | 'interior' | 'both'
export const SINGLE_SHOT_CONTAINER_VALUES: readonly SingleShotContainerShown[] = ['none', 'exterior', 'interior', 'both']

/**
 * The real container photos to attach (Seedance 2.5 `reference_image_urls`), decided by what the
 * AI says is on screen. Exterior photos first, then interior. `none` attaches nothing, so a video
 * that never shows the container gets no brand images at all.
 */
export function pickContainerReferenceUrls(brand: BrandProfile, shown: SingleShotContainerShown): string[] {
  const exterior = shown === 'exterior' || shown === 'both' ? brand.referenceImages.exterior.map((r) => r.url) : []
  const interior = shown === 'interior' || shown === 'both' ? brand.referenceImages.interior.map((r) => r.url) : []
  return [...exterior, ...interior]
}

/** The form's language choice. */
export type SingleShotJobLanguage = 'EN' | 'FR' | 'BOTH'

/** The language directive for the enhancer. EN adds nothing (the original behaviour). */
export function singleShotLanguageDirective(language: SingleShotJobLanguage): string {
  if (language === 'BOTH') {
    return [
      '',
      'LANGUAGE: this one clip will be released in English AND in French. The French voice is added afterwards and replaces the English voice, so:',
      '- audio_mode MUST be "narration": nobody on screen speaks, no lip sync, no visible person talking. If the idea is a conversation, retell it as a voiceover.',
      '- Write the spoken lines in English, each a short complete thought that can be adapted into French (no wordplay that only works in English).',
    ].join('\n')
  }
  if (language === 'FR') {
    return [
      '',
      'LANGUAGE: every spoken line must be in natural Canadian French (faire l\'épicerie, courriel, cellulaire; never France-only terms; no anglicisms). Everything else in the prompt, including the sentence that introduces the voice, stays in English. The quoted spoken lines in the prompt and in spoken_lines are the French words.',
    ].join('\n')
  }
  return ''
}

export interface SingleShotPromptInput {
  /** The user's plain idea (the form's "scene idea", or the topic when empty). */
  idea: string
  topic: string
  category: string
  targetAudience: string
  aspectRatio: '9:16' | '1:1' | '16:9'
  /** Set on a retry: why the previous reply was rejected, so the model can fix it. */
  previousProblem?: string
  /** The form's language (default EN). */
  language?: SingleShotJobLanguage
}

export function composeSingleShotSystemPrompt(brand: BrandProfile, language: SingleShotJobLanguage = 'EN'): string {
  const banned = brand.bannedWords.length > 0 ? `\nNever use these words: ${brand.bannedWords.join(', ')}.` : ''
  const dress = brand.dressRule ? `\nPeople on screen: ${brand.dressRule}` : ''
  return [
    `You turn a short, plain idea into ONE prompt for a text-to-video model (Seedance 2.5) that makes a catchy ${SINGLE_SHOT_DURATION_SECONDS}-second social ad reel for the brand ${brand.name}.`,
    '',
    `Brand context (facts only; mention the brand at most once, as part of the story, never as a slogan recital):\n${brand.neutralIdentityLine ?? brand.missionStatement}`,
    `Voice: ${brand.voiceGuidelines}${banned}${dress}`,
    '',
    'The video is ONE continuous shot generated in a single pass: no hard cuts and no separate scenes, but the camera may travel, glide, rise, follow a person or pass through a doorway, so one flowing shot can tell a whole sequence. No on-screen text or captions (the model renders text badly), no logos drawn from imagination.',
    'The idea is the story: keep its premise, every beat it names, their order and its tone. Do not drop, merge or replace beats to make the shot easier, and do not replace it with a different story. Be cinematic and inventive in HOW it is shown (camera, light, texture, rhythm, detail), not in what happens. If the idea contains finished spoken copy, speak it in the same words and order.',
    '',
    'STEP 0: DECIDE IF THE FRESH-CAN CONTAINER IS SHOWN. Show it only when the idea calls for it: the idea names the container, the store, the unit or the app, someone opens, enters or walks up to it, or a scene happens at its door or inside it. Otherwise it must not appear.',
    '- "container_shown": "none" | "exterior" (only its outside is visible) | "interior" (only the inside is visible) | "both" (outside AND inside visible in the same shot).',
    '- Photo rule: if ANY part of the inside is visible, interior photos are needed, so choose "interior" or "both", never "exterior". Choose "both" when the outside and the inside are both visible, including a journey that starts outside and goes in (or out) as one flowing shot.',
    '- When "none": do NOT write the word "container" anywhere in the prompt and do not describe the store. No reference photos are attached.',
    '- When not "none": real photos of the container (outside views and/or inside views) are attached to the video model as reference images. In the prompt say once that the container must match the attached reference images, as a design guide only: never copy their angle, background, trees, buildings, paving or lighting, and describe a NEW composition and setting. Then respect these facts:',
    `  If the exterior is shown: ${brand.unit.sceneCompact}`,
    `  If the interior is shown: ${brand.unit.interior}`,
    `  Never: ${brand.forbiddenOnUnit.join(' ')}`,
    `Always: ${brand.forbiddenInScene.join(' ')}`,
    'DOORWAY (relaxed for this flow): the door may open and close and customers may walk up, hold their phone to the small white QR panel, go in, shop and come out, shown as one flowing shot. Keep it physically plausible: the black-frame glass double door is reached straight from the ground (no steps, ladder or climbing), people pass through it one at a time, nobody is ever half inside the glass or passes through a closed door, and the door is never left open with nobody near it. The QR panel identifies the person at entry; payment happens automatically afterwards.',
    '- If the idea describes a journey (arrives, scans, door opens, shops, leaves, door closes), keep EVERY beat in order, told as one continuous shot that follows the customer. Do not shorten it to one side of the door.',
    `- Spoken lines (narration and dialogue) may describe going in, shopping and leaving, and may say that payment is automatic. They must not suggest a checkout, cashier, queue, scanning of each item or a payment device.`,
    '- The container is simply there: it never arrives, drives, pulls up, parks, is delivered or hauled; no truck, cab, wheels or trailer. The QR identifies the person and is not a payment; there is no per-item scanning, checkout, cashier or queue.',
    '',
    'STEP 1: CHOOSE ONE AUDIO MODE for the whole video (the model generates the voice itself, from your prompt text only):',
    '- "narration": an unseen voice speaks over the pictures; nobody on screen is talking. Choose it for surreal, cinematic, poetic, documentary, montage, place or product-led ideas, and whenever the idea or the creator\'s copy reads like a voiceover (third person, addressing the viewer, "Imagine...").',
    '- "dialogue": one or two VISIBLE people talk, lip-synced. Choose it when the idea involves a conversation, a testimonial, someone talking to camera, a reaction line, a question and answer, or creator copy in quotation marks or first person ("I", "we") said by a person.',
    'Pick exactly one; never mix them. If the idea could go either way, choose "narration".',
    '',
    'STEP 2: WRITE THE PROMPT as flowing direction a film crew could follow:',
    '1. HOOK: the first 2 seconds must grab attention (a surprising image, a question, a striking motion).',
    `2. TIMED BEATS across the ${SINGLE_SHOT_DURATION_SECONDS} seconds, e.g. "0-3s ... 3-10s ...", one clear visual idea per beat, building to a payoff and a button ending in the last 3 seconds.`,
    '3. ONE look: light, colour grade, lens feel and setting stated once and kept consistent. Concrete camera plan (shot size, angle, slow push/pan/drift) that evolves smoothly with no hard cuts.',
    '4. SOUND: ambient sound and a gentle musical mood, plus the speech written as below.',
    '5. Concrete nouns, no vague mood words, no brand-new product claims, no invented statistics.',
    `6. LOGO CORNER: keep the top-right ${Math.round(SAFE_ZONE_RADIUS_FRACTION * 100)}% of the frame clean and low-detail for the whole video: no text, no face, no sign and no high-contrast clutter there. The real Fresh-CAN logo is added to that corner after generation, so never draw a logo or watermark yourself.`,
    '',
    'Speech rules for "narration":',
    '- Write a sentence such as: Voiceover only: nobody on screen speaks and no mouth moves. A calm, warm [gender/age/tone] voice says: "exact line".',
    '- Put every spoken line in double quotes, in the order spoken, placed at the beat where it is heard. Plain, short sentences that are easy to say aloud.',
    '- Do NOT write the words "lip-sync" or have any visible person talk.',
    `- LENGTH: unless the creator wrote finished copy (then speak exactly that), write 60-${SINGLE_SHOT_MAX_SPOKEN_WORDS} spoken words in total across the video.`,
    '',
    'Speech rules for "dialogue":',
    `- At most ${SINGLE_SHOT_MAX_SPEAKERS} speakers. Describe each speaker once in the prompt (age, look, clothes) and call them by the same short label every time (e.g. "the woman in the green coat").`,
    `- Write each line as: <speaker label> faces the camera, mouth clearly visible, and says in a <voice description> voice, lip-synced: "exact line". One speaker talks at a time; the listener reacts silently.`,
    `- Each line at most ${SINGLE_SHOT_MAX_DIALOGUE_LINE_WORDS} words, natural speech, with a short pause between turns. Keep speakers' faces and mouths in frame while they talk.`,
    '- No separate voiceover on top of the dialogue.',
    '',
    `Both modes: the spoken words total no more than ${SINGLE_SHOT_MAX_SPOKEN_WORDS}. Every spoken line must appear word for word, in double quotes, inside the prompt and also in spoken_lines.`,
    `The aspect ratio is given in the user message. Aim for about ${SINGLE_SHOT_PROMPT_TARGET_CHARS} characters and never exceed ${SINGLE_SHOT_PROMPT_MAX_CHARS}; trim detail before breaking that limit.`,
    '',
    'Reply with strictly valid JSON only, in this shape:',
    '{',
    '  "container_shown": "none" | "exterior" | "interior" | "both",',
    '  "audio_mode": "narration" | "dialogue",',
    '  "audio_reason": "<one short sentence on why this mode fits the idea>",',
    '  "prompt": "<the full Seedance prompt>",',
    '  "hook": "<the first-2-seconds hook in one sentence>",',
    '  "speakers": [ { "label": "<same label used in the prompt>", "description": "<look and voice>" } ],',
    '  "spoken_lines": [ { "speaker": "narrator" | "<a speakers label>", "text": "<line exactly as it appears in the prompt>" } ]',
    '}',
    'For "narration", speakers is [] and every spoken_lines speaker is "narrator". For "dialogue", every spoken_lines speaker must be one of the speakers labels.',
  ].join('\n') + singleShotLanguageDirective(language)
}

export function composeSingleShotUserPrompt(input: SingleShotPromptInput): string {
  const lines = [
    `Idea: ${input.idea.trim() || input.topic}`,
    `Topic: ${input.topic}`,
    `Category: ${input.category}`,
    `Audience: ${input.targetAudience}`,
    `Aspect ratio: ${input.aspectRatio}; compose for exactly this frame.`,
    `Length: ${SINGLE_SHOT_DURATION_SECONDS} seconds, one continuous shot.`,
  ]
  if (input.previousProblem) {
    lines.push(`Your previous reply was rejected: ${input.previousProblem}. Fix exactly that and reply again.`)
  }
  return lines.join('\n')
}
