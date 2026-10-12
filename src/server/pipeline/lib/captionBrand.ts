// AssemblyAI spells the brand as heard ("FreshCan", "fresh can"), so burned-in
// captions drifted from the written narration (real job a64ab879). Rewrites
// those spellings in the word-timing list to the brand's own name, merging a
// split "fresh"+"can" pair into one word that spans both timings. Pure; any
// input not shaped like a word list is returned untouched. A literal phrase
// "fresh can" is also rewritten — accepted for this brand's narration.
interface TimedWord {
  text: unknown
  start: unknown
  end: unknown
}

function isTimedWord(w: unknown): w is TimedWord {
  return typeof w === 'object' && w !== null && 'text' in w && 'start' in w && 'end' in w
}

// Splits "Can," into core "Can" + trailing punctuation ",".
// A possessive ("Can's") belongs to the trail too, so "Fresh Can's" is still
// recognised as the brand (real job e31d325e's caption read "by Fresh Can's").
function splitPunct(text: string): { core: string; trail: string } {
  const m = text.match(/^(.*?)([^\p{L}\p{N}]*)$/u)
  let core = m?.[1] ?? text
  let trail = m?.[2] ?? ''
  const poss = core.match(/^(.+?)(['\u2019]s)$/i)
  if (poss) {
    core = poss[1]
    trail = poss[2] + trail
  }
  return { core, trail }
}

export function fixBrandNameInWords(
  timingData: unknown,
  brandName: string,
  mishearings: readonly string[] = [],
): unknown {
  if (!Array.isArray(timingData)) return timingData
  const brandKey = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const firstPart = (brandName.split(/[-\s]+/)[0] ?? '').toLowerCase()
  const out: unknown[] = []
  for (let i = 0; i < timingData.length; i++) {
    const w = timingData[i]
    const next = timingData[i + 1]
    if (!isTimedWord(w) || typeof w.text !== 'string') {
      out.push(w)
      continue
    }
    const a = splitPunct(w.text)
    if (a.core.toLowerCase().replace(/[^a-z0-9]/g, '') === brandKey) {
      out.push({ ...w, text: brandName + a.trail })
      continue
    }
    if (isTimedWord(next) && typeof next.text === 'string') {
      const b = splitPunct(next.text)
      const pairKey = (a.core + b.core).toLowerCase().replace(/[^a-z0-9]/g, '')
      const misheard = a.core.toLowerCase() === firstPart && mishearings.includes(b.core.toLowerCase())
      if ((pairKey === brandKey || misheard) && a.trail === '') {
        out.push({ ...w, text: brandName + b.trail, end: next.end })
        i++
        continue
      }
    }
    out.push(w)
  }
  return out
}

// How the brand should be written for the voice model. A hyphenated, all-caps
// name ("Fresh-CAN") is read inconsistently (real job f63f3f5c's last scene was
// transcribed "Fresh Khan"); plain words are read the same way every time.
// "Fresh-CAN" -> "Fresh Can". Text sent to the voice model only — the stored
// narration, captions and everything else keep the real spelling.
export function brandForSpeech(text: string, brandName: string): string {
  const parts = brandName.split(/[-\s]+/).filter(Boolean)
  if (parts.length < 2) return text
  const spoken = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
  const pattern = new RegExp(parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[-\\s]?'), 'gi')
  return text.replace(pattern, spoken)
}
