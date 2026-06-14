import { describe, it, expect } from 'vitest'
import { matchItem, type CatalogEntry } from '@/lib/scan/match'

const catalog: CatalogEntry[] = [
  { id: 'r1', name: 'Basmati Rice 1kg', brand: null, parentId: null, unitPrice: 60, freq: 5 },
  { id: 'r5', name: 'Basmati Rice 5kg', brand: null, parentId: null, unitPrice: 280, freq: 1 },
  { id: 'sg', name: 'Sugar 1kg', brand: null, parentId: null, unitPrice: 42, freq: 3 },
  { id: 'sp', name: 'Sprite 600ml', brand: 'Coca-Cola', parentId: null, unitPrice: 40, freq: 2 },
]

describe('matchItem', () => {
  it('matches a plain family name to the most-frequent variant when size is absent', () => {
    const r = matchItem({ normalizedName: 'basmati rice', sizeToken: null }, catalog)
    expect(r.matchState).toBe('matched')
    expect(r.matchedProductId).toBe('r1') // freq 5 wins
  })

  it('matches the exact variant when the size is present', () => {
    const r = matchItem({ normalizedName: 'basmati rice', sizeToken: '5kg' }, catalog)
    expect(r.matchState).toBe('matched')
    expect(r.matchedProductId).toBe('r5')
  })

  it('asks for the variant when sizes tie and no size is given', () => {
    const tied: CatalogEntry[] = [
      { id: 'a', name: 'Atta 1kg', brand: null, parentId: null, unitPrice: 50, freq: 2 },
      { id: 'b', name: 'Atta 5kg', brand: null, parentId: null, unitPrice: 230, freq: 2 },
    ]
    const r = matchItem({ normalizedName: 'atta', sizeToken: null }, tied)
    expect(r.matchState).toBe('variant_choice')
    expect(r.candidates.map(c => c.productId).sort()).toEqual(['a', 'b'])
  })

  it('suggests candidates for a fuzzy/typo name', () => {
    const r = matchItem({ normalizedName: 'bsmti rce', sizeToken: null }, catalog)
    expect(['suggest', 'matched']).toContain(r.matchState)
    expect(r.candidates.length).toBeGreaterThan(0)
  })

  it('returns unmatched for something not in the catalog', () => {
    const r = matchItem({ normalizedName: 'car battery', sizeToken: null }, catalog)
    expect(r.matchState).toBe('unmatched')
  })

  it('matches a single-variant family directly', () => {
    const r = matchItem({ normalizedName: 'sugar', sizeToken: null }, catalog)
    expect(r.matchState).toBe('matched')
    expect(r.matchedProductId).toBe('sg')
  })
})
