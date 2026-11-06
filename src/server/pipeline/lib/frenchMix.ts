// Single-shot BOTH flow: fit each French line into its time window and build the one ffmpeg command
// that lays the voice (and optionally a background track) onto the already-logoed video, copying the
// video stream untouched (no second re-encode).

export const MAX_TEMPO = 1.25 // faster than this sounds rushed; beyond it the line is flagged instead
const GAP_MS = 150
const TAIL_MS = 300

export interface PlacedLine {
  index: number
  /** Where the line starts in the final audio (ms). */
  startMs: number
  /** atempo applied to the synthesized line (1 = natural). */
  tempo: number
  /** The line's length after the tempo (ms). */
  durationMs: number
}

export interface MixPlan {
  lines: PlacedLine[]
  warnings: string[]
}

/**
 * `naturalMs[i]` is line i's synthesized length, `startMs[i]` where its English line starts.
 * A line that does not fit before the next line is sped up (to MAX_TEMPO); if it still overflows it is
 * kept (never cut) and reported, and a line that would run past the end of the clip is moved earlier.
 */
export function planFrenchMix(naturalMs: number[], startMs: number[], totalMs: number): MixPlan {
  const warnings: string[] = []
  const lines: PlacedLine[] = []
  for (let i = 0; i < naturalMs.length; i++) {
    const nextStart = i + 1 < startMs.length ? startMs[i + 1] : totalMs - TAIL_MS
    const windowMs = Math.max(1, nextStart - startMs[i] - GAP_MS)
    let tempo = naturalMs[i] > windowMs ? Math.min(MAX_TEMPO, naturalMs[i] / windowMs) : 1
    tempo = Math.round(tempo * 100) / 100
    const durationMs = Math.round(naturalMs[i] / tempo)
    let start = startMs[i]
    if (durationMs - windowMs > 100) warnings.push(`line ${i + 1} is ${Math.round(durationMs - windowMs)} ms longer than its window even at ${tempo}x`)
    const latestStart = totalMs - TAIL_MS - durationMs
    if (start > latestStart) {
      start = Math.max(0, latestStart)
      warnings.push(`line ${i + 1} moved earlier to end before the clip does`)
    }
    const prev = lines[i - 1]
    if (prev && start < prev.startMs + prev.durationMs) {
      start = prev.startMs + prev.durationMs + 50
      if (start + durationMs > totalMs) warnings.push(`line ${i + 1} overlaps the previous line and the clip end`)
    }
    lines.push({ index: i, startMs: Math.round(start), tempo, durationMs })
  }
  return { lines, warnings }
}

export interface MixInputs {
  videoPath: string
  linePaths: string[]
  backgroundPath?: string
  outputPath: string
  /** The picture's length (ms): the output never runs longer than this, whatever the audio does. */
  totalMs: number
  plan: MixPlan
  backgroundVolume?: number
}

/** ffmpeg arguments: video copied, voice lines delayed to their start, optional background underneath. */
export function buildFrenchMixArgs(m: MixInputs): string[] {
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', m.videoPath]
  for (const p of m.linePaths) args.push('-i', p)
  if (m.backgroundPath) args.push('-i', m.backgroundPath)

  const filters: string[] = []
  const labels: string[] = []
  m.plan.lines.forEach((l, i) => {
    const tempo = l.tempo !== 1 ? `atempo=${l.tempo},` : ''
    filters.push(`[${i + 1}:a]aresample=44100,${tempo}adelay=${l.startMs}|${l.startMs}[v${i}]`)
    labels.push(`[v${i}]`)
  })
  const voiceCount = labels.length
  filters.push(`${labels.join('')}amix=inputs=${voiceCount}:normalize=0:duration=longest,volume=1.0[voice]`)
  if (m.backgroundPath) {
    const bg = voiceCount + 1
    filters.push(`[${bg}:a]aresample=44100,volume=${m.backgroundVolume ?? 1}[bg]`)
    filters.push('[voice][bg]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95[mix]')
  } else {
    filters.push('[voice]alimiter=limit=0.95[mix]')
  }
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '0:v:0', '-map', '[mix]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-t', (m.totalMs / 1000).toFixed(3), '-movflags', '+faststart',
    m.outputPath,
  )
  return args
}
