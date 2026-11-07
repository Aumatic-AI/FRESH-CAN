// Single-shot test path (branch test/seedance-single-shot) — the EXECUTOR half
// of prompt enhancement. The wording lives in prompts/singleShot.ts; this file
// calls OpenAI with it, validates the reply, caches the result on
// pipeline_steps (so an Inngest retry never re-pays for enhancement) and
// records the attempt.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptGenerator } from '../../adapters/types'
import { getLastSucceededStepOutput, hasSucceededStep, recordStepAttempt } from '../../db'
import {
  composeSingleShotSystemPrompt,
  composeSingleShotUserPrompt,
  pickContainerReferenceUrls,
  SINGLE_SHOT_AUDIO_MODES,
  SINGLE_SHOT_CONTAINER_VALUES,
  SINGLE_SHOT_MAX_DIALOGUE_LINE_WORDS,
  SINGLE_SHOT_MAX_SPEAKERS,
  SINGLE_SHOT_MAX_SPOKEN_WORDS,
  SINGLE_SHOT_NO_MUSIC_CLAUSE,
  SINGLE_SHOT_PROMPT_MAX_CHARS,
  SINGLE_SHOT_PROMPT_TARGET_CHARS,
  SINGLE_SHOT_PROMPT_MIN_CHARS,
  type SingleShotAudioMode,
  type SingleShotContainerShown,
  type SingleShotPromptInput,
} from '../../prompts/singleShot'
import type { BrandProfile } from '../../prompts/types'

export const ENHANCE_STEP_NAME = 'single_shot_enhance'
const MAX_ENHANCE_ATTEMPTS = 3
export const NARRATOR = 'narrator'

export interface SingleShotSpeaker {
  label: string
  description: string
}
export interface SingleShotSpokenLine {
  speaker: string
  text: string
}

export interface EnhancedSingleShotPrompt {
  /** The full prompt sent to Seedance. */
  prompt: string
  /** How the AI decided the video is voiced: an unseen voiceover or on-camera lip-synced dialogue. */
  audioMode: SingleShotAudioMode
  audioReason: string
  hook: string
  speakers: SingleShotSpeaker[]
  spokenLines: SingleShotSpokenLine[]
  /** Whether the AI put the Fresh-CAN container on screen (and which side). */
  containerShown: SingleShotContainerShown
  /** Real container photos attached to Seedance: empty unless the container is shown. */
  referenceImageUrls: string[]
  /** The user's original idea, kept for the record. */
  originalIdea: string
}

/** Lower-cases, unifies curly quotes/apostrophes and collapses whitespace, so a line matches its copy in the prompt despite typography. */
function flat(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
const UNIT_WORDS = /\b(?:unit|truck|vehicle|container|fresh[- ]?can)\b/i
const ARRIVAL_PATTERN =
  /\b(?:arrive|arrives|arrived|arriving|pull|pulls|pulled|pulling\s+up|drive|drives|drove|driving|park|parks|parked|parking|deliver|delivers|delivered|haul|hauls|hauled|hauling)\b/gi

/** True when the container itself arrives, drives, parks or is delivered (it is simply there). A person arriving AT it is fine, so a hit must sit right next to the container word and not be "arrive(s) at". */
export function describesContainerArrival(text: string): boolean {
  const g = new RegExp(ARRIVAL_PATTERN.source, 'gi')
  for (let m = g.exec(text); m; m = g.exec(text)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 6)
    if (/^arriv/i.test(m[0]) && /^\s+(?:at|to|near)\b/i.test(after)) continue
    const around = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)
    if (UNIT_WORDS.test(around)) return true
  }
  return false
}

const NEGATED_MUSIC = /\b(?:no|without|never|not any)\s+(?:any\s+)?(?:background\s+|musical\s+)?(?:music|score|soundtrack|singing|songs?)\b/gi
const MUSIC_WORDS = /\b(?:music|musical|soundtrack|score|melody|melodic|songs?|singing|jingle|orchestra|orchestral)\b/i
const SAYS_NO_MUSIC = /\b(?:no|without)\s+(?:any\s+)?(?:background\s+|musical\s+)?music\b/i

/** True when the prompt asks for music or a musical mood (negated mentions like "no background music" are fine). */
export function promptRequestsMusic(text: string): boolean {
  return MUSIC_WORDS.test(text.replace(NEGATED_MUSIC, ' '))
}

