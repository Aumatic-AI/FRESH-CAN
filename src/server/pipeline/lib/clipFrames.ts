import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import ffmpegStatic from 'ffmpeg-static'
import { parseMp4DurationSeconds } from './mp4Duration'

const execFileAsync = promisify(execFile)

/** Fractions of the clip at which frames are sampled: early (does it still match
 *  the still?), middle, and late (where drift and invented content accumulate). */
export const CLIP_FRAME_POSITIONS = [0.12, 0.5, 0.88] as const

const FRAME_WIDTH = 512
const FFMPEG_TIMEOUT_MS = 30_000

/** Path of the bundled ffmpeg binary, or null when it is unavailable (not
 *  installed, install script skipped, unsupported platform). */
export function ffmpegPath(): string | null {
  return typeof ffmpegStatic === 'string' && existsSync(ffmpegStatic) ? ffmpegStatic : null
}

/** Timestamps (seconds) to sample for a clip of the given length. */
export function frameTimestamps(durationSeconds: number): number[] {
  return CLIP_FRAME_POSITIONS.map((f) => Math.max(0, Math.min(durationSeconds - 0.05, durationSeconds * f)))
}

/**
 * Extracts a few JPEG frames from a finished clip, entirely locally (no provider
 * call, no queue). Returns [] when ffmpeg is unavailable or anything fails — the
 * caller treats that as "cannot check", never as a failed clip.
 */
export async function extractClipFrames(clip: Buffer): Promise<Buffer[]> {
  const bin = ffmpegPath()
  if (!bin) return []
  const duration = parseMp4DurationSeconds(clip)
  if (duration === null || duration <= 0) return []
  const dir = await mkdtemp(path.join(tmpdir(), 'clipframes-'))
  try {
    const input = path.join(dir, 'in.mp4')
    await writeFile(input, clip)
    const frames: Buffer[] = []
    for (const [i, t] of frameTimestamps(duration).entries()) {
      const out = path.join(dir, `f${i}.jpg`)
      await execFileAsync(
        bin,
        ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', input, '-frames:v', '1', '-vf', `scale=${FRAME_WIDTH}:-2`, '-q:v', '4', out],
        { timeout: FFMPEG_TIMEOUT_MS },
      )
      frames.push(await readFile(out))
    }
    return frames
  } catch {
    return []
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
