import { describe, it, expect } from 'vitest'
import { fitSceneDurations, fixUnitCrossingScenes, judgeDoorwayCrossings, lockSceneCamera, normalizeScriptOutput } from './generateScript'

const VALID = {
  script: 'A short script.',
  visual_description: 'The truck arrives.',
  duration_seconds: 20,
  scenes: [
    {
      scene_number: 1,
      visual_description: 'The truck pulls up.',
      shot_notes: 'Wide shot.',
      narration_intent: 'Introduce the truck.',
      target_duration_seconds: 10,
    },
    {
      scene_number: 2,
      visual_description: 'A family shops.',
      narration_intent: 'Show a family shopping.',
      target_duration_seconds: 10,
    },
  ],
}

describe('normalizeScriptOutput', () => {
  it('accepts a well-formed response as-is', () => {
    const result = normalizeScriptOutput(VALID)
    expect(result).not.toBeNull()
    expect(result!.scenes).toHaveLength(2)
    expect(result!.scenes[1].shot_notes).toBeUndefined()
  })

  it('coerces numeric fields the model sent as quoted strings — the live failure mode this fix targets', () => {
    const withStringNumbers = {
      ...VALID,
      duration_seconds: '20',
      scenes: VALID.scenes.map((s) => ({
        ...s,
        scene_number: String(s.scene_number),
        target_duration_seconds: String(s.target_duration_seconds),
      })),
    }
    const result = normalizeScriptOutput(withStringNumbers)
    expect(result).not.toBeNull()
    expect(result!.duration_seconds).toBe(20)
    expect(typeof result!.duration_seconds).toBe('number')
    expect(result!.scenes[0].scene_number).toBe(1)
    expect(typeof result!.scenes[0].scene_number).toBe('number')
  })

  it('returns null for non-JSON / non-object input (e.g. conversational prose the model prefixed the JSON with)', () => {
    expect(normalizeScriptOutput(null)).toBeNull()
    expect(normalizeScriptOutput('Sure, here is the script!')).toBeNull()
  })

  it('returns null when scenes is missing or empty', () => {
    expect(normalizeScriptOutput({ ...VALID, scenes: [] })).toBeNull()
    const { scenes: _scenes, ...withoutScenes } = VALID
    expect(normalizeScriptOutput(withoutScenes)).toBeNull()
  })

  it('returns null when a scene is missing a required field, even with otherwise-valid numbers', () => {
    const missingNarration = {
      ...VALID,
      scenes: [{ scene_number: 1, visual_description: 'x', target_duration_seconds: 10 }],
    }
    expect(normalizeScriptOutput(missingNarration)).toBeNull()
  })

  it('returns null when a number field is genuinely non-numeric, not silently coerced to 0', () => {
    const badNumber = {
      ...VALID,
      scenes: [{ ...VALID.scenes[0], scene_number: 'not-a-number' }],
    }
    expect(normalizeScriptOutput(badNumber)).toBeNull()
  })

  describe('Layer 2 planning fields (PROMPT_REFACTOR_BRIEF.md §4.3)', () => {
    const WITH_PLAN = {
      ...VALID,
      story: { hook: 'A quiet morning.', arc: 'Discovery.', resolution: 'Relief.', cta: null },
      look: { time_of_day: 'morning', lighting: 'soft', palette: 'warm', style_direction: 'documentary', camera_language: 'handheld' },
      cast_bible: [
        { id: 'mother', role: 'protagonist', age_range: '30s', appearance: 'curly hair', wardrobe: 'blue coat', distinguishing_details: 'red scarf' },
      ],
      locations: [{ id: 'street', description: 'a quiet residential street', continuity_details: 'autumn leaves on the ground' }],
      scenes: VALID.scenes.map((s, i) => ({
        ...s,
        beat: i === 0 ? 'hook' : 'payoff',
        cast_present: ['mother'],
        props_present: ['reusable bag'],
        unit_presence: 'background',
        unit_presence_rationale: 'The unit is parked down the street but the scene is really about the walk.',
        setting: 'exterior',
        contains_food: false,
        is_final_scene: i === 1,
      })),
    }

    it('accepts a fully plan-populated response and preserves every field', () => {
      const result = normalizeScriptOutput(WITH_PLAN)
      expect(result).not.toBeNull()
      expect(result!.story).toEqual(WITH_PLAN.story)
      expect(result!.look).toEqual(WITH_PLAN.look)
      expect(result!.cast_bible).toEqual(WITH_PLAN.cast_bible)
      expect(result!.locations).toEqual(WITH_PLAN.locations)
      expect(result!.scenes[0].beat).toBe('hook')
      expect(result!.scenes[0].cast_present).toEqual(['mother'])
      expect(result!.scenes[0].unit_presence).toBe('background')
      expect(result!.scenes[0].unit_presence_rationale).toBe(WITH_PLAN.scenes[0].unit_presence_rationale)
      expect(result!.scenes[0].setting).toBe('exterior')
      expect(result!.scenes[0].contains_food).toBe(false)
      expect(result!.scenes[1].is_final_scene).toBe(true)
    })

    it('omits every Layer 2 field (never fails the core script) when none are given — legacy/plain response', () => {
      const result = normalizeScriptOutput(VALID)
      expect(result).not.toBeNull()
      expect(result!.story).toBeUndefined()
      expect(result!.look).toBeUndefined()
      expect(result!.cast_bible).toBeUndefined()
      expect(result!.locations).toBeUndefined()
      expect(result!.scenes[0].beat).toBeUndefined()
      expect(result!.scenes[0].unit_presence).toBeUndefined()
      expect(result!.scenes[0].unit_presence_rationale).toBeUndefined()
    })

    it('drops a cast_bible/locations entry with no id, rather than keeping one with a made-up id', () => {
      const result = normalizeScriptOutput({
        ...VALID,
        cast_bible: [{ role: 'no id here' }],
        locations: [{ description: 'no id here either' }],
      })
      expect(result).not.toBeNull()
      expect(result!.cast_bible).toBeUndefined()
      expect(result!.locations).toBeUndefined()
    })

    it('rejects an unrecognized unit_presence/setting value rather than accepting it as free text', () => {
      const result = normalizeScriptOutput({
        ...VALID,
        scenes: [{ ...VALID.scenes[0], unit_presence: 'sometimes', setting: 'space' }, VALID.scenes[1]],
      })
      expect(result).not.toBeNull()
      expect(result!.scenes[0].unit_presence).toBeUndefined()
      expect(result!.scenes[0].setting).toBeUndefined()
    })

    it('accepts a partially-specified look/story object rather than discarding it wholesale', () => {
      const result = normalizeScriptOutput({ ...VALID, look: { lighting: 'golden hour' } })
      expect(result).not.toBeNull()
      expect(result!.look).toEqual({ lighting: 'golden hour' })
    })
  })
})

