// Single-shot narration step: runs BEFORE enhancePrompt. Writes one connected voiceover passage that covers
// every beat of the idea, split into 5-7 spoken lines, and checks it (length, beat coverage, flow). The lines
// are then handed to the video-prompt step as final copy. Cached on pipeline_steps so an Inngest retry never
// pays twice. A dialogue idea or creator-written copy returns { kind: 'skip' } and the old path runs unchanged.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptGenerator } from '../../adapters/types'
import { getLastSucceededStepOutput, hasSucceededStep, recordStepAttempt } from '../../db'
import { SINGLE_SHOT_PACES, type SingleShotJobLanguage, type SingleShotPace } from '../../prompts/singleShot'
import {
  composeNarrationSystemPrompt,
  composeNarrationUserPrompt,
  narrationLineLimits,
  narrationWordRange,
  NARRATION_MIN_LINE_WORDS,
} from '../../prompts/singleShotNarration'
import type { BrandProfile } from '../../prompts/types'
import { promptRequestsMusic } from './enhancePrompt'

export const NARRATION_STEP_NAME = 'single_shot_narration'
const MAX_NARRATION_ATTEMPTS = 3

export type NarrationResult =
  | { kind: 'lines'; lines: string[]; beats: string[]; pace: SingleShotPace; paceReason: string }
  | { kind: 'skip'; reason: string; pace?: SingleShotPace }

const CONNECTORS = new Set([
  'then', 'and', 'so', 'once', 'while', 'after', 'but', 'now', 'until', 'because', 'as', 'when', 'with', 'from',
  'next', 'meanwhile', 'soon', 'before', 'later', 'still', 'together', 'here', 'finally', 'also', 'even',
  // Canadian French connectors, for FR-only narration
  'puis', 'et', 'alors', 'ensuite', 'quand', 'pendant', 'ainsi', 'mais', 'enfin', 'après', 'dès', 'avec',
])
const FILLER = /\b(?:it'?s that simple|so simple|a simple trip|that'?s it|and that'?s)\b/i
const STOP = new Set(['that', 'this', 'with', 'from', 'they', 'them', 'have', 'your', 'will', 'each', 'what', 'when', 'then', 'than', 'into', 'over', 'just', 'more', 'most', 'some', 'such', 'only', 'also', 'been', 'were', 'here', 'there', 'their', 'these', 'those', 'which', 'about', 'every', 'where', 'while', 'would', 'could', 'once'])

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}
function firstWord(text: string): string {
  return (words(text)[0] ?? '').toLowerCase().replace(/[^\p{L}]/gu, '')
}
function contentWords(text: string): Set<string> {
  return new Set(
    words(text)
      .map((w) => w.toLowerCase().replace(/[^\p{L}]/gu, '').replace(/s$/, ''))
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  )
}

/** True when line `b` visibly continues line `a`: it opens with a connector or repeats one of a's content words. */
export function continuesPrevious(a: string, b: string): boolean {
  if (CONNECTORS.has(firstWord(b))) return true
  const prev = contentWords(a)
  for (const w of contentWords(b)) if (prev.has(w)) return true
  return false
}

