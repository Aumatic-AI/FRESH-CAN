import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { BRAND_PROFILE } from './fresh-can'

// The pre-retouch truck photos (extra wordmarks, QR panel, vents, doors on the
// side) must never be wired back in: they caused door/vent hallucinations.
const OLD = /truck_exterior_(standing|back|arrival)(?!_)/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|md)$/.test(name)) out.push(full)
  }
  return out
}

describe('old truck reference photos', () => {
  it('are not referenced anywhere in src/ or assets/', () => {
    const self = path.basename(__filename)
    const files = [...walk(path.join(process.cwd(), 'src')), ...walk(path.join(process.cwd(), 'assets'))]
    const offenders = files.filter((f) => path.basename(f) !== self && OLD.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('their files are gone from assets/fresh-can', () => {
    for (const n of ['standing', 'back', 'arrival']) {
      expect(existsSync(path.join(process.cwd(), 'assets', 'fresh-can', `truck_exterior_${n}.png`))).toBe(false)
    }
  })

  it('every wired exterior photo exists locally and the superseded rear photo is gone', () => {
    for (const r of BRAND_PROFILE.referenceImages.exterior) {
      const file = r.url.split('/').pop()!
      expect(existsSync(path.join(process.cwd(), 'assets', 'fresh-can', file)), file).toBe(true)
    }
    expect(existsSync(path.join(process.cwd(), 'assets', 'fresh-can', 'truck_exterior_rear_clean.png'))).toBe(false)
    expect(existsSync(path.join(process.cwd(), 'assets', 'fresh-can', 'truck_exterior_rear34_clean.png'))).toBe(false)
    for (const view of ['rear', 'rear34']) {
      expect(BRAND_PROFILE.referenceImages.exterior.find((r) => r.view === view)!.whatItShows).toMatch(/QR panel/)
    }
  })
})
