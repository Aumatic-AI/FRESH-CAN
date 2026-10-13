import { describe, it, expect } from 'vitest'
import {
  findCrossingScenes,
  findOffBandScenes,
  isBetterFit,
  narrationDescribesCrossing,
  narrationUsesBrandPossessive,
  findPossessiveBrandScenes,
  narrationWordRange,
  writeNarration,
} from './localizeScript'
import type { ScriptGenerator } from '../../adapters/types'
import type { VideoSceneRow } from '../../db'

describe('narration length floor', () => {
  it('flags a 5s slot filled with 4 words but not a full one', () => {
    const scenes = [
      { scene_number: 1, target_duration_ms: 5000 },
      { scene_number: 2, target_duration_ms: 5000 },
    ]
    const full = Array(narrationWordRange(5000).min).fill('word').join(' ')
    expect(findOffBandScenes(scenes, [
      { scene_number: 1, narration_text: 'Discover Fresh-CAN today.' },
      { scene_number: 2, narration_text: full },
    ])).toEqual([1])
  })
  it('keeps max above min', () => {
    const r = narrationWordRange(4000)
    expect(r.max).toBeGreaterThanOrEqual(r.min)
  })
  it('also flags far-too-long narration and prefers the closer rewrite', () => {
    const scenes = [{ scene_number: 1, target_duration_ms: 5000 }]
    const long = Array(24).fill('word').join(' ')
    expect(findOffBandScenes(scenes, [{ scene_number: 1, narration_text: long }])).toEqual([1])
    const fitted = Array(narrationWordRange(5000).max).fill('word').join(' ')
    expect(isBetterFit(long, fitted, 5000)).toBe(true)
    expect(isBetterFit(fitted, long, 5000)).toBe(false)
  })
})

describe('narrationWordRange with a measured voice rate', () => {
  it('gives a slower voice fewer words for the same slot', () => {
    const slow = narrationWordRange(7000, 2.44)
    const fast = narrationWordRange(7000, 3.1)
    expect(slow.max).toBeLessThan(fast.max)
    // Job 790b8771 scene 1: 25 words in a 7s slot at 2.44 wps was ~46% over; it must now be off-band.
    expect(slow.max).toBeLessThan(25)
  })

  it('flags the real 25-word / 7s scene as off-band at its voice rate but not at the old 3.1', () => {
    const scenes = [{ scene_number: 1, target_duration_ms: 7000 }]
    const text = Array(25).fill('word').join(' ')
    expect(findOffBandScenes(scenes, [{ scene_number: 1, narration_text: text }], 2.44)).toEqual([1])
  })
})

describe('narration entry/exit lint', () => {
  it.each([
    'The student enters the unit with a quick scan.',
    'She walks out feeling content and stress-free.',
    'They step inside and grab fresh produce.',
    'He comes out of the truck with a basket.',
    'Everyone rushes in to grab burgers.',
    'She climbs into the unit.',
    'Elle entre dans le camion avec son téléphone.',
    'Il sort du camion avec ses courses.',
  ])('flags: %s', (text) => {
    expect(narrationDescribesCrossing(text)).toBe(true)
  })

  it.each([
    'A Fresh-CAN unit is parked close by, a promising solution.',
    'The student picks fresh produce and heads home with a full bag.',
    'The truck arrives and neighbours gather around it.',
    'Dinner is easy when the groceries come to you.',
    'Elle choisit des produits frais et rentre chez elle.',
  ])('does not flag: %s', (text) => {
    expect(narrationDescribesCrossing(text)).toBe(false)
  })

  it('returns the scene numbers that describe a crossing', () => {
    expect(
      findCrossingScenes([
        { scene_number: 1, narration_text: 'A busy student rushes to class.' },
        { scene_number: 2, narration_text: 'She enters the unit and shops.' },
      ]),
    ).toEqual([2])
  })
})

describe('brand possessive check', () => {
  it('flags the possessive or plural brand but not the plain name', () => {
    expect(narrationUsesBrandPossessive("thanks to Fresh-CAN's ease.", 'Fresh-CAN')).toBe(true)
    expect(narrationUsesBrandPossessive('thanks to Fresh-CAN\u2019s ease.', 'Fresh-CAN')).toBe(true)
    expect(narrationUsesBrandPossessive('thanks to FreshCans everywhere', 'Fresh-CAN')).toBe(true)
    expect(narrationUsesBrandPossessive('thanks to Fresh-CAN, it is easy.', 'Fresh-CAN')).toBe(false)
    expect(narrationUsesBrandPossessive('Fresh-CAN is here.', 'Fresh-CAN')).toBe(false)
    expect(narrationUsesBrandPossessive('fresh fruit and a can of beans', 'Fresh-CAN')).toBe(false)
  })
  it('returns the scene numbers that need a rewrite', () => {
    expect(
      findPossessiveBrandScenes(
        [
          { scene_number: 1, narration_text: 'Fresh-CAN is here.' },
          { scene_number: 2, narration_text: "Fresh-CAN's ease." },
        ],
        'Fresh-CAN',
      ),
    ).toEqual([2])
  })
})

describe('writeNarration', () => {
  const sceneRow = (narration?: string): VideoSceneRow =>
    ({
      id: 's1',
      content_pipeline_id: 'p1',
      generation: 1,
      scene_number: 1,
      visual_description: 'A woman scans a QR code.',
      shot_notes: null,
      narration_intent: { text: 'Explain the QR scan.', ...(narration ? { narration } : {}) },
      target_duration_ms: 5000,
      created_at: '',
    }) as VideoSceneRow

  const recordingGenerator = (calls: string[]): ScriptGenerator => ({
    async generate(input) {
      calls.push(input.userPrompt)
      const text = Array(narrationWordRange(5000).min).fill('word').join(' ')
      return { parsed: { scenes: [{ scene_number: 1, narration_text: text }] }, raw: '' } as never
    },
  })

  it('hands the approved English narration to a French rewrite as the text to translate', async () => {
    const calls: string[] = []
    await writeNarration(recordingGenerator(calls), [sceneRow('She scans her code.')], { language: 'French', wordsPerSecond: 2.65 })
    expect(JSON.parse(calls[0])[0].approved_english_narration).toBe('She scans her code.')
  })

  it('does not add approved_english_narration for English, or when no narration was written', async () => {
    const calls: string[] = []
    await writeNarration(recordingGenerator(calls), [sceneRow('She scans her code.')], { language: 'English', wordsPerSecond: 2.65 })
    await writeNarration(recordingGenerator(calls), [sceneRow()], { language: 'French', wordsPerSecond: 2.65 })
    expect(JSON.parse(calls[0])[0]).not.toHaveProperty('approved_english_narration')
    expect(JSON.parse(calls[1])[0]).not.toHaveProperty('approved_english_narration')
  })
})
