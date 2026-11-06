// Single-shot BOTH flow: where does each English spoken line start in the real Seedance audio?
// The French voice is placed at the same moments. Timings come from an AssemblyAI transcript of the
// English audio; if the transcript can't be matched to the approved lines (Seedance reworded or
// dropped something), lines are spread over the clip in proportion to their length instead.

export interface TimedWord {
  text: string
  start: number // ms
  end: number // ms
}

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

export function parseTimedWords(raw: unknown): TimedWord[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((w): TimedWord[] => {
    if (!w || typeof w !== 'object') return []
    const { text, start, end } = w as Record<string, unknown>
    return typeof text === 'string' && typeof start === 'number' && typeof end === 'number' ? [{ text, start, end }] : []
  })
}

export interface LineTiming {
  startMs: number[]
  /** 'transcript' when matched against the real audio, 'estimate' when spread by length. */
  source: 'transcript' | 'estimate'
}

/** Proportional spread: each line starts after the previous lines' share of the speaking span. */
export function estimateLineStarts(lines: string[], totalMs: number): number[] {
  const weights = lines.map((l) => Math.max(1, tokenize(l).length))
  const sum = weights.reduce((a, b) => a + b, 0)
  const lead = Math.min(2000, Math.round(totalMs * 0.07)) // the opening hook beat is visual
  const span = Math.max(1, totalMs - lead - 1500)
  let acc = 0
  return weights.map((w) => {
    const start = lead + Math.round((acc / sum) * span)
    acc += w
    return start
  })
}

/**
 * Walks the transcript words in order, giving each English line as many words as it has. A line's
 * start is its first matched word's start. If the transcript's word count is far from the approved
 * lines' (more than 35% off), the audio doesn't match the script and the estimate is used.
 */
export function lineStartsFromTranscript(words: TimedWord[], englishLines: string[], totalMs: number): LineTiming {
  const counts = englishLines.map((l) => tokenize(l).length)
  const expected = counts.reduce((a, b) => a + b, 0)
  const heard = words.filter((w) => tokenize(w.text).length > 0)
  if (heard.length === 0 || expected === 0 || Math.abs(heard.length - expected) / expected > 0.35) {
    return { startMs: estimateLineStarts(englishLines, totalMs), source: 'estimate' }
  }
  const startMs: number[] = []
  let cursor = 0
  for (const n of counts) {
    const w = heard[Math.min(cursor, heard.length - 1)]
    startMs.push(w.start)
    cursor += n
  }
  // Strictly increasing, in case two lines resolved to the same word.
  for (let i = 1; i < startMs.length; i++) if (startMs[i] <= startMs[i - 1]) startMs[i] = startMs[i - 1] + 300
  return { startMs, source: 'transcript' }
}