describe('fitSceneDurations', () => {
  const of = (...secs: number[]) => secs.map((target_duration_seconds, i) => ({ scene_number: i + 1, target_duration_seconds }))
  const sum = (scenes: { target_duration_seconds: number }[]) => scenes.reduce((a, s) => a + s.target_duration_seconds, 0)

  it("brings job 790b8771's 38s plan down to the requested 36s", () => {
    const fitted = fitSceneDurations(of(7, 8, 6, 9, 8), 36)
    expect(sum(fitted)).toBe(36)
  })

  it('brings an under-length plan up to the request (job 5d2dd9a2 planned 37s; 8b682bc9 and f0df42af were short)', () => {
    expect(sum(fitSceneDurations(of(5, 6, 4, 5, 6), 36))).toBe(36)
  })

  it('leaves an already-exact plan unchanged when every scene is within the 7s preferred cap', () => {
    expect(fitSceneDurations(of(6, 6, 6, 6, 6, 6), 36).map((s) => s.target_duration_seconds)).toEqual([6, 6, 6, 6, 6, 6])
  })

  it('pulls a scene above the 7s preferred cap back to 7 when the scene count allows it (long clips loop)', () => {
    const fitted = fitSceneDurations(of(5, 6, 7, 9, 5, 4), 36)
    expect(sum(fitted)).toBe(36)
    for (const s of fitted) expect(s.target_duration_seconds).toBeLessThanOrEqual(7)
  })

  it('relaxes the cap, never the total, when too few scenes to fit 7s each', () => {
    const fitted = fitSceneDurations(of(8, 8, 8, 8), 36)
    expect(sum(fitted)).toBe(36)
    for (const s of fitted) expect(s.target_duration_seconds).toBeLessThanOrEqual(9)
  })

  it('keeps every scene within the 4-11s bounds and whole seconds', () => {
    const fitted = fitSceneDurations(of(3, 20, 5, 2, 30), 40)
    for (const s of fitted) {
      expect(Number.isInteger(s.target_duration_seconds)).toBe(true)
      expect(s.target_duration_seconds).toBeGreaterThanOrEqual(4)
      expect(s.target_duration_seconds).toBeLessThanOrEqual(11)
    }
    expect(sum(fitted)).toBe(40)
  })

  it('preserves the relative pacing of the model plan', () => {
    const fitted = fitSceneDurations(of(4, 6, 4), 14)
    expect(fitted[1].target_duration_seconds).toBeGreaterThan(fitted[0].target_duration_seconds)
  })

  it('relaxes the 4s floor only when the scene count makes it impossible, and still sums exactly', () => {
    const fitted = fitSceneDurations(of(4, 4, 4, 4, 4, 4, 4, 4, 4, 4), 32)
    expect(sum(fitted)).toBe(32)
  })

  it('does not mutate the input scenes and preserves their other fields', () => {
    const input = of(7, 8, 6, 9, 8)
    const fitted = fitSceneDurations(input, 36)
    expect(input.map((s) => s.target_duration_seconds)).toEqual([7, 8, 6, 9, 8])
    expect(fitted.map((s) => s.scene_number)).toEqual([1, 2, 3, 4, 5])
  })

  it('returns scenes untouched for an invalid total rather than inventing durations', () => {
    expect(fitSceneDurations(of(7, 8), 0).map((s) => s.target_duration_seconds)).toEqual([7, 8])
  })
})

