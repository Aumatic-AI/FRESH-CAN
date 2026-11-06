import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import { ffmpegPath } from './clipFrames'
import { buildFrenchMixArgs, MAX_TEMPO, planFrenchMix } from './frenchMix'
import { estimateLineStarts, lineStartsFromTranscript, parseTimedWords } from './lineTiming'
import { probeDurationMs } from '../steps/singleShot/frenchTrack'

const run = promisify(execFile)
const ffmpeg = ffmpegPath()

const w = (text: string, start: number) => ({ text, start, end: start + 300 })

describe('lineStartsFromTranscript', () => {
  const lines = ['One apple gets away.', 'A few neighbours follow.', 'It ends here.']
  const words = [
    w('One', 2100), w('apple', 2400), w('gets', 2700), w('away.', 3000),
    w('A', 9000), w('few', 9200), w('neighbours', 9500), w('follow.', 9900),
    w('It', 18000), w('ends', 18300), w('here.', 18600),
  ]
  it('starts each line at its first matched word', () => {
    expect(lineStartsFromTranscript(words, lines, 30000)).toEqual({ startMs: [2100, 9000, 18000], source: 'transcript' })
  })
  it('falls back to a length-based spread when the audio does not match the script', () => {
    const r = lineStartsFromTranscript(words.slice(0, 3), lines, 30000)
    expect(r.source).toBe('estimate')
    expect(r.startMs).toHaveLength(3)
    expect(r.startMs[0]).toBeLessThan(r.startMs[1])
    expect(lineStartsFromTranscript([], lines, 30000).source).toBe('estimate')
  })
  it('keeps starts strictly increasing and ignores malformed words', () => {
    expect(parseTimedWords([{ text: 'a', start: 1, end: 2 }, { nope: 1 }, null])).toHaveLength(1)
    const est = estimateLineStarts(lines, 30000)
    expect(est[2]).toBeGreaterThan(est[1])
    expect(est[2]).toBeLessThan(30000)
  })
})

describe('planFrenchMix', () => {
  it('leaves lines that fit untouched', () => {
    const p = planFrenchMix([2000, 3000], [2000, 10000], 30000)
    expect(p.lines.map((l) => l.tempo)).toEqual([1, 1])
    expect(p.warnings).toEqual([])
  })
  it('speeds up a line that overflows its window, capped at MAX_TEMPO, and flags what still does not fit', () => {
    const p = planFrenchMix([8000, 2000], [2000, 8000], 30000) // window ~5.85 s for 8 s of speech
    expect(p.lines[0].tempo).toBe(MAX_TEMPO)
    expect(p.warnings.join(' ')).toMatch(/line 1 is .* longer than its window/)
    const ok = planFrenchMix([6500, 2000], [2000, 8000], 30000) // needs ~1.11x
    expect(ok.lines[0].tempo).toBeGreaterThan(1)
    expect(ok.lines[0].tempo).toBeLessThanOrEqual(MAX_TEMPO)
    expect(ok.warnings).toEqual([])
  })
  it('moves a last line earlier so it ends before the clip does', () => {
    const p = planFrenchMix([3000], [28000], 30000)
    expect(p.lines[0].startMs + p.lines[0].durationMs).toBeLessThanOrEqual(30000)
    expect(p.warnings.join(' ')).toMatch(/moved earlier/)
  })
})

describe.skipIf(!ffmpeg)('buildFrenchMixArgs: audio longer than the picture', () => {
  it('never runs past the video length', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'fc-mixt-'))
    try {
      const f = ffmpeg!
      const base = ['-hide_banner', '-loglevel', 'error', '-y']
      const video = path.join(dir, 'video.mp4')
      await run(f, [...base, '-f', 'lavfi', '-i', 'color=c=0x336699:s=160x284:d=3:r=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', video])
      const l0 = path.join(dir, 'l0.mp3')
      await run(f, [...base, '-f', 'lavfi', '-i', 'sine=frequency=300:duration=8', l0])
      const out = path.join(dir, 'out.mp4')
      const plan = planFrenchMix([8000], [500], 3000)
      await run(f, buildFrenchMixArgs({ videoPath: video, linePaths: [l0], outputPath: out, totalMs: 3000, plan }))
      const ms = await probeDurationMs(f, out)
      expect(ms).toBeLessThan(3300)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})

describe.skipIf(!ffmpeg)('buildFrenchMixArgs with real ffmpeg', () => {
  it('lays two voice lines (and a background) onto the video, copying the picture', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'fc-mix-'))
    try {
      const f = ffmpeg!
      const base = ['-hide_banner', '-loglevel', 'error', '-y']
      const video = path.join(dir, 'video.mp4')
      await run(f, [...base, '-f', 'lavfi', '-i', 'color=c=0x336699:s=160x284:d=6:r=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', video])
      const l0 = path.join(dir, 'l0.mp3')
      const l1 = path.join(dir, 'l1.mp3')
      await run(f, [...base, '-f', 'lavfi', '-i', 'sine=frequency=300:duration=1.5', l0])
      await run(f, [...base, '-f', 'lavfi', '-i', 'sine=frequency=500:duration=1.5', l1])
      const bg = path.join(dir, 'bg.wav')
      await run(f, [...base, '-f', 'lavfi', '-i', 'anoisesrc=d=6:c=pink:a=0.05', bg])

      const plan = planFrenchMix([1500, 1500], [500, 3500], 6000)
      for (const withBg of [false, true]) {
        const out = path.join(dir, withBg ? 'bg.mp4' : 'nobg.mp4')
        await run(f, buildFrenchMixArgs({ videoPath: video, linePaths: [l0, l1], backgroundPath: withBg ? bg : undefined, outputPath: out, totalMs: 6000, plan }))
        const stderr = await run(f, ['-hide_banner', '-i', out]).catch((e: { stderr: string }) => e).then((r) => (r as { stderr: string }).stderr)
        expect(stderr).toMatch(/Video: h264/)
        expect(stderr).toMatch(/Audio: aac/)
        const ms = await probeDurationMs(f, out)
        expect(ms).toBeGreaterThan(5500)
        expect(ms).toBeLessThan(6600)
      }
      // The mixed audio is not silent where a line plays.
      await writeFile(path.join(dir, 'x'), '')
      const vol = await run(f, ['-hide_banner', '-i', path.join(dir, 'nobg.mp4'), '-af', 'atrim=0.6:1.8,volumedetect', '-f', 'null', '-']).catch((e: { stderr: string }) => e)
      expect((vol as { stderr: string }).stderr).toMatch(/mean_volume: -\d+/)
      expect((vol as { stderr: string }).stderr).not.toMatch(/mean_volume: -91/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
