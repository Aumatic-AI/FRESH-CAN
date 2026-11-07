// Single-shot narration, written BEFORE the video prompt so the voice is not an afterthought of a 3,000
// character camera brief. One connected passage that covers every beat of the idea, then split into 5-7
// spoken lines (each line is a timing slot for the French re-voice). Pure: no network, no DB.
// The executor is steps/singleShot/writeNarration.ts.
import type { BrandProfile } from './types'
import { SINGLE_SHOT_DURATION_SECONDS, type SingleShotJobLanguage } from './singleShot'

/** Spoken words for the whole clip. BOTH is tighter because the French voice runs ~15-25% longer in the same slots. */
export function narrationWordRange(language: SingleShotJobLanguage): { min: number; max: number } {
  return language === 'BOTH' ? { min: 64, max: 70 } : { min: 70, max: 80 }
}

export const NARRATION_MIN_LINES = 5
export const NARRATION_MAX_LINES = 7
/** A line is a complete sentence, never a bare label. */
export const NARRATION_MIN_LINE_WORDS = 6
export const NARRATION_MAX_LINE_WORDS = 14

export type NarrationKind = 'narration' | 'dialogue' | 'creator_copy'

export function composeNarrationSystemPrompt(brand: BrandProfile, language: SingleShotJobLanguage): string {
  const { min, max } = narrationWordRange(language)
  const banned = brand.bannedWords.length > 0 ? `\nNever use these words: ${brand.bannedWords.join(', ')}.` : ''
  const lang =
    language === 'FR'
      ? "\nWrite every line in natural Canadian French (faire l'épicerie, courriel, cellulaire; no France-only terms, no anglicisms)."
      : language === 'BOTH'
        ? '\nThis narration is also adapted into French afterwards, so keep each line a short, self-contained thought with no English-only wordplay, and prefer lines of 8-12 words.'
        : ''
  return [
    `You write the spoken voiceover for a ${SINGLE_SHOT_DURATION_SECONDS}-second social ad reel for ${brand.name}. The pictures are made separately; you write only what the calm narrator says.`,
    `Brand voice: ${brand.voiceGuidelines}${banned}`,
    '',
    'STEP 1: list the beats. A beat is a distinct thing the idea names or implies, in order (for example: sign up once, scan the QR code, pick items, cameras and AI keep the tally, the card is charged automatically). Between 2 and 8 beats. Do not invent beats the idea does not contain.',
    'STEP 2: decide the kind. "creator_copy" when the idea already contains finished spoken copy in the creator\'s own words (it will be spoken as written, so write nothing). "dialogue" when the idea is a conversation, a testimonial or a person talking to camera. Otherwise "narration".',
    '',
    `STEP 3 (narration only): write ONE connected passage of ${min}-${max} words, then split it into ${NARRATION_MIN_LINES}-${NARRATION_MAX_LINES} spoken lines at sentence or clause boundaries.`,
    '- It must read as one continuous piece told by one voice, not as a list of captions. Open with a hook, move through the beats in order, close on a line that lands.',
    '- Connect the lines: carry an image or noun from one line into the next, and use connecting words (so, once, while, then, and, after that, until, because). Lines may begin with a connector.',
    '- Every beat gets at least one line, and every line carries a concrete fact or detail (what the person does, what the technology does, what the shopper gets). No filler such as "it is that simple", "a simple trip" or a bare slogan.',
    `- Each line is a full sentence of ${NARRATION_MIN_LINE_WORDS}-${NARRATION_MAX_LINE_WORDS} words that ends with punctuation. Vary the lengths; never start two lines in a row with the same word.`,
    '- Plain, warm, easy to say aloud. No hype, no invented statistics or product claims, no music or sound-design words. The voice may mention the brand at most once.',
    'Tag each line with the 0-based index of the beat it mainly covers (beat_index). Together the lines must cover every beat.',
    lang.trim() ? lang : '',
    '',
    'Reply with strictly valid JSON only:',
    '{ "beats": ["<beat 1>", "<beat 2>", ...], "kind": "narration" | "dialogue" | "creator_copy", "lines": [ { "text": "<spoken line>", "beat_index": 0 }, ... ] }',
    'For "dialogue" and "creator_copy", lines is [].',
  ]
    .filter((l) => l !== '')
    .join('\n')
}

export function composeNarrationUserPrompt(input: { idea: string; topic: string; previousProblem?: string }): string {
  const lines = [`Idea: ${input.idea.trim() || input.topic}`, `Topic: ${input.topic}`]
  if (input.previousProblem) lines.push(`Your previous reply was rejected: ${input.previousProblem}. Fix exactly that and reply again.`)
  return lines.join('\n')
}
