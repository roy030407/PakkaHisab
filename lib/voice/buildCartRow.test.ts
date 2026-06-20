import { describe, it, expect } from 'vitest'
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import type { MatchResult } from '@/lib/scan/match'

describe('buildPendingRow', () => {
  it('uses the matched product id and its catalog price', () => {
    const match: MatchResult = {
      matchState: 'matched',
      matchedProductId: 'p1',
      matchedProductName: 'Parle-G 70g',
      candidates: [
        { productId: 'p1', name: 'Parle-G 70g', unitPrice: 10, sizeToken: '70g' },
        { productId: 'p2', name: 'Parle-G 140g', unitPrice: 20, sizeToken: '140g' },
      ],
    }
    const row = buildPendingRow({ name: 'Parle-G', quantity: 5 }, match)
    expect(row).toEqual({ productId: 'p1', name: 'Parle-G 70g', quantity: 5, unitPrice: 10, addAsNew: false })
  })

  it('falls back to the top candidate for a suggest match', () => {
    const match: MatchResult = {
      matchState: 'suggest',
      candidates: [
        { productId: 'm1', name: 'Amul Milk 500ml', unitPrice: 27, sizeToken: '500ml' },
        { productId: 'm2', name: 'Mother Dairy Milk 500ml', unitPrice: 26, sizeToken: '500ml' },
      ],
    }
    const row = buildPendingRow({ name: 'doodh', quantity: 1 }, match)
    expect(row.productId).toBe('m1')
    expect(row.unitPrice).toBe(27)
    expect(row.addAsNew).toBe(false)
  })

  it('falls back to the top candidate for a variant_choice match', () => {
    const match: MatchResult = {
      matchState: 'variant_choice',
      candidates: [
        { productId: 'a1', name: 'Atta 1kg', unitPrice: 50, sizeToken: '1kg' },
        { productId: 'a5', name: 'Atta 5kg', unitPrice: 230, sizeToken: '5kg' },
      ],
    }
    const row = buildPendingRow({ name: 'atta', quantity: 2 }, match)
    expect(row.productId).toBe('a1')
    expect(row.addAsNew).toBe(false)
  })

  it('marks a true unmatched item as add-as-new with the spoken name and price 0', () => {
    const match: MatchResult = { matchState: 'unmatched', candidates: [] }
    const row = buildPendingRow({ name: 'Imported Toffee', quantity: 3 }, match)
    expect(row).toEqual({ productId: null, name: 'Imported Toffee', quantity: 3, unitPrice: 0, addAsNew: true })
  })
})
