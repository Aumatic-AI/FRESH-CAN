import { describe, it, expect } from 'vitest'
import { pickClipDurationSeconds } from './sceneClipDuration'

// request = the planned slot in whole seconds, clamped to 4..8s (no headroom:
// narration residue is absorbed by the render step's <=1.25x slow-down).
describe('pickClipDurationSeconds', () => {
  it('requests exactly the planned slot, with no headroom (paid seconds == video seconds)', () => {
    for (const s of [4, 5, 6, 7, 8]) expect(pickClipDurationSeconds(s * 1000)).toBe(s)
  })

  it('rounds a fractional slot to the nearest whole second', () => {
    expect(pickClipDurationSeconds(6400)).toBe(6)
    expect(pickClipDurationSeconds(6600)).toBe(7)
  })

  it('clamps a tiny slot up to the 4s floor', () => {
    expect(pickClipDurationSeconds(1000)).toBe(4)
    expect(pickClipDurationSeconds(3400)).toBe(4)
  })

  it('clamps a long slot down to the 8s ceiling (long takes loop their background)', () => {
    expect(pickClipDurationSeconds(9000)).toBe(8)
    expect(pickClipDurationSeconds(11000)).toBe(8)
    expect(pickClipDurationSeconds(20000)).toBe(8)
  })

  it('never costs more than the plan: a 36s plan of 6,6,8,8,8 requests exactly 36 clip-seconds', () => {
    const slots = [6000, 6000, 8000, 8000, 8000]
    expect(slots.reduce((a, ms) => a + pickClipDurationSeconds(ms), 0)).toBe(36)
  })

  it('the residual narration overshoot (<=8% + 0.3s trailing buffer) stays within the 1.25x render slow-down', () => {
    for (const s of [4, 5, 6, 7, 8]) {
      const worstAudio = s * 1.08 + 0.3
      expect(worstAudio / pickClipDurationSeconds(s * 1000)).toBeLessThanOrEqual(1.25)
    }
  })
})
