// Burns the real Fresh-CAN logo into a finished video, exactly as the image pipeline does for
// photos (lib/watermark.ts: top-right, same size, margin and corner fade). The overlay is built
// once at the video's own size and laid over every frame with the bundled ffmpeg; audio is
// copied untouched. Used by the single-shot Seedance test flow.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { ffmpegPath } from './clipFrames'
import { buildLogoOverlayPng } from './watermark'

const execFileAsync = promisify(execFile)
const FFMPEG_TIMEOUT_MS = 180_000

/** Frame size from `ffmpeg -i` stderr (ffmpeg-static ships no ffprobe). */
export function parseVideoSize(ffmpegStderr: string): { width: number; height: number } | null {
  const m = ffmpegStderr.match(/Stream #\d+:\d+[^\n]*Video:[^\n]*?[,\s](\d{2,5})x(\d{2,5})[,\s\[]/)
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null
}

export async function watermarkVideo(video: Buffer): Promise<Buffer> {
  const ffmpeg = ffmpegPath()
  if (!ffmpeg) throw new Error('watermarkVideo: bundled ffmpeg is unavailable')
  const dir = await mkdtemp(path.join(tmpdir(), 'fc-wm-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const overlay = path.join(dir, 'logo.png')
    const output = path.join(dir, 'out.mp4')
    await writeFile(input, video)

    // `ffmpeg -i file` with no output exits non-zero but prints the stream info we need.
    const probe = await execFileAsync(ffmpeg, ['-hide_banner', '-i', input], { timeout: 30_000 }).then(
      (r) => r.stderr,
      (e: { stderr?: string }) => e.stderr ?? '',
    )
    const size = parseVideoSize(probe)
    if (!size) throw new Error('watermarkVideo: could not read the video size')

    await writeFile(overlay, await buildLogoOverlayPng(size.width, size.height))
    await execFileAsync(
      ffmpeg,
      [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', input, '-i', overlay,
        '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
        '-map', '[v]', '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
        '-c:a', 'copy', '-movflags', '+faststart',
        output,
      ],
      { timeout: FFMPEG_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
    )
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
