import { describe, it, expect, afterEach } from 'vitest'
import { env } from './env'

describe('ENABLE_SINGLE_SHOT: single-shot is the default video flow', () => {
  const saved = process.env.ENABLE_SINGLE_SHOT
  afterEach(() => {
    if (saved === undefined) delete process.env.ENABLE_SINGLE_SHOT
    else process.env.ENABLE_SINGLE_SHOT = saved
  })
  it('is on when the variable is missing, empty or anything but "false"', () => {
    delete process.env.ENABLE_SINGLE_SHOT
    expect(env.ENABLE_SINGLE_SHOT).toBe(true)
    for (const v of ['', 'true', '1', 'TRUE']) {
      process.env.ENABLE_SINGLE_SHOT = v
      expect(env.ENABLE_SINGLE_SHOT).toBe(true)
    }
  })
  it('falls back to the legacy pipeline only when explicitly "false"', () => {
    process.env.ENABLE_SINGLE_SHOT = 'false'
    expect(env.ENABLE_SINGLE_SHOT).toBe(false)
  })
  it('ignores the old test flag name', () => {
    delete process.env.ENABLE_SINGLE_SHOT
    process.env.ENABLE_SINGLE_SHOT_TEST = 'false'
    expect(env.ENABLE_SINGLE_SHOT).toBe(true)
    delete process.env.ENABLE_SINGLE_SHOT_TEST
  })
})
