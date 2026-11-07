// Single-shot BOTH flow: the approved ENGLISH narration is adapted (not translated) into native
// Canadian French at draft time, so the user can read and edit the French at the approval gate
// before any paid render. The same English clip is later re-voiced with these lines.
import type { ScriptGenerator } from '../../adapters/types'
import type { BrandProfile } from '../../prompts/types'

const MAX_ADAPT_ATTEMPTS = 3
/** French runs longer than English: allow a little room per line, tight enough to fit the same time window. */
const FRENCH_LENGTH_FACTOR = 1.15

export function wordCountOf(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Most French words a line may have, given its English original. */
export function frenchLineMaxWords(englishLine: string): number {
  return Math.max(4, Math.ceil(wordCountOf(englishLine) * FRENCH_LENGTH_FACTOR) + 1)
}

export function composeFrenchAdaptSystemPrompt(brand: BrandProfile): string {
  return [
    `You adapt the short English voiceover of a ${brand.name} social video into French. The same video will play with this French voice instead of the English one.`,
    'Adapt, do not translate word for word: keep the same facts, the same order and the same feeling, but write what a native Canadian copywriter would say aloud.',
    "Natural French for a Canadian audience (Canadian vocabulary: faire l'épicerie, courriel, cellulaire, fin de semaine; never France-only terms; no anglicisms; no English idiom carried over).",
    'Keep the narrator in the third person (il, elle, ils), or the same direct address as the English ("tu", casual, never "vous"). Never je, nous or on as the storyteller.',
    `Mention the brand name ${brand.name} exactly as written, only where the English does.`,
    `One French line per English line, in the same order. Each French line has at most the word limit given for it (French runs longer than English, so be concise): the voice has the same time window as the English line.`,
    'Plain, easy-to-say sentences. No invented facts or figures.',
    'The English lines flow into each other as one piece. Keep the same connecting words and images (then, once, so, while, puis, ensuite, quand) so the French reads as one continuous voiceover, not separate captions.',
    '',
    'Reply with strictly valid JSON only: { "lines": ["<French line 1>", "<French line 2>", ...] } with exactly as many lines as the English.',
  ].join('\n')
}

export function composeFrenchAdaptUserPrompt(englishLines: string[], previousProblem?: string): string {
  const lines = englishLines.map((l, i) => `${i + 1}. (max ${frenchLineMaxWords(l)} French words) ${l}`)
  return [
    'English lines to adapt:',
    ...lines,
    ...(previousProblem ? ['', `Your previous reply was rejected: ${previousProblem}. Fix exactly that and reply again.`] : []),
  ].join('\n')
}

/** The French lines from a model reply, or a reason string when the reply is unusable. */
export function normalizeFrenchLines(parsed: unknown, englishLines: string[]): string[] | string {
  const raw = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).lines : undefined
  if (!Array.isArray(raw)) return 'reply must be { "lines": [...] }'
  if (raw.length !== englishLines.length) {
    return `expected ${englishLines.length} lines (one per English line), got ${raw.length}`
  }
  const lines: string[] = []
  for (let i = 0; i < raw.length; i++) {
    const text = typeof raw[i] === 'string' ? (raw[i] as string).trim().replace(/"/g, '') : ''
    if (!text) return `line ${i + 1} is empty`
    const max = frenchLineMaxWords(englishLines[i])
    if (wordCountOf(text) > max) return `line ${i + 1} has ${wordCountOf(text)} words (max ${max}): "${text}"`
    lines.push(text)
  }
  return lines
}

/** Same checks, for lines the user edited on the approval page. */
export function checkEditedFrenchLines(lines: unknown, englishLines: string[]): { lines: string[] } | { error: string } {
  const r = normalizeFrenchLines({ lines }, englishLines)
  return typeof r === 'string' ? { error: `French: ${r}` } : { lines: r }
}

export async function adaptSingleShotFrench(
  generator: ScriptGenerator,
  brand: BrandProfile,
  englishLines: string[],
): Promise<string[]> {
  let lastReason = 'no attempt made'
  for (let attempt = 1; attempt <= MAX_ADAPT_ATTEMPTS; attempt++) {
    const result = await generator.generate({
      systemPrompt: composeFrenchAdaptSystemPrompt(brand),
      userPrompt: composeFrenchAdaptUserPrompt(englishLines, attempt > 1 ? lastReason : undefined),
      stepName: 'single_shot_french',
    })
    const checked = normalizeFrenchLines(result.parsed, englishLines)
    if (typeof checked !== 'string') return checked
    lastReason = checked
  }
  throw new Error(`single-shot French adaptation failed after ${MAX_ADAPT_ATTEMPTS} attempts: ${lastReason}`)
}