describe('fixUnitCrossingScenes', () => {
  const scene = (n: number, v: string) => ({ scene_number: n, visual_description: v, narration_intent: 'x', target_duration_seconds: 7 })
  const gen = (scenes: unknown) => ({ generate: async () => ({ parsed: { scenes }, raw: '' }) }) as never

  it('flags exits from the unit but not home or street exits', async () => {
    const { visualDescribesUnitCrossing } = await import('./localizeScript')
    expect(visualDescribesUnitCrossing('Sarah and Daniel exit the unit with grocery bags')).toBe(true)
    expect(visualDescribesUnitCrossing('The couple steps out onto a charming street bathed in warm, golden evening light. They spot a Fresh-CAN unit ahead.')).toBe(false)
  })

  it('rewrites a flagged scene and leaves the others', async () => {
    const scenes = [scene(1, 'They chop vegetables.'), scene(2, 'They exit the unit with bags.')]
    const out = await fixUnitCrossingScenes(
      scenes,
      gen([{ scene_number: 2, visual_description: 'They stand beside the unit holding bags.', shot_notes: 'Side view.' }]),
    )
    expect(out[0]).toBe(scenes[0])
    expect(out[1].visual_description).toBe('They stand beside the unit holding bags.')
    expect(out[1].shot_notes).toBe('Side view.')
  })

  it('keeps the original when the rewrite still crosses or the call fails', async () => {
    const scenes = [scene(1, 'They exit the unit with bags.')]
    const still = await fixUnitCrossingScenes(scenes, gen([{ scene_number: 1, visual_description: 'They walk out of the truck.', shot_notes: '' }]))
    expect(still[0]).toBe(scenes[0])
    const boom = await fixUnitCrossingScenes(scenes, { generate: async () => { throw new Error('x') } } as never)
    expect(boom[0]).toBe(scenes[0])
  })
})

