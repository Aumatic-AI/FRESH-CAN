// Single-shot BOTH flow, French track: the English clip (already logoed) is re-voiced in French.
// Orchestrated by inngest/functions/singleShot.ts (`singleShotFrenchTrack`).
//
//   French lines (approved at the draft gate) --ElevenLabs--> one audio file per line
//   each line is placed where its English line starts (timings from an AssemblyAI transcript of the
//   English audio), sped up slightly if it does not fit its window, then mixed onto the video with
//   ffmpeg (video stream copied, so the logo is not re-encoded a second time).
//
// The English voice is NOT kept: Seedance's audio is one mixed file, so by default the French track
// has the voice only, no ambient sound. A `VoiceSeparator` can supply a background-only track
// (ambient + music without the English voice) to mix underneath; with none (the default) the track
// simply goes without a background. Nothing here ever lets English speech leak under the French.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VoiceSynthesizer, VoiceSynthesisInput, VoiceSynthesisResult } from '../../adapters/types'
import type { VideoStorageUploader } from '../../adapters/storage'
import { ffmpegPath } from '../../lib/clipFrames'
import { buildFrenchMixArgs, planFrenchMix } from '../../lib/frenchMix'
import { estimateLineStarts } from '../../lib/lineTiming'
import { SINGLE_SHOT_RESOLUTION } from '../../adapters/kieSingleShot'
import { SINGLE_SHOT_DURATION_SECONDS } from '../../prompts/singleShot'
import { markJobReadyIfAllContentComplete, upsertVideoGeneratedContent } from '../../db'

const execFileAsync = promisify(execFile)
const FFMPEG_TIMEOUT_MS = 180_000

/** Supplies a background-only track (ambient + music, no speech) from the raw English clip, or null. */
export interface VoiceSeparator {
  separateBackground(rawVideo: Buffer): Promise<Buffer | null>
}
/** Default: no separation available, so the French track has no background. */
export class NoSeparator implements VoiceSeparator {
  async separateBackground(): Promise<null> {
    return null
  }
}

