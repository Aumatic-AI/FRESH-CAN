// Single-shot test path: the approval gate's draft shape and the edit rules.
//
// The enhanced prompt is held at 'draft_ready' in content_drafts.draft_data.single_shot
// so the user can read and edit it before any paid Seedance call (same gate as the
// scene pipeline's script approval). Edits are re-checked with the SAME validator the
// enhancer's reply goes through (normalizeEnhancedPrompt), so an edited draft can never
// break a rule the AI's own draft had to follow (word cap, doorway, photos, line-in-prompt).
import type { BrandProfile } from '../../prompts/types'
import {
  normalizeEnhancedPrompt,
  type EnhancedSingleShotPrompt,
  type SingleShotSpeaker,
  type SingleShotSpokenLine,
} from './enhancePrompt'
import type { SingleShotAudioMode, SingleShotContainerShown, SingleShotJobLanguage } from '../../prompts/singleShot'
import { checkEditedFrenchLines } from './adaptFrench'

/** What is stored in content_drafts.draft_data.single_shot. */
export interface SingleShotDraft {
  prompt: string
  audio_mode: SingleShotAudioMode
  audio_reason: string
  hook: string
  speakers: SingleShotSpeaker[]
  spoken_lines: SingleShotSpokenLine[]
  container_shown: SingleShotContainerShown
  reference_image_urls: string[]
  original_idea: string
  aspect_ratio: '9:16' | '1:1' | '16:9'
  /** The form's language. Missing on drafts made before French support (= EN). */
  languages?: SingleShotJobLanguage
  /** BOTH only: the approved English narration adapted to Canadian French, one line per spoken line. */
  french_lines?: string[]
}

export function toSingleShotDraft(
  e: EnhancedSingleShotPrompt,
  aspectRatio: SingleShotDraft['aspect_ratio'],
  languages: SingleShotJobLanguage = 'EN',
  frenchLines?: string[],
): SingleShotDraft {
  return {
    prompt: e.prompt,
    audio_mode: e.audioMode,
    audio_reason: e.audioReason,
    hook: e.hook,
    speakers: e.speakers,
    spoken_lines: e.spokenLines,
    container_shown: e.containerShown,
    reference_image_urls: e.referenceImageUrls,
    original_idea: e.originalIdea,
    aspect_ratio: aspectRatio,
    languages,
    ...(frenchLines ? { french_lines: frenchLines } : {}),
  }
}

/** The narration/dialogue as plain text (shown on the approval card and kept in draft_data.script). */
export function spokenScript(lines: SingleShotSpokenLine[]): string {
  return lines.map((l) => l.text.trim()).filter(Boolean).join('\n\n')
}

export function readSingleShotDraft(draftData: unknown): SingleShotDraft | null {
  if (!draftData || typeof draftData !== 'object') return null
  const ss = (draftData as Record<string, unknown>).single_shot
  if (!ss || typeof ss !== 'object') return null
  const d = ss as Partial<SingleShotDraft>
  if (typeof d.prompt !== 'string' || !Array.isArray(d.spoken_lines) || !d.audio_mode || !d.container_shown) return null
  return {
    prompt: d.prompt,
    audio_mode: d.audio_mode,
    audio_reason: d.audio_reason ?? '',
    hook: d.hook ?? '',
    speakers: Array.isArray(d.speakers) ? d.speakers : [],
    spoken_lines: d.spoken_lines,
    container_shown: d.container_shown,
    reference_image_urls: Array.isArray(d.reference_image_urls) ? d.reference_image_urls : [],
    original_idea: d.original_idea ?? '',
    aspect_ratio: d.aspect_ratio ?? '9:16',
    languages: d.languages ?? 'EN',
    ...(Array.isArray(d.french_lines) ? { french_lines: d.french_lines } : {}),
  }
}

export interface SingleShotEdits {
  /** The whole prompt, replacing the stored one. */
  prompt?: unknown
  /** The new text of every spoken line, in order (same length as the stored lines). */
  lines?: unknown
  /** BOTH only: the new text of every French line, in order. */
  frenchLines?: unknown
}

/**
 * Applies the user's edits. A changed spoken line is also swapped inside the prompt (its
 * quoted copy), so the prompt and the line list cannot drift apart; if the user edited the
 * prompt itself, the lines must still appear in it word for word (the validator checks).
 * Returns the new draft, or `{ error }` with a message fit to show the user.
 */
export function applySingleShotEdits(
  current: SingleShotDraft,
  edits: SingleShotEdits,
  brand: BrandProfile,
): { draft: SingleShotDraft } | { error: string } {
  let prompt = current.prompt
  if (edits.prompt !== undefined) {
    if (typeof edits.prompt !== 'string') return { error: 'prompt must be a string' }
    prompt = edits.prompt.trim()
  }

  let lines = current.spoken_lines
  if (edits.lines !== undefined) {
    if (!Array.isArray(edits.lines) || edits.lines.length !== current.spoken_lines.length) {
      return { error: `lines must list all ${current.spoken_lines.length} spoken lines, in order` }
    }
    const next: SingleShotSpokenLine[] = []
    for (let i = 0; i < current.spoken_lines.length; i++) {
      const raw = edits.lines[i]
      if (typeof raw !== 'string') return { error: 'every line must be a string' }
      const text = raw.trim().replace(/"/g, '')
      if (!text) return { error: `spoken line ${i + 1} is empty; delete it from the prompt instead of blanking it` }
      const old = current.spoken_lines[i].text
      if (text !== old && prompt.includes(old)) prompt = prompt.replace(old, text)
      next.push({ speaker: current.spoken_lines[i].speaker, text })
    }
    lines = next
  }

  const checked = normalizeEnhancedPrompt(
    {
      audio_mode: current.audio_mode,
      audio_reason: current.audio_reason,
      container_shown: current.container_shown,
      prompt,
      hook: current.hook,
      speakers: current.speakers,
      spoken_lines: lines,
    },
    current.original_idea,
    brand,
  )
  if (typeof checked === 'string') return { error: checked }

  let frenchLines = current.french_lines
  if (edits.frenchLines !== undefined) {
    if (!frenchLines) return { error: 'this video has no French track to edit' }
  }
  if (frenchLines) {
    // Validated against the CURRENT English lines (they may have just changed), so a French
    // line that no longer fits its English window is caught here, not at render time.
    const french = checkEditedFrenchLines(edits.frenchLines ?? frenchLines, lines.map((l) => l.text))
    if ('error' in french) return french
    frenchLines = french.lines
  }
  return { draft: toSingleShotDraft(checked, current.aspect_ratio, current.languages ?? 'EN', frenchLines) }
}