/** Parsed narration, or a reason string when the reply is unusable. */
export function normalizeNarration(parsed: unknown, language: SingleShotJobLanguage, brand: BrandProfile): NarrationResult | string {
  if (!parsed || typeof parsed !== 'object') return 'reply was not a JSON object'
  const obj = parsed as Record<string, unknown>
  const kind = obj.kind
  if (kind !== 'narration' && kind !== 'dialogue' && kind !== 'creator_copy') return 'kind must be "narration", "dialogue" or "creator_copy"'
  const rawPace = obj.pace
  const pace = (SINGLE_SHOT_PACES as readonly unknown[]).includes(rawPace) ? (rawPace as SingleShotPace) : undefined
  if (kind === 'creator_copy') return { kind: 'skip', reason: 'the idea already contains finished spoken copy', pace }
  if (kind === 'dialogue') {
    // A BOTH clip is re-voiced in French, so it can only be a voiceover.
    if (language === 'BOTH') return 'this clip is also released in French with a new voice, so kind must be "narration"; retell any conversation as a voiceover'
    return { kind: 'skip', reason: 'the idea is a conversation, which the video prompt step voices as dialogue', pace }
  }

  if (!pace) return 'pace must be "calm", "balanced" or "brisk", decided from the idea\'s tone and amount of story'
  const paceReason = typeof obj.pace_reason === 'string' ? obj.pace_reason.trim() : ''

  const beats = Array.isArray(obj.beats) ? obj.beats.filter((b): b is string => typeof b === 'string' && b.trim() !== '').map((b) => b.trim()) : []
  if (beats.length < 2 || beats.length > 8) return `list between 2 and 8 beats (got ${beats.length})`

  const raw = Array.isArray(obj.lines) ? obj.lines : []
  const lines: { text: string; beat: number }[] = []
  for (const l of raw) {
    if (!l || typeof l !== 'object') continue
    const text = (l as Record<string, unknown>).text
    const beat = (l as Record<string, unknown>).beat_index
    if (typeof text !== 'string' || !text.trim()) continue
    lines.push({ text: text.trim().replace(/"/g, ''), beat: typeof beat === 'number' ? beat : -1 })
  }
  const limits = narrationLineLimits(language, pace)
  if (lines.length < limits.minLines || lines.length > limits.maxLines) {
    return `a ${pace} narration has ${limits.minLines}-${limits.maxLines} spoken lines (got ${lines.length})`
  }

  for (const l of lines) {
    const n = words(l.text).length
    if (n < NARRATION_MIN_LINE_WORDS) return `line is a bare label (${n} words), write a full sentence: "${l.text}"`
    if (n > limits.maxLineWords) return `line too long (${n} words, max ${limits.maxLineWords}): "${l.text}"`
    if (!/[.!?…]["»”']?$/.test(l.text)) return `line must end with punctuation: "${l.text}"`
    if (FILLER.test(l.text)) return `filler line, state a concrete fact instead: "${l.text}"`
    if (promptRequestsMusic(l.text)) return `the narration must not mention music: "${l.text}"`
    const banned = brand.bannedWords.find((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(l.text))
    if (banned) return `banned word "${banned}" in: "${l.text}"`
  }

  const { min, max } = narrationWordRange(language, pace)
  const total = lines.reduce((n, l) => n + words(l.text).length, 0)
  if (total < min) return `too few spoken words for a ${pace} narration (${total}, need ${min}-${max}): add concrete detail from the idea, or choose a calmer pace if the idea is calm. Do not pad`
  if (total > max) return `too many spoken words for a ${pace} narration (${total}, need ${min}-${max}): tighten the lines, or choose a brisker pace only if the idea is busy`

  const covered = new Set(lines.map((l) => l.beat))
  const missing = beats.findIndex((_, i) => !covered.has(i))
  if (missing !== -1) return `no line covers the beat "${beats[missing]}": every beat of the idea needs a line (use beat_index)`

  let continuing = 0
  for (let i = 1; i < lines.length; i++) {
    if (firstWord(lines[i].text) === firstWord(lines[i - 1].text)) return `lines ${i} and ${i + 1} start with the same word: vary the openers`
    if (continuesPrevious(lines[i - 1].text, lines[i].text)) continuing++
  }
  const needed = Math.ceil((lines.length - 1) / 2)
  if (continuing < needed) {
    return `the lines read as separate captions (${continuing} of ${lines.length - 1} continue the previous line, need ${needed}): link them with connecting words or a repeated image`
  }

  return { kind: 'lines', lines: lines.map((l) => l.text), beats, pace, paceReason }
}

export async function writeSingleShotNarration(
  client: SupabaseClient,
  pipelineId: string,
  generation: number,
  generator: ScriptGenerator,
  brand: BrandProfile,
  input: { idea: string; topic: string; language: SingleShotJobLanguage },
): Promise<NarrationResult> {
  const scope = { contentPipelineId: pipelineId }

  if (await hasSucceededStep(client, scope, NARRATION_STEP_NAME, generation)) {
    const cached = await getLastSucceededStepOutput(client, scope, NARRATION_STEP_NAME, generation)
    const reuse = normalizeNarration(cached, input.language, brand)
    if (typeof reuse !== 'string') return reuse
  }

  let lastReason = 'no attempt made'
  for (let attempt = 1; attempt <= MAX_NARRATION_ATTEMPTS; attempt++) {
    const result = await generator.generate({
      systemPrompt: composeNarrationSystemPrompt(brand, input.language),
      userPrompt: composeNarrationUserPrompt({ idea: input.idea, topic: input.topic, previousProblem: attempt > 1 ? lastReason : undefined }),
      stepName: NARRATION_STEP_NAME,
    })
    const checked = normalizeNarration(result.parsed, input.language, brand)
    if (typeof checked === 'string') {
      lastReason = checked
      await recordStepAttempt(client, {
        ...scope,
        stepName: NARRATION_STEP_NAME,
        generation,
        attemptNumber: attempt,
        status: attempt === MAX_NARRATION_ATTEMPTS ? 'failed_terminal' : 'failed_retryable',
        provider: 'openai',
        errorMessage: checked,
      })
      continue
    }
    await recordStepAttempt(client, {
      ...scope,
      stepName: NARRATION_STEP_NAME,
      generation,
      attemptNumber: attempt,
      status: 'succeeded',
      provider: 'openai',
      inputSnapshot: { idea: input.idea, language: input.language },
      // Stored in the same shape the model replies in, so a cached read goes through normalizeNarration again.
      outputSnapshot:
        checked.kind === 'lines'
          ? { kind: 'narration', beats: checked.beats, pace: checked.pace, pace_reason: checked.paceReason, lines: checked.lines.map((text, i) => ({ text, beat_index: beatIndexFor(parsedLines(result.parsed)[i]) })) }
          : { kind: 'creator_copy', beats: [], lines: [], pace: checked.pace },
    })
    return checked
  }
  throw new Error(`single-shot narration failed after ${MAX_NARRATION_ATTEMPTS} attempts: ${lastReason}`)
}

function parsedLines(parsed: unknown): unknown[] {
  const l = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).lines : undefined
  return Array.isArray(l) ? l : []
}
function beatIndexFor(line: unknown): number {
  const b = line && typeof line === 'object' ? (line as Record<string, unknown>).beat_index : undefined
  return typeof b === 'number' ? b : 0
}
