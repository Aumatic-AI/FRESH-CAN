import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { CLIP_FRAME_POSITIONS, extractClipFrames, ffmpegPath, frameTimestamps } from './clipFrames'

describe('frameTimestamps', () => {
  it('samples early, middle and late, always inside the clip', () => {
    expect(frameTimestamps(10)).toEqual([1.2, 5, 8.8])
    for (const t of frameTimestamps(0.5)) {
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThan(0.5)
    }
    expect(CLIP_FRAME_POSITIONS).toHaveLength(3)
  })
})

describe('extractClipFrames', () => {
  it('returns [] (cannot check) for a buffer that is not an MP4', async () => {
    expect(await extractClipFrames(Buffer.from('not a video'))).toEqual([])
  })

  const bin = ffmpegPath()
  it.skipIf(!bin)('extracts three JPEG frames from a real clip', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'clipframes-test-'))
    try {
      const out = path.join(dir, 'c.mp4')
      const r = spawnSync(bin!, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=10:duration=3', '-pix_fmt', 'yuv420p', out])
      expect(r.status).toBe(0)
      const frames = await extractClipFrames(readFileSync(out))
      expect(frames).toHaveLength(3)
      for (const f of frames) expect(f.subarray(0, 2).toString('hex')).toBe('ffd8') // JPEG SOI
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
