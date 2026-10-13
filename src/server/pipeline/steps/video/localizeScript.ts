import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScriptGenerator } from '../../adapters/types'
import {
  claimTrack,
  hasSucceededStep,
  recordStepAttempt,
  recordTrackRetryableFailure,
  markTrackFailed,
  getVideoScenes,
  getMeasuredWordsPerSecond,
  upsertVideoSceneAudio,
  type TrackRow,
  type VideoSceneRow,
} from '../../db'
import { hasExceededMaxAttempts, isReadyToRetry, MAX_ATTEMPTS } from '../../lib/backoff'
import { BRAND_PROFILE, composeLocalizeScriptSystemPrompt } from '../../prompts/index'
import {
  NARRATION_WORDS_PER_SECOND,
  narrationWordCount,
  narrationWordRange,
  readSceneNarration,
  resolveWordsPerSecond,
} from '../../../../lib/videoNarrationBudget'

// Word-band constants (MIN_FILL/MAX_FILL) and narrationWordRange live in
// lib/videoNarrationBudget.ts, shared with the dashboard editor and the edit
// route; a finished video's length is the SUM of its scenes' real narration
// lengths, so the band is enforced rather than just requested.
export { narrationWordRange }

// Narration that describes anyone crossing the unit's threshold. The visuals
// never show it (NO_ENTRY_EXIT_RULE), so a voiceover saying it contradicts the
// picture — real job 790b8771's scene 4 said the student "enters the unit with
// a quick scan ... and walks out" over a clip showing neither. Deliberately
// narrow: "arrives", "shops", "leaves with" are all fine; only verbs for the
// crossing itself match.
const CROSSING_PATTERNS: readonly RegExp[] = [
  /\b(?:enter|enters|entered|entering)\b/i,
  /\b(?:exit|exits|exited|exiting)\b/i,
  /\b(?:step|steps|stepped|stepping)\s+(?:in|out|inside|into|through)\b/i,
  /\b(?:walk|walks|walked|walking)\s+(?:in|out|into|inside)\b/i,
  /\b(?:go|goes|went|going)\s+(?:in|inside|into)\b/i,
  /\b(?:rush|rushes|rushed|rushing|head|heads|headed|heading)\s+(?:in|inside|into)\b/i,
  /\b(?:climb|climbs|climbed|climbing|jump|jumps|jumped|jumping)\s+(?:in|into|out|from|inside|down)\b/i,
  /\b(?:come|comes|came|coming|emerge|emerges|emerged|emerging)\s+(?:out|from)\b/i,
  /\bre-?emerg(?:e|es|ed|ing)\b/i, // "reemerges" has no out/from after it
  // French
  /\b(?:entre|entrent|entrer|entrant|entré|entrée|entrés)\s+(?:dans|à l'intérieur)\b/i,
  /\b(?:sort|sortent|sortir|sortant|sorti|sortie|sortis)\s+(?:de|du|d')/i,
  /\b(?:monte|montent|monter|descend|descendent|descendre)\s+(?:dans|à bord|de|du)\b/i,
]

// Extra phrasings for the visual check only (narration keeps the narrower
// list above, since it has no unit-word proximity guard). Each still has to
// sit within 40 chars of a unit word to count, so "heads out onto the street"
// is not flagged. Added after "exit the unit" proved too narrow a net: the
// image model draws a door wherever the scene text puts a crossing.
const VISUAL_CROSSING_PATTERNS: readonly RegExp[] = [
  /\b(?:leave|leaves|left|leaving)\s+(?:the\s+)?(?:fresh[- ]?can\s+)?(?:unit|truck|vehicle|container)\b/i,
  /\bout\s+of\s+(?:the\s+)?(?:fresh[- ]?can\s+)?(?:unit|truck|vehicle|container)\b/i,
  /\b(?:through|past)\s+(?:the\s+)?(?:\w+\s+){0,2}(?:door|doors|doorway|entrance)\b/i,
  /\b(?:hop|hops|hopped|hopping|board|boards|boarded|boarding)\s+(?:on\s*board|aboard|onto|on|into)\b/i,
  /\b(?:climb|climbs|climbed|climbing|step|steps|stepped|stepping)\s+(?:off|down\s+from|onto|up\s+into)\b/i,
  /\b(?:head|heads|headed|heading|walk|walks|walked|walking|come|comes|came|coming)\s+out\b/i,
  /\b(?:sortir|sort|sortent)\b/i,
]

const UNIT_WORDS = /\b(?:unit|truck|vehicle|container|fresh[- ]?can|camion|unité)\b/i

/** Visual-text variant: a crossing verb within 40 characters of a word for the
 *  unit ("exit the unit"), so a home or street exit ("steps out onto the
 *  street") never matches. */
export function visualDescribesUnitCrossing(text: string): boolean {
  return [...CROSSING_PATTERNS, ...VISUAL_CROSSING_PATTERNS].some((pattern) => {
    const g = new RegExp(pattern.source, 'gi')
    for (let m = g.exec(text); m; m = g.exec(text)) {
      const around = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)
      if (UNIT_WORDS.test(around)) return true
    }
    return false
  })
}

export function narrationDescribesCrossing(text: string): boolean {
  return CROSSING_PATTERNS.some((pattern) => pattern.test(text))
}

/** Scene numbers whose narration describes entering/exiting the unit. */
export function findCrossingScenes(localized: readonly { scene_number: number; narration_text: string }[]): number[] {
  return localized.filter((l) => narrationDescribesCrossing(l.narration_text)).map((l) => l.scene_number)
}

/** True when the narration writes the brand possessively ("Fresh-CAN's") or
 *  plural. Speech-to-text hears the possessive plus the next word as a
 *  different word (real job da0662d8: "Fresh-CAN's ease" -> "Fresh Kansis"). */
export function narrationUsesBrandPossessive(text: string, brandName: string): boolean {
  const parts = brandName.split(/[-\s]+/).filter(Boolean).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (parts.length === 0) return false
  return new RegExp(`${parts.join('[-\\s]?')}(?:['\u2019]s?|s)\\b`, 'i').test(text)
}

export function findPossessiveBrandScenes(
  localized: readonly { scene_number: number; narration_text: string }[],
  brandName: string,
): number[] {
  return localized.filter((l) => narrationUsesBrandPossessive(l.narration_text, brandName)).map((l) => l.scene_number)
}

/** How far outside its word band a narration sits, in words (0 = inside).
 *  Over-long is tolerated up to OVER_TOLERANCE x max: a slightly long scene
 *  just lengthens the video, but a far-too-long one gets sentence-chopped by
 *  transcribeAudio.ts's overshoot correction — which collapsed real job
 *  8e92b381's 24-word narration for a 5s slot down to 5 words (1.6s) after
 *  a paid synthesis. Rewriting it here, as text, is free of that cliff. */
const OVER_TOLERANCE = 1.05

function bandDistance(words: number, targetDurationMs: number, wordsPerSecond = NARRATION_WORDS_PER_SECOND): number {
  const { min, max } = narrationWordRange(targetDurationMs, wordsPerSecond)
  if (words < min) return min - words
  const hardMax = Math.floor(max * OVER_TOLERANCE)
  return words > hardMax ? words - hardMax : 0
}

/** Scene numbers whose narration is far too short OR far too long for its slot. */
export function findOffBandScenes(
  scenes: readonly { scene_number: number; target_duration_ms: number }[],
  localized: readonly { scene_number: number; narration_text: string }[],
  wordsPerSecond = NARRATION_WORDS_PER_SECOND,
): number[] {
  return scenes
    .filter((scene) => {
      const match = localized.find((l) => l.scene_number === scene.scene_number)
      return (
        !!match && bandDistance(narrationWordCount(match.narration_text), scene.target_duration_ms, wordsPerSecond) > 0
      )
    })
    .map((scene) => scene.scene_number)
}

/** Whether `candidate` is strictly closer to the slot's word band than `current`. */
export function isBetterFit(
  current: string,
  candidate: string,
  targetDurationMs: number,
  wordsPerSecond = NARRATION_WORDS_PER_SECOND,
): boolean {
  return (
    bandDistance(narrationWordCount(candidate), targetDurationMs, wordsPerSecond) <
    bandDistance(narrationWordCount(current), targetDurationMs, wordsPerSecond)
  )
}

interface LocalizedScene {
  scene_number: number
  narration_text: string
}

function isValidLocalizeOutput(parsed: unknown, expectedCount: number): parsed is { scenes: LocalizedScene[] } {
  if (!parsed || typeof parsed !== 'object') return false
  const scenes = (parsed as Record<string, unknown>).scenes
  if (!Array.isArray(scenes) || scenes.length !== expectedCount) return false
  return scenes.every((s) => {
    if (!s || typeof s !== 'object') return false
    const scene = s as Record<string, unknown>
    return typeof scene.scene_number === 'number' && typeof scene.narration_text === 'string'
  })
}

/**
 * Writes spoken narration for every scene in `language`, from each scene's
 * narration_intent (or, for a non-English language, by translating the
 * user-approved English narration when one exists), sized to each scene's word
 * band, then runs the corrective text-only passes (off-band length, unit
 * crossing, possessive brand name). Shared by runLocalizeScript and the
 * draft-time narration step (draftNarration.ts). Throws if the model output
 * has the wrong shape; every corrective pass is best-effort.
 */
export async function writeNarration(
  scriptGenerator: ScriptGenerator,
  scenes: readonly VideoSceneRow[],
  opts: { language: 'English' | 'French'; wordsPerSecond: number; sceneNotes?: string | null },
): Promise<LocalizedScene[]> {
  const { wordsPerSecond } = opts
  const systemPrompt = composeLocalizeScriptSystemPrompt(BRAND_PROFILE, {
    language: opts.language,
    wordsPerSecond,
    sceneNotes: opts.sceneNotes,
  })
  const sceneRequest = (s: (typeof scenes)[number], extra: Record<string, unknown> = {}) => {
    const range = narrationWordRange(s.target_duration_ms, wordsPerSecond)
    const approved = readSceneNarration(s.narration_intent).trim()
    return {
      scene_number: s.scene_number,
      narration_intent: (s.narration_intent as { text?: string } | null)?.text ?? s.narration_intent,
      ...(approved && opts.language !== 'English' ? { approved_english_narration: approved } : {}),
      on_screen: s.visual_description,
      target_duration_seconds: Math.round(s.target_duration_ms / 1000),
      min_words: range.min,
      max_words: range.max,
      ...extra,
    }
  }

  const result = await scriptGenerator.generate({
    systemPrompt,
    userPrompt: JSON.stringify(scenes.map((s) => sceneRequest(s))),
    stepName: 'localize_script',
  })

  if (!isValidLocalizeOutput(result.parsed, scenes.length)) {
    throw new Error('localize_script: model output did not match the required JSON shape')
  }
  let localized = result.parsed.scenes

  // Corrective text-only passes (cheap LLM calls — no ElevenLabs/KIE
  // spend). Each is best-effort: never throws, only swaps in a rewrite that
  // is actually better, and a still-off result is accepted rather than
  // failing the track.
  const rewriteScenes = async (
    sceneNumbers: number[],
    extra: (sceneNumber: number) => Record<string, unknown>,
    accept: (current: string, candidate: string, targetDurationMs: number) => boolean,
  ): Promise<void> => {
    try {
      const retry = await scriptGenerator.generate({
        systemPrompt,
        userPrompt: JSON.stringify(
          scenes.filter((s) => sceneNumbers.includes(s.scene_number)).map((s) => sceneRequest(s, extra(s.scene_number))),
        ),
        stepName: 'localize_script',
      })
      if (!isValidLocalizeOutput(retry.parsed, sceneNumbers.length)) return
      const fixed = retry.parsed.scenes
      localized = localized.map((l) => {
        const f = fixed.find((x) => x.scene_number === l.scene_number)
        const target = scenes.find((x) => x.scene_number === l.scene_number)?.target_duration_ms ?? 0
        return f && accept(l.narration_text, f.narration_text, target) ? f : l
      })
    } catch {
      // keep the current narration
    }
  }

  // 1. Scenes far outside their word band (too short OR too long).
  const offBand = findOffBandScenes(scenes, localized, wordsPerSecond)
  if (offBand.length > 0) {
    await rewriteScenes(
      offBand,
      (n) => ({ previous_narration_off_length: localized.find((l) => l.scene_number === n)?.narration_text }),
      (current, candidate, target) => isBetterFit(current, candidate, target, wordsPerSecond),
    )
  }

  // 2. Narration that describes entering/exiting the unit (contradicts the
  // picture, see CROSSING_PATTERNS). Accepted only if the rewrite no longer
  // describes it and doesn't fit the word band any worse than before.
  const crossing = findCrossingScenes(localized)
  if (crossing.length > 0) {
    await rewriteScenes(
      crossing,
      (n) => ({
        previous_narration_must_change: localized.find((l) => l.scene_number === n)?.narration_text,
        rewrite_note:
          'The previous narration described someone entering or leaving the unit. Rewrite it without that — say ' +
          'they arrive, shop, or head home with their groceries — keeping the same meaning, tone and word band.',
      }),
      (current, candidate, target) =>
        !narrationDescribesCrossing(candidate) &&
        bandDistance(narrationWordCount(candidate), target, wordsPerSecond) <=
          bandDistance(narrationWordCount(current), target, wordsPerSecond),
    )
  }

  // 3. Brand name written possessively or plural (see
  // narrationUsesBrandPossessive). Accepted only if the rewrite is clean and
  // fits the word band no worse than before.
  const possessive = findPossessiveBrandScenes(localized, BRAND_PROFILE.name)
  if (possessive.length > 0) {
    await rewriteScenes(
      possessive,
      (n) => ({
        previous_narration_must_change: localized.find((l) => l.scene_number === n)?.narration_text,
        rewrite_note:
          `The previous narration wrote the brand possessively or plural. Write the name exactly as "${BRAND_PROFILE.name}", ` +
          'never with \'s or a plural, keeping the same meaning, tone and word band.',
      }),
      (current, candidate, target) =>
        !narrationUsesBrandPossessive(candidate, BRAND_PROFILE.name) &&
        bandDistance(narrationWordCount(candidate), target, wordsPerSecond) <=
          bandDistance(narrationWordCount(current), target, wordsPerSecond),
    )
  }
  return localized
}

/**
 * Per-language-track step — [ONCE PER TRACK]. Gated on the shared scene
 * plan existing (checked below via getVideoScenes, NOT via
 * hasSucceededStep(...,'generate_script', track.master_generation_used) —
 * that would only ever be true at the EXACT generation generate_script
 * last ran, but a visuals-only regenerate (scope: "visuals") bumps
 * master_generation_used on every track without ever rerunning
 * generate_script, which would permanently strand every track at this
 * gate. A track can't structurally exist before generate_script has
 * already succeeded at least once — tracks are only ever created at
 * approval, which itself requires draft_ready — so this was always a
 * redundant defensive check in practice, not a real "wait for it" gate).
 * NOT gated on the shared visuals being ready either — narration wording
 * doesn't need scene images/clips, only the render step does
 * (ARCHITECTURE.MD §6.5's "language-specific work starts as soon as the
 * shared layer permits it"). This is the ONLY place narration wording is
 * produced — it translates the already-approved, language-neutral
 * narration_intent, never a second call to the script-generation model.
 * Replaces n8n's "FR —" forced-script-regeneration branch entirely
 * (ARCHITECTURE.MD §13's mapping table) — that branch is retired, not
 * ported forward.
 *
 * Writes one video_scene_audio row per scene (narration_text only — audio
 * synthesis is synthesizeVoice.ts's job). Leaves the track in 'generating'
 * on success; synthesizeVoice/transcribeAudio are the further steps that
 * eventually advance it to 'awaiting_shared'.
 */
export async function runLocalizeScript(
  client: SupabaseClient,
  track: TrackRow,
  contentPipelineId: string,
  scriptGenerator: ScriptGenerator,
  backoffBaseDelayMs = 5000,
  // The job's selected ElevenLabs voice (null/undefined = brand default).
  // Used only to look up how fast that voice really speaks, so scene word
  // bands match the voice instead of one fleet-wide rate.
  options?: { voiceId?: string | null; sceneNotes?: string | null },
): Promise<{ ran: boolean }> {
  let working: TrackRow
  if (track.status === 'waiting_on_shared') {
    const claimed = await claimTrack(client, track.id, 'waiting_on_shared', 'generating', {
      current_step: 'localizing_script',
    })
    if (!claimed) return { ran: false } // lost the race to another worker
    working = claimed
  } else if (track.status === 'generating') {
    if (!track.last_error) return { ran: false } // no error recorded — already in flight, not our turn
    if (
      !isReadyToRetry({
        lastError: track.last_error,
        retryCount: track.retry_count,
        updatedAt: new Date(track.updated_at),
        baseDelayMs: backoffBaseDelayMs,
      })
    ) {
      return { ran: false } // backoff window hasn't elapsed yet
    }
    working = track
  } else {
    return { ran: false } // wrong state entirely for this step
  }

  const generation = track.master_generation_used
  const alreadySucceeded = await hasSucceededStep(client, { contentLanguageTrackId: track.id }, 'localize_script', generation)
  if (alreadySucceeded) return { ran: true }

  const scenes = await getVideoScenes(client, contentPipelineId)
  if (scenes.length === 0) return { ran: false } // guards a race against generate_script's own writes

  const attemptNumber = working.retry_count + 1
  try {
    const languageName = track.language === 'FR' ? 'French' : 'English'
    const measuredRate = options?.voiceId
      ? await getMeasuredWordsPerSecond(client, options.voiceId, track.language === 'FR' ? 'FR' : 'EN')
      : null
    const wordsPerSecond = resolveWordsPerSecond(measuredRate)

    // English: the user-approved narration (written at draft time, editable in
    // the dashboard, already checked against the word band) is used verbatim —
    // no model call and no rewrite passes, so what was approved is what is
    // spoken. Any other language, or a legacy draft with no narration, is
    // written/translated by the model below.
    const approvedEnglish = scenes.map((s) => readSceneNarration(s.narration_intent).trim())
    const useApprovedVerbatim = track.language === 'EN' && approvedEnglish.every((t) => t !== '')
    const localized: LocalizedScene[] = useApprovedVerbatim
      ? scenes.map((s, i) => ({ scene_number: s.scene_number, narration_text: approvedEnglish[i] }))
      : await writeNarration(scriptGenerator, scenes, {
          language: languageName,
          wordsPerSecond,
          sceneNotes: options?.sceneNotes,
        })

    for (const scene of scenes) {
      const match = localized.find((l) => l.scene_number === scene.scene_number)
      if (!match) {
        throw new Error(`localize_script: model omitted scene_number ${scene.scene_number}`)
      }
      await upsertVideoSceneAudio(client, {
        contentLanguageTrackId: track.id,
        videoSceneId: scene.id,
        generation,
        narrationText: match.narration_text,
        status: 'pending',
      })
    }

    await recordStepAttempt(client, {
      contentLanguageTrackId: track.id,
      stepName: 'localize_script',
      generation,
      attemptNumber,
      status: 'succeeded',
      provider: 'openai',
      outputSnapshot: { scenes: localized },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await recordStepAttempt(client, {
      contentLanguageTrackId: track.id,
      stepName: 'localize_script',
      generation,
      attemptNumber,
      status: 'failed_retryable',
      provider: 'openai',
      errorMessage: message,
    })
    if (hasExceededMaxAttempts(attemptNumber, MAX_ATTEMPTS.openai)) {
      await markTrackFailed(client, track.id, message)
    } else {
      await recordTrackRetryableFailure(client, track.id, attemptNumber, message)
    }
  }

  return { ran: true }
}
