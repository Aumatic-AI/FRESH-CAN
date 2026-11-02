// Code-side check for narration that reads as machine-written. Pure and
// language-aware (the punctuation / rhythm / pronoun rules apply to EN and FR;
// phrase lists come from the brand file). Used by localizeScript.ts's last
// corrective pass: a flagged scene is rewritten once and the rewrite is kept only
// if it has fewer problems AND fits its word band no worse — so this can never
// disturb audio/video timing (see writeNarration).
import { narrationWordCount } from '../../../lib/videoNarrationBudget'

export interface NarrationStyleOptions {
  /** Brand clichés / slogan-like phrases (lowercase). */
  tells?: readonly string[]
  /** Facts that may be stated in only one scene of the video. */
  hardFacts?: readonly { label: string; pattern: string }[]
}

type Scene = { scene_number: number; narration_text: string }

const FIRST_PERSON = /\b(?:i|i'm|i’m|i've|i’ve|i'd|i’d|i'll|i’ll|me|my|mine|we|we're|we’re|we've|we’ve|we'd|we’d|we'll|we’ll|us|our|ours|je|j'|nous|notre|nos|mon|ma|mes)(?![\p{L}])/iu
const CONTRAST = /(?:,|—|–)\s*(?:not|never|pas)\s+\p{L}+|\b(?:isn't|isn’t|wasn't|wasn’t|not just|n'est pas)\b[^.!?]{0,40}\b(?:it's|it’s|but|c'est|mais)\b/iu
const QUOTE = /["“”«»]/

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean)
}

/** Three or more short comma-separated items in one sentence ("Butter, herbs, cranberries."). */
function hasItemList(sentence: string): boolean {
  const body = sentence.replace(/[.!?…]+$/, '')
  const parts = body.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return false
  return parts.slice(0, 3).every((p) => narrationWordCount(p.replace(/^(?:and|et)\s+/i, '')) <= 3)
}

/** Three or more very short sentences in a row: reads as a telegram, not speech. */
function hasTelegraphicRun(text: string): boolean {
  let run = 0
  for (const s of sentences(text)) {
    run = narrationWordCount(s) <= 4 ? run + 1 : 0
    if (run >= 3) return true
  }
  return false
}

/** Problems per scene (scene_number -> short human-readable notes). Scenes with none are absent. */
export function findNarrationStyleIssues(scenes: readonly Scene[], opts: NarrationStyleOptions = {}): Map<number, string[]> {
  const issues = new Map<number, string[]>()
  const add = (n: number, note: string) => issues.set(n, [...(issues.get(n) ?? []), note])
  const ordered = [...scenes].sort((a, b) => a.scene_number - b.scene_number)

  let contrastSeen = false
  const factSeen = new Set<string>()
  for (const { scene_number: n, narration_text: text } of ordered) {
    if (/[;:]/.test(text)) add(n, 'uses a semicolon or colon (speech does not; use a full stop or a comma)')
    if (FIRST_PERSON.test(text)) add(n, 'uses I / we / our: the narrator tells the story in the third person and is never a character')
    if (QUOTE.test(text)) add(n, 'quotes dialogue: people never speak on camera, so narrate it instead')
    const lower = text.toLowerCase()
    const tell = (opts.tells ?? []).find((t) => lower.includes(t.toLowerCase()))
    if (tell) add(n, `uses the stock phrase "${tell}"; say it a fresher, more specific way`)
    if (sentences(text).some(hasItemList)) add(n, 'is a bare list of items; fold them into a sentence with a verb')
    if (hasTelegraphicRun(text)) add(n, 'is a run of very short fragments; make it flow like speech')
    if (CONTRAST.test(text)) {
      if (contrastSeen) add(n, 'repeats the "X, not Y" contrast already used in an earlier scene')
      contrastSeen = true
    }
    for (const f of opts.hardFacts ?? []) {
      if (!new RegExp(f.pattern, 'i').test(text)) continue
      if (factSeen.has(f.label)) add(n, `repeats ${f.label}, which an earlier scene already covered; leave it out here`)
      factSeen.add(f.label)
    }
  }
  return issues
}
