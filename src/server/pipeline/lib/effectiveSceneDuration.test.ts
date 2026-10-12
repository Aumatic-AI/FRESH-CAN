import { describe, it, expect } from 'vitest'
import { effectiveSlotMs, plannedSlotMs, MIN_SLOT_MS } from './effectiveSceneDuration'

describe('effectiveSlotMs', () => {
  it('keeps the planned slot when the clip is full length, longer, or within tolerance', () => {
    expect(effectiveSlotMs(8000, 8.0)).toBe(8000)
    expect(effectiveSlotMs(8000, 9.5)).toBe(8000)
    expect(effectiveSlotMs(8000, 7.8)).toBe(8000) // 200ms short, inside the 250ms tolerance
  })

  it('clamps the slot to the real clip length when the clip is shorter', () => {
    expect(effectiveSlotMs(8000, 5.2)).toBe(5200)
    expect(effectiveSlotMs(8000, 5.27)).toBe(5200) // rounded down to 0.1s
  })

  it('never goes below the minimum slot', () => {
    expect(effectiveSlotMs(8000, 0.8)).toBe(MIN_SLOT_MS)
  })

  it('falls back to the planned slot when the clip length is unknown or invalid', () => {
    for (const bad of [null, undefined, NaN, 0, -3]) expect(effectiveSlotMs(8000, bad as never)).toBe(8000)
  })
})

describe('plannedSlotMs', () => {
  it('prefers the saved planned duration, so a longer regenerated clip can restore the slot', () => {
    expect(plannedSlotMs({ text: 'x', planned_duration_ms: 8000 }, 5200)).toBe(8000)
  })
  it('uses the current target when nothing was saved or the intent is not an object', () => {
    expect(plannedSlotMs({ text: 'x' }, 7000)).toBe(7000)
    expect(plannedSlotMs('legacy string', 7000)).toBe(7000)
    expect(plannedSlotMs(null, 7000)).toBe(7000)
  })
})