/** Adds the no-music sentence when the prompt does not already say it. */
export function withNoMusicClause(prompt: string): string {
  return SAYS_NO_MUSIC.test(prompt) ? prompt : `${prompt} ${SINGLE_SHOT_NO_MUSIC_CLAUSE}`
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Returns a reason string when the model reply is unusable, otherwise the parsed prompt. */
export function normalizeEnhancedPrompt(
  parsed: unknown,
  originalIdea: string,
  brand: BrandProfile,
  opts: { requireNarration?: boolean } = {},
): EnhancedSingleShotPrompt | string {
  if (!parsed || typeof parsed !== 'object') return 'reply was not a JSON object'
  const obj = parsed as Record<string, unknown>

  const mode = obj.audio_mode
  if (typeof mode !== 'string' || !(SINGLE_SHOT_AUDIO_MODES as readonly string[]).includes(mode)) {
    return 'audio_mode must be "narration" or "dialogue"'
  }
  const audioMode = mode as SingleShotAudioMode
  if (opts.requireNarration && audioMode !== 'narration') {
    return 'this clip is also released in French with a new voice, so audio_mode must be "narration" (no visible person talks)'
  }

  const shown = obj.container_shown
  if (typeof shown !== 'string' || !(SINGLE_SHOT_CONTAINER_VALUES as readonly string[]).includes(shown)) {
    return 'container_shown must be "none", "exterior", "interior" or "both"'
  }
  const containerShown = shown as SingleShotContainerShown

  let prompt = typeof obj.prompt === 'string' ? obj.prompt.trim() : ''
  if (prompt.length < SINGLE_SHOT_PROMPT_MIN_CHARS) return `prompt too short (${prompt.length} chars)`
  // Narration over natural ambient sound, never music. A music request is rejected (the model retries);
  // a prompt that simply never says "no music" gets the clause appended, before the length cap is applied.
  if (promptRequestsMusic(prompt)) return 'prompt asks for music or a musical mood; Fresh-CAN videos use natural ambient sound only, no music'
  const idea = originalIdea.trim().toLowerCase()
  if (idea.length > 0 && prompt.toLowerCase() === idea) return 'prompt just echoes the idea'
  prompt = withNoMusicClause(prompt)
  if (prompt.length > SINGLE_SHOT_PROMPT_MAX_CHARS) return `prompt too long (${prompt.length} chars, ${prompt.length - SINGLE_SHOT_PROMPT_TARGET_CHARS} over the ${SINGLE_SHOT_PROMPT_TARGET_CHARS} target; the hard limit is ${SINGLE_SHOT_PROMPT_MAX_CHARS}). Shorten it by cutting detail, keeping every story beat and every spoken line`

  const speakers: SingleShotSpeaker[] = Array.isArray(obj.speakers)
    ? obj.speakers.flatMap((sp): SingleShotSpeaker[] => {
        if (!sp || typeof sp !== 'object') return []
        const label = (sp as Record<string, unknown>).label
        const description = (sp as Record<string, unknown>).description
        return typeof label === 'string' && label.trim()
          ? [{ label: label.trim(), description: typeof description === 'string' ? description.trim() : '' }]
          : []
      })
    : []

  const rawLines = Array.isArray(obj.spoken_lines) ? obj.spoken_lines : []
  const spokenLines: SingleShotSpokenLine[] = rawLines.flatMap((l): SingleShotSpokenLine[] => {
    if (typeof l === 'string') return l.trim() ? [{ speaker: NARRATOR, text: l.trim() }] : []
    if (!l || typeof l !== 'object') return []
    const speaker = (l as Record<string, unknown>).speaker
    const text = (l as Record<string, unknown>).text
    if (typeof text !== 'string' || !text.trim()) return []
    return [{ speaker: typeof speaker === 'string' && speaker.trim() ? speaker.trim() : NARRATOR, text: text.trim() }]
  })
  if (spokenLines.length === 0) return 'spoken_lines is empty: both modes need at least one spoken line'

  const totalWords = spokenLines.reduce((n, l) => n + wordCount(l.text), 0)
  if (totalWords > SINGLE_SHOT_MAX_SPOKEN_WORDS) {
    return `too many spoken words (${totalWords}, max ${SINGLE_SHOT_MAX_SPOKEN_WORDS})`
  }

  // The container photos are attached only when the container is shown, and the prompt must agree.
  if (containerShown === 'none') {
    if (/container/i.test(prompt)) return 'container_shown is "none" but the prompt mentions the container'
    if (/reference images?/i.test(prompt)) return 'container_shown is "none" but the prompt mentions reference images'
  } else if (!/reference images?/i.test(prompt)) {
    return 'container is shown, so the prompt must say it matches the attached reference images'
  }
  const referenceImageUrls = pickContainerReferenceUrls(brand, containerShown)

  // The container itself never arrives, drives or is delivered; it is simply there. (People MAY go in and out of
  // its door in this flow: the doorway crossing checks of the scene pipeline are deliberately not applied.)
  if (containerShown !== 'none' && describesContainerArrival(prompt)) {
    return 'the prompt has the container arriving, driving, parking or being delivered; it is simply there'
  }

  const flatPrompt = flat(prompt)
  for (const line of spokenLines) {
    if (!flatPrompt.includes(flat(line.text))) return `spoken line is not in the prompt word for word: "${line.text}"`
  }

  if (audioMode === 'narration') {
    if (spokenLines.some((l) => flat(l.speaker) !== NARRATOR)) return 'narration lines must all have speaker "narrator"'
    if (!/voice-?over|narrat/i.test(prompt)) return 'narration prompt must say the voice is a voiceover (nobody on screen speaks)'
    if (/lip-?sync/i.test(prompt)) return 'narration prompt must not ask for lip sync'
    return { prompt, audioMode, audioReason: str(obj.audio_reason), hook: str(obj.hook), speakers: [], spokenLines, containerShown, referenceImageUrls, originalIdea }
  }

  // dialogue
  if (speakers.length < 1) return 'dialogue needs at least one speaker in speakers'
  if (speakers.length > SINGLE_SHOT_MAX_SPEAKERS) return `dialogue allows at most ${SINGLE_SHOT_MAX_SPEAKERS} speakers`
  const labels = speakers.map((sp) => flat(sp.label))
  for (const line of spokenLines) {
    if (!labels.includes(flat(line.speaker))) return `line speaker "${line.speaker}" is not in speakers`
    if (wordCount(line.text) > SINGLE_SHOT_MAX_DIALOGUE_LINE_WORDS) {
      return `dialogue line too long (max ${SINGLE_SHOT_MAX_DIALOGUE_LINE_WORDS} words): "${line.text}"`
    }
  }
  for (const label of labels) {
    if (!flatPrompt.includes(label)) return `speaker label "${label}" is not used in the prompt`
  }
  if (!/lip-?sync/i.test(prompt)) return 'dialogue prompt must ask for lip-synced speech from the on-screen speaker'
  return { prompt, audioMode, audioReason: str(obj.audio_reason), hook: str(obj.hook), speakers, spokenLines, containerShown, referenceImageUrls, originalIdea }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export async function enhanceSingleShotPrompt(
  client: SupabaseClient,
  pipelineId: string,
  generation: number,
  generator: ScriptGenerator,
  brand: BrandProfile,
  input: SingleShotPromptInput,
): Promise<EnhancedSingleShotPrompt> {
  const scope = { contentPipelineId: pipelineId }
  const narrationOnly = { requireNarration: input.language === 'BOTH' }

  if (await hasSucceededStep(client, scope, ENHANCE_STEP_NAME, generation)) {
    const cached = await getLastSucceededStepOutput(client, scope, ENHANCE_STEP_NAME, generation)
    const reuse = normalizeEnhancedPrompt(cached, input.idea, brand, narrationOnly)
    if (typeof reuse !== 'string') return { ...reuse, originalIdea: input.idea }
  }

  let lastReason = 'no attempt made'
  for (let attempt = 1; attempt <= MAX_ENHANCE_ATTEMPTS; attempt++) {
    const result = await generator.generate({
      systemPrompt: composeSingleShotSystemPrompt(brand, input.language ?? 'EN'),
      userPrompt: composeSingleShotUserPrompt({ ...input, previousProblem: attempt > 1 ? lastReason : undefined }),
      stepName: ENHANCE_STEP_NAME,
    })
    const checked = normalizeEnhancedPrompt(result.parsed, input.idea, brand, narrationOnly)
    if (typeof checked === 'string') {
      lastReason = checked
      await recordStepAttempt(client, {
        ...scope,
        stepName: ENHANCE_STEP_NAME,
        generation,
        attemptNumber: attempt,
        status: attempt === MAX_ENHANCE_ATTEMPTS ? 'failed_terminal' : 'failed_retryable',
        provider: 'openai',
        errorMessage: checked,
      })
      continue
    }
    await recordStepAttempt(client, {
      ...scope,
      stepName: ENHANCE_STEP_NAME,
      generation,
      attemptNumber: attempt,
      status: 'succeeded',
      provider: 'openai',
      inputSnapshot: { idea: input.idea, aspectRatio: input.aspectRatio },
      outputSnapshot: {
        container_shown: checked.containerShown,
        reference_image_urls: checked.referenceImageUrls,
        audio_mode: checked.audioMode,
        audio_reason: checked.audioReason,
        prompt: checked.prompt,
        hook: checked.hook,
        speakers: checked.speakers,
        spoken_lines: checked.spokenLines,
      },
    })
    return checked
  }
  throw new Error(`single-shot prompt enhancement failed after ${MAX_ENHANCE_ATTEMPTS} attempts: ${lastReason}`)
}
