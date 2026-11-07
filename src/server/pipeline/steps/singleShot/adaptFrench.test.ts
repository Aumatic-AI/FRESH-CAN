import { describe, expect, it } from 'vitest'
import { BRAND_PROFILE } from '../../prompts/index'
import {
  adaptSingleShotFrench,
  checkEditedFrenchLines,
  composeFrenchAdaptSystemPrompt,
  composeFrenchAdaptUserPrompt,
  frenchLineMaxWords,
  normalizeFrenchLines,
} from './adaptFrench'
import type { ScriptGenerator } from '../../adapters/types'

const en = ['One apple gets away.', 'A few neighbours follow. A little journey becomes company.']

describe('French adaptation checks', () => {
  it('gives each line a length limit from its English original', () => {
    expect(frenchLineMaxWords('One apple gets away.')).toBe(Math.ceil(4 * 1.25) + 1)
    expect(frenchLineMaxWords('Hi')).toBe(4)
  })
  it('accepts one line per English line within the limit and strips quotes', () => {
    expect(normalizeFrenchLines({ lines: ['Une pomme s\'échappe.', 'Des voisins la suivent, et le voyage devient une compagnie.'] }, en)).toEqual([
      "Une pomme s'échappe.",
      'Des voisins la suivent, et le voyage devient une compagnie.',
    ])
    expect(normalizeFrenchLines({ lines: ['"Une pomme."', 'Des voisins suivent.'] }, en)).toEqual(['Une pomme.', 'Des voisins suivent.'])
  })
  it('rejects a wrong count, an empty line and a line that runs too long', () => {
    expect(normalizeFrenchLines({ lines: ['seule'] }, en)).toMatch(/expected 2 lines/)
    expect(normalizeFrenchLines({ lines: ['ok', '  '] }, en)).toMatch(/empty/)
    expect(normalizeFrenchLines({ lines: ['un deux trois quatre cinq six sept huit', 'x'] }, en)).toMatch(/max/)
    expect(normalizeFrenchLines('nope', en)).toMatch(/lines/)
  })
  it('checks edited lines the same way, with a French-prefixed error', () => {
    expect(checkEditedFrenchLines(['a', 'b'], en)).toEqual({ lines: ['a', 'b'] })
    expect(checkEditedFrenchLines(['a'], en)).toMatchObject({ error: expect.stringContaining('French:') })
  })
  it('prompts carry the Canadian French rules, the limits and the previous problem', () => {
    expect(composeFrenchAdaptSystemPrompt(BRAND_PROFILE)).toMatch(/Canadian/)
    expect(composeFrenchAdaptSystemPrompt(BRAND_PROFILE)).toMatch(/faire l'épicerie/)
    const user = composeFrenchAdaptUserPrompt(en, 'line 2 is empty')
    expect(user).toContain('(max 6 French words) One apple gets away.')
    expect(user).toContain('line 2 is empty')
  })
  it('retries with the rejection reason and gives up after three bad replies', async () => {
    const prompts: string[] = []
    let calls = 0
    const gen: ScriptGenerator = {
      generate: async (input) => {
        prompts.push(input.userPrompt)
        calls++
        return { parsed: calls === 1 ? { lines: ['seule'] } : { lines: ['Une pomme.', 'Des voisins suivent.'] }, raw: '' } as never
      },
    }
    expect(await adaptSingleShotFrench(gen, BRAND_PROFILE, en)).toEqual(['Une pomme.', 'Des voisins suivent.'])
    expect(prompts[1]).toContain('expected 2 lines')
    const bad: ScriptGenerator = { generate: async () => ({ parsed: { lines: [] }, raw: '' }) as never }
    await expect(adaptSingleShotFrench(bad, BRAND_PROFILE, en)).rejects.toThrow(/failed after 3 attempts/)
  })
})

describe('French length factor and flow', () => {
  it('allows French about 15% longer than the English line (plus one word)', async () => {
    const { frenchLineMaxWords } = await import('./adaptFrench')
    expect(frenchLineMaxWords('one two three four five six seven eight nine ten eleven twelve')).toBe(15)
  })
  it('tells the adapter to keep the connecting words so the French flows', () => {
    expect(composeFrenchAdaptSystemPrompt(BRAND_PROFILE)).toMatch(/connecting words/)
  })
})