describe('visualDescribesUnitCrossing — wider phrasings', () => {
  it('flags crossings the original patterns missed', async () => {
    const { visualDescribesUnitCrossing: f } = await import('./localizeScript')
    expect(f('Sarah leaves the unit with her bags')).toBe(true)
    expect(f('A boy comes out of the truck holding apples')).toBe(true)
    expect(f('They walk through the glass doors of the Fresh-CAN unit')).toBe(true)
    expect(f('He hops aboard the truck')).toBe(true)
  })
  it('does not flag scenes beside or away from the unit', async () => {
    const { visualDescribesUnitCrossing: f } = await import('./localizeScript')
    expect(f('Sarah stands on the pavement beside the unit holding her bags')).toBe(false)
    expect(f('The family walks home along the street, the unit parked behind them')).toBe(false)
    expect(f('He heads out onto the street at dusk')).toBe(false)
  })
})

describe('repairSceneLayer2 (job f63f3f5c: scene 2 had no unit and 0 people)', () => {
  const base = {
    scene_number: 2,
    visual_description: "Close-up of friend1 scanning the QR code at the unit's door.",
    narration_intent: 'x',
    target_duration_seconds: 4,
  }

  it('upgrades an exterior "none" scene whose text puts the action at the unit', async () => {
    const { repairSceneLayer2 } = await import('./generateScript')
    const fixed = repairSceneLayer2({ ...base, unit_presence: 'none', setting: 'exterior' })
    expect(fixed.unit_presence).toBe('background')
    expect(fixed.unit_presence_rationale).toMatch(/corrected/)
  })

  it('leaves unrelated, interior, and already-present scenes alone', async () => {
    const { repairSceneLayer2 } = await import('./generateScript')
    const street = { ...base, visual_description: 'Two friends walk down a street.', unit_presence: 'none' as const, setting: 'unrelated' as const }
    expect(repairSceneLayer2(street)).toBe(street)
    const interior = { ...base, unit_presence: 'none' as const, setting: 'interior' as const }
    expect(repairSceneLayer2(interior).unit_presence).toBe('none')
    const featured = { ...base, unit_presence: 'featured' as const, setting: 'exterior' as const }
    expect(repairSceneLayer2(featured)).toBe(featured)
  })

  it('never lets visual_state.people be fewer than the cast listed as present', async () => {
    const { repairSceneLayer2 } = await import('./generateScript')
    expect(repairSceneLayer2({ ...base, cast_present: ['friend1'], visual_state: { people: 0 } }).visual_state?.people).toBe(1)
    expect(repairSceneLayer2({ ...base, cast_present: ['a', 'b'], visual_state: undefined }).visual_state?.people).toBe(2)
    const ok = { ...base, cast_present: ['a', 'b'], visual_state: { people: 3 } }
    expect(repairSceneLayer2(ok)).toBe(ok)
    const noCast = { ...base, visual_state: { people: 0 } }
    expect(repairSceneLayer2(noCast)).toBe(noCast)
  })
})

describe('lockSceneCamera (job 369ff9de: "slow pan" and "tracking shot from behind" gave morphing backgrounds)', () => {
  const base = { scene_number: 1, visual_description: 'v', narration_intent: 'n', target_duration_seconds: 6, cast_present: ['a'] }

  it('rewrites camera-movement shot notes to a static shot that keeps the framing', () => {
    const out = lockSceneCamera({ ...base, shot_notes: 'wide shot with a slow pan to follow the worker\'s movement' })
    expect(out.shot_notes).toMatch(/^Static wide shot, locked-off camera with no camera movement/)
    expect(lockSceneCamera({ ...base, shot_notes: 'wide tracking shot from behind' }).shot_notes).toMatch(/^Static wide shot/)
    expect(lockSceneCamera({ ...base, shot_notes: 'slow push-in on a medium close-up' }).shot_notes).toMatch(/^Static medium close-up,/)
  })

  it('falls back to a plain static note when no framing word is present', () => {
    expect(lockSceneCamera({ ...base, shot_notes: 'dolly through the aisle' }).shot_notes).toMatch(/^Static shot, locked-off/)
  })

  it('returns the same object when shot notes are already static, empty, or the scene has no people', () => {
    const still = { ...base, shot_notes: 'static low-angle wide shot, soft window light' }
    expect(lockSceneCamera(still)).toBe(still)
    const none = { ...base }
    expect(lockSceneCamera(none)).toBe(none)
    const noPeople = { ...base, cast_present: [], shot_notes: 'slow pan across the street' }
    expect(lockSceneCamera(noPeople)).toBe(noPeople)
  })
})

