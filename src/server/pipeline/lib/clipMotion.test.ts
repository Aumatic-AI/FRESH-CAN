import { describe, it, expect } from 'vitest'
import { lintClipMotion } from './clipMotion'

describe('lintClipMotion', () => {
  it('accepts a short motion-only line and trims quotes/whitespace', () => {
    expect(lintClipMotion('  "Over eight seconds, the worker takes one slow step and smiles. Everything else holds still."  ')).toBe(
      'Over eight seconds, the worker takes one slow step and smiles. Everything else holds still.',
    )
  })

  it('rejects non-strings, empty and over-long text', () => {
    expect(lintClipMotion(undefined)).toBeNull()
    expect(lintClipMotion('')).toBeNull()
    expect(lintClipMotion('Smiles.')).toBeNull()
    expect(lintClipMotion('x'.repeat(401))).toBeNull()
  })

  it('rejects a doorway crossing', () => {
    expect(lintClipMotion('The shopper steps out of the unit holding an apple.')).toBeNull()
    expect(lintClipMotion('She enters the unit and picks up a basket.')).toBeNull()
    expect(lintClipMotion('The customer walks through the door with her bag.')).toBeNull()
  })

  it('rejects camera movement, new subjects and reflections', () => {
    expect(lintClipMotion('The camera follows the worker as she walks slowly.')).toBeNull()
    expect(lintClipMotion('A slow zoom on her face as she smiles.')).toBeNull()
    expect(lintClipMotion('Another man appears behind her and nods.')).toBeNull()
    expect(lintClipMotion('The worker takes a bite, their reflection moving in sync.')).toBeNull()
  })

  it('does not reject ordinary words that merely contain a banned stem', () => {
    expect(lintClipMotion('The friends laugh and the woman tracks her phone screen with a finger. Everything else holds still.')).not.toBeNull()
  })
})