/** Dev/fake mode: a quiet tone per line, long enough for its word count, so no paid TTS is called. */
export class FakeVoiceSynthesizer implements VoiceSynthesizer {
  async synthesize(input: VoiceSynthesisInput): Promise<VoiceSynthesisResult> {
    const ffmpeg = ffmpegPath()
    if (!ffmpeg) throw new Error('FakeVoiceSynthesizer: ffmpeg unavailable')
    const words = input.text.trim().split(/\s+/).filter(Boolean).length
    const seconds = Math.max(0.6, words * 0.38)
    const dir = await mkdtemp(path.join(tmpdir(), 'fc-fv-'))
    try {
      const out = path.join(dir, 'tone.mp3')
      await execFileAsync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=220:duration=${seconds}`, '-filter:a', 'volume=0.2', out])
      return { audioBuffer: await readFile(out), providerRef: 'fake' }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }
}

/** Length of an audio/video file in ms, read from `ffmpeg -i` output (ffmpeg-static ships no ffprobe). */
export async function probeDurationMs(ffmpeg: string, file: string): Promise<number> {
  const stderr = await execFileAsync(ffmpeg, ['-hide_banner', '-i', file], { timeout: 30_000 }).then(
    (r) => r.stderr,
    (e: { stderr?: string }) => e.stderr ?? '',
  )
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!m) throw new Error('could not read the duration of a media file')
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000)
}

export interface FrenchTrackArgs {
  jobId: string
  pipelineId: string
  generation: number
  trackId: string
  voiceId: string | null
  frenchLines: string[]
  englishLines: string[]
  /** Where each English line starts (ms), from lib/lineTiming. Ignored when `timingSource` is 'estimate' (recomputed against the real clip length). */
  startMs: number[]
  timingSource: 'transcript' | 'estimate'
  /** The logoed English clip (public URL): the picture the French voice goes onto. */
  videoUrl: string
  /** The untouched Seedance clip, only fetched when a separator is in use. */
  rawVideoUrl: string
  aspectRatio: string
  hook: string
  originalIdea: string
  enhancedPrompt: string
  containerShown: string
  referenceImageUrls: string[]
}

export interface FrenchTrackDeps {
  client: SupabaseClient
  voice: VoiceSynthesizer
  uploader: VideoStorageUploader
  /** Optional. Absent = no background track (the default). */
  separator?: VoiceSeparator
  fetchImpl?: typeof fetch
}

async function download(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`failed to download ${url} (status ${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/** Builds and uploads the French video, then marks the track, pipeline and job ready. */
export async function renderFrenchTrack(
  deps: FrenchTrackDeps,
  a: FrenchTrackArgs,
): Promise<{ fileUrl: string; warnings: string[]; background: 'separated' | 'none' }> {
  const ffmpeg = ffmpegPath()
  if (!ffmpeg) throw new Error('renderFrenchTrack: bundled ffmpeg is unavailable')
  const fetchImpl = deps.fetchImpl ?? fetch
  const dir = await mkdtemp(path.join(tmpdir(), 'fc-fr-'))
  try {
    const videoPath = path.join(dir, 'video.mp4')
    await writeFile(videoPath, await download(a.videoUrl, fetchImpl))
    const totalMs = await probeDurationMs(ffmpeg, videoPath)

    // One audio file per French line.
    const linePaths: string[] = []
    const naturalMs: number[] = []
    for (let i = 0; i < a.frenchLines.length; i++) {
      const synthesized = await deps.voice.synthesize({ text: a.frenchLines[i], voiceId: a.voiceId ?? '' })
      const p = path.join(dir, `line-${i}.mp3`)
      await writeFile(p, synthesized.audioBuffer)
      linePaths.push(p)
      naturalMs.push(await probeDurationMs(ffmpeg, p))
    }

    // An estimate is spread over the REAL clip length, not an assumed 30 s.
    const startMs = a.timingSource === 'estimate' ? estimateLineStarts(a.englishLines, totalMs) : a.startMs
    const plan = planFrenchMix(naturalMs, startMs, totalMs)

    // The raw clip is only fetched when a separator is in use; with none, the track has no background.
    let backgroundPath: string | undefined
    const background = deps.separator ? await deps.separator.separateBackground(await download(a.rawVideoUrl, fetchImpl)) : null
    if (background) {
      backgroundPath = path.join(dir, 'background.wav')
      await writeFile(backgroundPath, background)
    }

    const outputPath = path.join(dir, 'out.mp4')
    await execFileAsync(ffmpeg, buildFrenchMixArgs({ videoPath, linePaths, backgroundPath, outputPath, totalMs, plan }), {
      timeout: FFMPEG_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
    })
    const fileUrl = await deps.uploader.uploadBuffer(`${a.jobId}/single-shot-g${a.generation}-FR.mp4`, await readFile(outputPath), 'video/mp4')

    const warnings = [...plan.warnings]
    if (a.timingSource === 'estimate') warnings.push('line timings were estimated (the English audio did not match the approved lines)')
    await finalizeFrenchTrack(deps.client, a, fileUrl, warnings, backgroundPath ? 'separated' : 'none')
    return { fileUrl, warnings, background: backgroundPath ? 'separated' : 'none' }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function finalizeFrenchTrack(
  client: SupabaseClient,
  a: FrenchTrackArgs,
  fileUrl: string,
  warnings: string[],
  background: 'separated' | 'none',
): Promise<void> {
  await upsertVideoGeneratedContent(client, {
    jobId: a.jobId,
    language: 'FR',
    contentPipelineId: a.pipelineId,
    contentLanguageTrackId: a.trackId,
    fileUrl,
    sceneCount: 1,
  })
  const { error: markErr } = await client
    .from('generated_content')
    .update({
      output_data: {
        language: 'FR',
        total_scenes: 1,
        single_shot: true,
        // Same clip as the English video; only the voice differs.
        voice_source: 'elevenlabs',
        background,
        timing_source: a.timingSource,
        warnings,
        resolution: SINGLE_SHOT_RESOLUTION,
        duration_seconds: SINGLE_SHOT_DURATION_SECONDS,
        aspect_ratio: a.aspectRatio,
        original_idea: a.originalIdea,
        enhanced_prompt: a.enhancedPrompt,
        hook: a.hook,
        container_shown: a.containerShown,
        reference_image_urls: a.referenceImageUrls,
        audio_mode: 'narration',
        spoken_lines: a.frenchLines.map((text) => ({ speaker: 'narrator', text })),
        english_lines: a.englishLines,
      },
    })
    .eq('content_language_track_id', a.trackId)
  if (markErr) throw markErr

  const now = new Date().toISOString()
  const { error: trackErr } = await client
    .from('content_language_tracks')
    .update({ status: 'ready', current_step: null, updated_at: now })
    .eq('id', a.trackId)
  if (trackErr) throw trackErr
  const { error: pipeErr } = await client
    .from('content_pipelines')
    .update({ status: 'ready', current_step: null, updated_at: now })
    .eq('id', a.pipelineId)
  if (pipeErr) throw pipeErr
  await markJobReadyIfAllContentComplete(client, a.jobId)
}