describe('doorway crossings judged by meaning (job 369ff9de scene 4: "steps back outside", "reemerges")', () => {
  const scene = (n: number, v: string, narr = 'x') => ({ scene_number: n, visual_description: v, narration_intent: narr, target_duration_seconds: 7 })
  const seq = (...replies: unknown[]) => {
    let i = 0
    return { generate: async () => ({ parsed: replies[Math.min(i++, replies.length - 1)], raw: '' }) } as never
  }

  it('the keyword patterns alone miss both phrasings, which is why the judge exists', async () => {
    const { visualDescribesUnitCrossing, narrationDescribesCrossing } = await import('./localizeScript')
    expect(visualDescribesUnitCrossing('The worker steps back outside into the autumn morning, an apple in hand.')).toBe(false)
    expect(narrationDescribesCrossing('As the worker reemerges under the crisp autumn sky, they feel at ease.')).toBe(true) // now caught
  })

  it('judgeDoorwayCrossings returns the scenes the model says cross, and fails open', async () => {
    const got = await judgeDoorwayCrossings(
      [scene(1, 'a'), scene(2, 'b')],
      seq({ scenes: [{ scene_number: 1, crosses_doorway: false }, { scene_number: 2, crosses_doorway: true }] }),
    )
    expect([...got]).toEqual([2])
    expect((await judgeDoorwayCrossings([scene(1, 'a')], { generate: async () => { throw new Error('x') } } as never)).size).toBe(0)
    expect((await judgeDoorwayCrossings([scene(1, 'a')], seq({ nope: 1 }))).size).toBe(0)
  })

  it('rewrites a scene the judge flags even though no keyword matches, and fixes its narration and camera too', async () => {
    const scenes = [
      scene(1, 'They chop vegetables.'),
      { ...scene(2, 'The worker steps back outside into the autumn morning, an apple in hand.', 'The worker comes back into the daylight with their apple and feels relieved'), cast_present: ['worker'] },
    ]
    const out = await fixUnitCrossingScenes(
      scenes,
      seq(
        { scenes: [{ scene_number: 2, crosses_doorway: true }] },
        {
          scenes: [
            {
              scene_number: 2,
              visual_description: 'The worker stands on the pavement beside the closed unit, an apple in hand, relieved.',
              shot_notes: 'slow pan across the pavement',
              narration_intent: 'The worker is already outside with their apple and feels relieved and satisfied',
            },
          ],
        },
      ),
    )
    expect(out[0]).toBe(scenes[0])
    expect(out[1].visual_description).toContain('beside the closed unit')
    expect(out[1].narration_intent).toContain('already outside')
    expect(out[1].shot_notes).toMatch(/^Static shot, locked-off camera/) // the rewrite's "slow pan" is locked off
  })

  it('keeps the original narration when the rewrite still crosses or changes length too much', async () => {
    const scenes = [scene(1, 'They exit the unit with bags.', 'They leave the unit with bags and feel happy today')]
    const out = await fixUnitCrossingScenes(
      scenes,
      seq({ scenes: [] }, { scenes: [{ scene_number: 1, visual_description: 'They stand beside the unit.', shot_notes: '', narration_intent: 'They exit the unit' }] }),
    )
    expect(out[0].visual_description).toBe('They stand beside the unit.')
    expect(out[0].narration_intent).toBe('They leave the unit with bags and feel happy today')
  })
})
