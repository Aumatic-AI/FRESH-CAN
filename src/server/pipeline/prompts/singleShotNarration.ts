// Single-shot narration, written BEFORE the video prompt so the voice is not an afterthought of a 3,000
// character camera brief. One connected passage that covers every beat of the idea, then split into 5-7
// spoken lines (each line is a timing slot for the French re-voice). Pure: no network, no DB.
// The executor is steps/singleShot/writeNarration.ts.
import type { BrandProfile } from './types'
import { SINGLE_SHOT_DURATION_SECONDS, SINGLE_SHOT_PACES, type SingleShotJobLanguage, type SingleShotPace } from './singleShot'

/** The narration is never thinner than this, whatever the pace: pace changes the pictures, not how much the voice says. */
export const NARRATION_MIN_WORDS = 60

/**
 * Spoken words for the whole clip. The pace (decided from the idea) mainly shapes the VISUALS; the voice stays
 * full at every pace (60+ words). A calm idea gets the low end of the range, a busy one the top. BOTH is tighter
 * because the French voice runs ~15-25% longer inside the same timing slots. Measured: a 56-word clip spoke for
 * under 19 of its 30 seconds, so there is room.
 */
export function narrationWordRange(language: SingleShotJobLanguage, pace: SingleShotPace = 'brisk'): { min: number; max: number } {
  if (language === 'BOTH') return pace === 'calm' ? { min: 60, max: 66 } : pace === 'balanced' ? { min: 62, max: 68 } : { min: 64, max: 70 }
  return pace === 'calm' ? { min: 60, max: 72 } : pace === 'balanced' ? { min: 64, max: 76 } : { min: 70, max: 80 }
}

/** A line is a complete sentence, never a bare label. */
export const NARRATION_MIN_LINE_WORDS = 6

/** Same at every pace: the voice does not get sparser when the pictures get calmer. */
export function narrationLineLimits(_language: SingleShotJobLanguage, _pace: SingleShotPace = 'brisk'): { minLines: number; maxLines: number; maxLineWords: number } {
  return { minLines: 5, maxLines: 7, maxLineWords: 14 }
}

export type NarrationKind = 'narration' | 'dialogue' | 'creator_copy'

export function composeNarrationSystemPrompt(brand: BrandProfile, language: SingleShotJobLanguage): string {
  const r = (p: SingleShotPace) => narrationWordRange(language, p)
  const l = (p: SingleShotPace) => narrationLineLimits(language, p)
  const banned = brand.bannedWords.length > 0 ? `\nNever use these words: ${brand.bannedWords.join(', ')}.` : ''
  const lang =
    language === 'FR'
      ? "Write every line in natural Canadian French (faire l'épicerie, courriel, cellulaire; no France-only terms, no anglicisms)."
      : language === 'BOTH'
        ? 'This narration is also adapted into French afterwards, so keep each line a short, self-contained thought with no English-only wordplay, and prefer lines of 8-12 words.'
        : ''
  return [
    `You write the spoken voiceover for a ${SINGLE_SHOT_DURATION_SECONDS}-second social ad reel for ${brand.name}. The pictures are made separately; you write only what the narrator says.`,
    `Brand voice: ${brand.voiceGuidelines}${banned}`,
    '',
    'STEP 1: list the beats. A beat is a distinct thing the idea names or implies, in order (for example: sign up once, scan the QR code, pick items, cameras and AI keep the tally, the card is charged automatically). Between 2 and 8 beats. Do not invent beats the idea does not contain.',
    'STEP 2: decide the kind. "creator_copy" when the idea already contains finished spoken copy in the creator\'s own words (it will be spoken as written, so write nothing). "dialogue" when the idea is a conversation, a testimonial or a person talking to camera. Otherwise "narration".',
    `STEP 3 (narration only): decide the pace from the idea's own tone and how much story it holds, never from habit. Pace shapes the PICTURES (calm: unhurried, still, observational; balanced: relaxed rhythm; brisk: lively, busy). It does NOT make the voice thinner: the narration is full and detailed at every pace, never under ${NARRATION_MIN_WORDS} words. ${SINGLE_SHOT_PACES.join(' | ')}:`,
    `- "calm": a still, slow, observational, gentle or reflective idea, or one with few beats: ${r('calm').min}-${r('calm').max} words, a steady, unhurried voice.`,
    `- "balanced": a clear story at a relaxed rhythm: ${r('balanced').min}-${r('balanced').max} words.`,
    `- "brisk": a busy journey with many steps, or an energetic promo that needs a big script: ${r('brisk').min}-${r('brisk').max} words.`,
    'Never thin the narration to match a calm idea, and never thin a busy idea until beats are lost. Give a one-sentence pace_reason.',
    '',
    'STEP 4 (narration only): write ONE connected passage in the word range of the pace you chose, then split it into spoken lines at sentence or clause boundaries.',
    '- It must read as one continuous piece told by one voice, not as a list of captions. Open with a hook that fits the pace, move through the beats in order, close on a line that lands.',
    '- Connect the lines: carry an image or noun from one line into the next, and use connecting words (so, once, while, then, and, after that, until, because). Lines may begin with a connector.',
    '- Every beat gets at least one line, and every line carries a concrete fact or detail. No filler such as "it is that simple", "a simple trip" or a bare slogan.',
    `- Each line is a full sentence of ${NARRATION_MIN_LINE_WORDS}-${l('brisk').maxLineWords} words that ends with punctuation. Vary the lengths; never start two lines in a row with the same word.`,
    '- Plain, warm, easy to say aloud. No hype, no invented statistics or product claims, no music or sound-design words. The voice may mention the brand at most once.',
    'Tag each line with the 0-based index of the beat it mainly covers (beat_index). Together the lines must cover every beat.',
    lang,
    '',
    'Reply with strictly valid JSON only:',
    '{ "beats": ["<beat 1>", ...], "kind": "narration" | "dialogue" | "creator_copy", "pace": "calm" | "balanced" | "brisk", "pace_reason": "<one sentence>", "lines": [ { "text": "<spoken line>", "beat_index": 0 }, ... ] }',
    'For "dialogue" and "creator_copy", lines is [] (you may still give a pace).',
  ]
    .filter((x) => x !== '')
    .join('\n')
}

export function composeNarrationUserPrompt(input: { idea: string; topic: string; previousProblem?: string }): string {
  const lines = [`Idea: ${input.idea.trim() || input.topic}`, `Topic: ${input.topic}`]
  if (input.previousProblem) lines.push(`Your previous reply was rejected: ${input.previousProblem}. Fix exactly that and reply again.`)
  return lines.join('\n')
}
