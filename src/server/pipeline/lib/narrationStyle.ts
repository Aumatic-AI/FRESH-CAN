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
  /** First lines of recent videos: this video's opening must not echo one. */
  recentOpeners?: readonly string[]
  /** Promo voiceover: speaks to the viewer; narrating the character (she/he/they + action) is a defect after the first scene. */
  promo?: boolean
  /** Vague mood-filler phrases (lowercase) that say nothing concrete. */
  vaguePhrases?: readonly string[]
  /** Nouns the closing line should not lean on (lowercase): it lands on a concrete image. */
  abstractNouns?: readonly string[]
  /** The brand's name: said once in the whole video, so a later mention is flagged. */
  brandName?: string
  /** What each scene shows, by scene number. English only: it is compared
   *  word by word, so pass it for English narration. */
  onScreen?: ReadonlyMap<number, string>
}

type Scene = { scene_number: number; narration_text: string }

const FIRST_PERSON = /(?<![\p{L}])(?:i|i'm|i’m|i've|i’ve|i'd|i’d|i'll|i’ll|me|my|mine|we|we're|we’re|we've|we’ve|we'd|we’d|we'll|we’ll|us|our|ours|je|j'|moi|nous|notre|nos|mon|ma|mes)(?![\p{L}])/iu
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
  // "No plans, no deadlines, just her": a rhetorical run, not a bare list of items.
  if (parts.slice(0, 3).filter((p) => /^(?:no|not|never|just|only|pas|sans|juste|aucun)\b/i.test(p)).length >= 2) return false
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

const SHORT = 5

const words = (t: string) => norm(t).replace(/[^\p{L}\p{N}'\s-]/gu, ' ').split(/\s+/).filter(Boolean)

/** True when two opening lines are the same move: the same first three words,
 *  or most of their content words in common. */
export function openersEcho(a: string, b: string): boolean {
  const wa = words(a)
  const wb = words(b)
  if (wa.length >= 3 && wb.length >= 3 && wa.slice(0, 3).join(' ') === wb.slice(0, 3).join(' ')) return true
  const ca = new Set(contentWords(a))
  const cb = new Set(contentWords(b))
  if (ca.size < 3 || cb.size < 3) return false
  const shared = [...ca].filter((w) => cb.has(w)).length
  return shared / Math.min(ca.size, cb.size) >= 0.6
}

/** A scene chopped into three or more short sentences ("She stops. The phone
 *  buzzes. She waits."): joins of related thoughts read better aloud. */
function isChoppy(text: string): boolean {
  const ss = sentences(text)
  if (ss.length < 3) return false
  return narrationWordCount(text) / ss.length < 6
}

/** Whole-video rhythm: more than half of all sentences are very short, so the
 *  track sounds like a row of separate slogans even when no scene is choppy. */
function stopStartScenes(scenes: readonly Scene[]): Set<number> {
  const all = scenes.flatMap((s) => sentences(s.narration_text))
  if (all.length < 6) return new Set()
  const short = all.filter((s) => narrationWordCount(s) <= SHORT).length
  if (short / all.length <= 0.5) return new Set()
  return new Set(
    scenes
      .filter((s) => {
        const ss = sentences(s.narration_text)
        return ss.length >= 2 && ss.every((x) => narrationWordCount(x) <= SHORT)
      })
      .map((s) => s.scene_number),
  )
}

const norm = (t: string) => t.toLowerCase().replace(/[’‘]/g, "'")
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A stock phrase at a word start, so "vibe" also catches "vibes" but not "provibe". */
function usesPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(?<![\\p{L}])${escapeRe(norm(phrase.trim()))}`, 'iu').test(norm(text))
}
function usesWord(text: string, word: string): boolean {
  return new RegExp(`(?<![\\p{L}])${escapeRe(norm(word))}(?![\\p{L}])`, 'iu').test(norm(text))
}

/** The closing line states a moral instead of showing a moment. */
const MORAL = /\b(?:reminds? us|teaches? us|proves? that|the real (?:magic|meaning)|that's what .{1,30} (?:is )?(?:all )?about|nous rappelle|c'est ça,? (?:le|la) vrai)\b/i

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
export function echoShare(narration: string, onScreen: string, minWords = 5): number {
  const words = contentWords(narration)
  if (words.length < minWords) return 0
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

  const stopStart = stopStartScenes(ordered)
  // A word leaned on in four or more scenes ("whole trip", "whole outing"...) makes the track repeat itself.
  const sceneCount = new Map<string, number[]>()
  for (const sc of ordered) {
    for (const w of new Set(contentWords(sc.narration_text).filter((x) => x.length >= 5).map((x) => x.replace(/(?:ing|ed|es|s)$/, '')))) {
      sceneCount.set(w, [...(sceneCount.get(w) ?? []), sc.scene_number])
    }
  }
  const leaned = new Map<number, string>()
  for (const [w, ns] of sceneCount) if (ns.length >= 4) for (const n of ns.slice(3)) leaned.set(n, w)
  let brandSeen = 0
  let promoCharacterOpeners = 0
  let contrastSeen = false
  const factSeen = new Set<string>()
  const lastScene = ordered.length > 0 ? ordered[ordered.length - 1].scene_number : -1
  for (const { scene_number: n, narration_text: text } of ordered) {
    const lowerStart = text.trim().toLowerCase()
    const opener = n === ordered[0]?.scene_number ? (opts.openers ?? []).find((o) => lowerStart.startsWith(o)) : undefined
    if (opener) add(n, `opens with "${opener.trim()}", a stock opener; start on the specific moment instead`)
    const echoed = n === ordered[0]?.scene_number ? (opts.recentOpeners ?? []).find((o) => openersEcho(text, o)) : undefined
    if (echoed) add(n, `opens the same way as a recent video ("${echoed.slice(0, 60)}"); find a different way in`)
    if (opts.hookMaxWords && n === ordered[0]?.scene_number && narrationWordCount(text) > opts.hookMaxWords) {
      add(n, `is the hook and runs past ${opts.hookMaxWords} words; cut it to its most specific image`)
    }
    const closer = n === lastScene ? (opts.closers ?? []).find((c) => lowerStart.includes(c)) : undefined
    if (closer) add(n, `ends on the slogan-like "${closer}"; end on a small concrete moment instead`)
    const shown = opts.onScreen?.get(n)
    if (shown && (echoShare(text, shown) >= ECHO_LIMIT || sentences(text).some((x) => echoShare(x, shown, 4) >= ECHO_LIMIT))) {
      add(n, 'mostly repeats what the picture shows; add what the viewer cannot see (a thought, a worry, a reason)')
    }
    if (/[;:]/.test(text)) add(n, 'uses a semicolon or colon (speech does not; use a full stop or a comma)')
    if (FIRST_PERSON.test(text)) add(n, 'uses I / we / our: the narrator tells the story in the third person and is never a character')
    if (QUOTE.test(text)) add(n, 'quotes dialogue: people never speak on camera, so narrate it instead')
    const tell = (opts.tells ?? []).find((t) => usesPhrase(text, t))
    if (tell) add(n, `uses the stock phrase "${tell}"; say it a fresher, more specific way`)
    const vague = (opts.vaguePhrases ?? []).find((v) => usesPhrase(text, v))
    if (vague) add(n, `is vague mood filler ("${vague}"); say what she does or thinks, with one concrete detail`)
    if (sentences(text).some(hasItemList)) add(n, 'is a bare list of items; fold them into a sentence with a verb')
    if (hasTelegraphicRun(text)) add(n, 'is a run of very short fragments; make it flow like speech')
    else if (isChoppy(text)) add(n, 'is chopped into three or more tiny sentences; join the related thoughts with commas or a connector so it flows')
    else if (stopStart.has(n)) add(n, 'is part of a stop-start rhythm (most lines in the video are tiny full-stop sentences); join its thoughts into one flowing sentence')
    if (n === lastScene) {
      const abstract = (opts.abstractNouns ?? []).find((w) => usesWord(text, w))
      if (abstract) add(n, `ends on the abstract "${abstract}"; land on a concrete image the viewer can see`)
      if (MORAL.test(norm(text))) add(n, 'ends on a moral or summary; end on a small concrete moment instead')
    }
    const lean = leaned.get(n)
    if (lean) add(n, `leans on "${lean}" again (it is already in three earlier scenes); say it another way or leave it out`)
    if (opts.promo && /^(?:she|he|they|her|his|their|elle|il|ils|elles)\b/i.test(text.trim())) {
      promoCharacterOpeners++
      if (promoCharacterOpeners > 1) add(n, 'narrates the character; in a promo voiceover speak to the viewer ("you") and let the picture show the person')
    }
    if (opts.brandName) {
      const mentions = text.match(new RegExp(escapeRe(opts.brandName), 'gi'))?.length ?? 0
      if (mentions > 0) {
        brandSeen += mentions
        if (brandSeen > 1) add(n, `says ${opts.brandName} again; the name is said once in the whole video`)
      }
    }
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
