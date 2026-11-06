import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ffmpegPath } from './clipFrames'
import { parseVideoSize, watermarkVideo } from './videoWatermark'

const run = promisify(execFile)
const ffmpeg = ffmpegPath()

describe('parseVideoSize', () => {
  it('reads the frame size from ffmpeg output', () => {
    const err = '  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv), 480x854 [SAR 1:1 DAR 240:427], 30 fps\n'
    expect(parseVideoSize(err)).toEqual({ width: 480, height: 854 })
    expect(parseVideoSize('no streams')).toBeNull()
  })
})

describe.skipIf(!ffmpeg)('watermarkVideo', () => {
  it('draws the logo in the top-right corner, keeps size and audio', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'fc-wmt-'))
    try {
      const src = path.join(dir, 'src.mp4')
      await run(ffmpeg!, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x808080:s=480x854:d=1:r=24',
        '-f', 'lavfi', '-i', 'sine=d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', src])
      const out = await watermarkVideo(await readFile(src))
      const outPath = path.join(dir, 'out.mp4')
      await (await import('node:fs/promises')).writeFile(outPath, out)
      const info = await run(ffmpeg!, ['-hide_banner', '-i', outPath]).catch((e: { stderr: string }) => e)
      const stderr = (info as { stderr: string }).stderr
      expect(stderr).toMatch(/480x854/)
      expect(stderr).toMatch(/Audio: aac/)

      const frame = path.join(dir, 'f.png')
      await run(ffmpeg!, ['-hide_banner', '-loglevel', 'error', '-y', '-i', outPath, '-frames:v', '1', frame])
      const { data, info: meta } = await sharp(frame).raw().toBuffer({ resolveWithObject: true })
      const px = (x: number, y: number) => data[(y * meta.width + x) * meta.channels]
      expect(px(30, 800)).toBeGreaterThan(110) // far corner untouched grey
      expect(px(meta.width - 3, 3)).toBeLessThan(100) // top-right corner darkened by the fade
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
