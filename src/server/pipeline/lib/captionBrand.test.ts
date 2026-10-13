import { describe, it, expect } from 'vitest'
import { fixBrandNameInWords } from './captionBrand'

const w = (text: string, start: number, end: number) => ({ text, start, end })

describe('fixBrandNameInWords', () => {
  it('fixes a one-word misspelling and keeps punctuation', () => {
    expect(fixBrandNameInWords([w('FreshCan', 0, 400), w('visit.', 400, 800)], 'Fresh-CAN')).toEqual([
      w('Fresh-CAN', 0, 400),
      w('visit.', 400, 800),
    ])
  })
  it('merges a split pair into one word spanning both timings', () => {
    expect(fixBrandNameInWords([w('fulfilling', 0, 300), w('fresh', 300, 500), w('can,', 500, 800)], 'Fresh-CAN')).toEqual([
      w('fulfilling', 0, 300),
      w('Fresh-CAN,', 300, 800),
    ])
  })
  it('leaves other words and non-arrays alone', () => {
    const words = [w('fresh', 0, 200), w('produce', 200, 500)]
    expect(fixBrandNameInWords(words, 'Fresh-CAN')).toEqual(words)
    expect(fixBrandNameInWords(null, 'Fresh-CAN')).toBeNull()
  })
})

describe('mishearings and spoken form', () => {
  it('repairs "Fresh Khan" (real job f63f3f5c) when the brand lists that mishearing', () => {
    const words = [w('by', 0, 100), w('Fresh', 100, 300), w('Khan', 300, 600), w('lingers,', 600, 900)]
    expect(fixBrandNameInWords(words, 'Fresh-CAN', ['khan', 'kahn'])).toEqual([
      w('by', 0, 100),
      w('Fresh-CAN', 100, 600),
      w('lingers,', 600, 900),
    ])
    // not repaired without the list
    expect(fixBrandNameInWords(words, 'Fresh-CAN')).toEqual(words)
  })
})

describe('possessive mishearing (real job da0662d8 "thanks to Fresh Kansis")', () => {
  it('repairs "Fresh Kansis" when the brand lists that mishearing', () => {
    const words = [w('thanks', 0, 100), w('to', 100, 200), w('Fresh', 200, 400), w('Kansis.', 400, 800)]
    expect(fixBrandNameInWords(words, 'Fresh-CAN', ['kansis'])).toEqual([
      w('thanks', 0, 100),
      w('to', 100, 200),
      w('Fresh-CAN.', 200, 800),
    ])
  })
})

describe('brandForSpeech', () => {
  it('respells the brand as plain words for the voice model only', async () => {
    const { brandForSpeech } = await import('./captionBrand')
    expect(brandForSpeech('brought by Fresh-CAN lingers', 'Fresh-CAN')).toBe('brought by Fresh Can lingers')
    expect(brandForSpeech('the FRESH-CAN app and Fresh-CAN.', 'Fresh-CAN')).toBe('the Fresh Can app and Fresh Can.')
    expect(brandForSpeech('fresh produce', 'Fresh-CAN')).toBe('fresh produce')
    expect(brandForSpeech('hello', 'Acme')).toBe('hello')
  })
})

describe('possessive brand (job e31d325e: caption read "Fresh Can\'s")', () => {
  it('fixes a split pair and a one-word form with a possessive', () => {
    expect(fixBrandNameInWords([w('by', 0, 100), w('Fresh', 100, 300), w("Can's", 300, 600)], 'Fresh-CAN')).toEqual([
      w('by', 0, 100),
      w("Fresh-CAN's", 100, 600),
    ])
    expect(fixBrandNameInWords([w("FreshCan's", 0, 500)], 'Fresh-CAN')).toEqual([w("Fresh-CAN's", 0, 500)])
    expect(fixBrandNameInWords([w('Fresh', 0, 300), w('Can\u2019s,', 300, 600)], 'Fresh-CAN')).toEqual([w('Fresh-CAN\u2019s,', 0, 600)])
  })
})
