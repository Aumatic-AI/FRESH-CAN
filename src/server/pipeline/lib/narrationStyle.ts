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
  /** Phrases the video's first line must not start with (lowercase). */
  openers?: readonly string[]
  /** Phrases the last scene must not contain (lowercase). */
  closers?: readonly string[]
  /** Word cap for the first scene's line (the spoken hook). Pass it only
   *  when the scene's word band allows it. */
  hookMaxWords?: number
  /** What each scene shows, by scene number. English only: it is compared
   *  word by word, so pass it for English narration. */
  onScreen?: ReadonlyMap<number, string>
}

type Scene = { scene_number: number; narration_text: string }

const FIRST_PERSON = /\b(?:i|i'm|i’m|i've|i’ve|i'd|i’d|i'll|i’ll|me|my|mine|we|we're|we’re|we've|we’ve|we'd|we’d|we'll|we’ll|us|our|ours|je|j'|moi|nous|notre|nos|mon|ma|mes)(?![\p{L}])/iu
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

const STOP = new Set(
  ('about above after again also because before being between both could does doing down during each from have ' +
    'having here into just like more most much only other over same shall should some such than that their them ' +
    'then there these they this those through under until very were what when where which while will with would ' +
    'your yours still even ever never every always almost already really quite once').split(' '),
)

function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w))
}

/** Share of the line's content words that the picture description already
 *  contains; a high share means the line only describes what is on screen. */
export function echoShare(narration: string, onScreen: string): number {
  const words = contentWords(narration)
  if (words.length < 5) return 0
  const seen = new Set(contentWords(onScreen).map((w) => w.replace(/(?:ing|ed|es|s)$/, '')))
  const hit = words.filter((w) => seen.has(w.replace(/(?:ing|ed|es|s)$/, ''))).length
  return hit / words.length
}

const ECHO_LIMIT = 0.6

/** Problems per scene (scene_number -> short human-readable notes). Scenes with none are absent. */
export function findNarrationStyleIssues(scenes: readonly Scene[], opts: NarrationStyleOptions = {}): Map<number, string[]> {
  const issues = new Map<number, string[]>()
  const add = (n: number, note: string) => issues.set(n, [...(issues.get(n) ?? []), note])
  const ordered = [...scenes].sort((a, b) => a.scene_number - b.scene_number)

  let contrastSeen = false
  const factSeen = new Set<string>()
  const lastScene = ordered.length > 0 ? ordered[ordered.length - 1].scene_number : -1
  for (const { scene_number: n, narration_text: text } of ordered) {
    const lowerStart = text.trim().toLowerCase()
    const opener = n === ordered[0]?.scene_number ? (opts.openers ?? []).find((o) => lowerStart.startsWith(o)) : undefined
    if (opener) add(n, `opens with "${opener.trim()}", a stock opener; start on the specific moment instead`)
    if (opts.hookMaxWords && n === ordered[0]?.scene_number && narrationWordCount(text) > opts.hookMaxWords) {
      add(n, `is the hook and runs past ${opts.hookMaxWords} words; cut it to its most specific image`)
    }
    const closer = n === lastScene ? (opts.closers ?? []).find((c) => lowerStart.includes(c)) : undefined
    if (closer) add(n, `ends on the slogan-like "${closer}"; end on a small concrete moment instead`)
    const shown = opts.onScreen?.get(n)
    if (shown && echoShare(text, shown) >= ECHO_LIMIT) {
      add(n, 'mostly repeats what the picture shows; add what the viewer cannot see (a thought, a worry, a reason)')
    }
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
