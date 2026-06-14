import { describe, it, expect } from 'vitest'
import { normalizeText, parseSizeToken, stripSize, baseName } from '@/lib/scan/normalize'

describe('normalizeText', () => {
  it('lowercases, strips punctuation, collapses spaces', () => {
    expect(normalizeText('  Basmati  Rice! ')).toBe('basmati rice')
  })
})

describe('parseSizeToken', () => {
  it('finds kg / ml sizes', () => {
    expect(parseSizeToken('Basmati Rice 1kg')).toBe('1kg')
    expect(parseSizeToken('Thums Up 200 ml')).toBe('200ml')
  })
  it('returns null when no size', () => {
    expect(parseSizeToken('Basmati Rice')).toBeNull()
  })
})

describe('stripSize + baseName', () => {
  it('removes the size from the name', () => {
    expect(stripSize('Basmati Rice 1kg')).toBe('Basmati Rice')
  })
  it('baseName normalizes the size-stripped name', () => {
    expect(baseName('Basmati Rice 5KG')).toBe('basmati rice')
  })
})
