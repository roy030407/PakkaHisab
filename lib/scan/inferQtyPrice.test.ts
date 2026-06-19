import { describe, it, expect } from 'vitest'
import { inferQtyPrice } from '@/lib/scan/inferQtyPrice'
import type { NumberToken } from '@/types'

const tok = (value: number, over: Partial<NumberToken> = {}): NumberToken => ({
  value, guessedRole: 'unknown', hasCurrencyMarker: false, hasMultiplyMarker: false, confidence: 'medium', ...over,
})

describe('inferQtyPrice', () => {
  it('keeps explicit qty and price when present', () => {
    const r = inferQtyPrice([tok(3, { guessedRole: 'quantity' }), tok(60, { guessedRole: 'price', hasCurrencyMarker: true })], 60)
    expect(r).toMatchObject({ quantity: 3, unitPrice: 60, ambiguousQtyPrice: false })
  })

  it('treats a currency-marked single number as price, qty defaults 1', () => {
    const r = inferQtyPrice([tok(60, { hasCurrencyMarker: true })], 60)
    expect(r).toMatchObject({ quantity: 1, unitPrice: 60, fillSource: 'bill', needsVerify: true })
  })

  it('treats a multiply-marked single number as quantity, price from catalog', () => {
    const r = inferQtyPrice([tok(20, { hasMultiplyMarker: true })], 60)
    expect(r).toMatchObject({ quantity: 20, unitPrice: 60, fillSource: 'catalog', needsVerify: true })
  })

  it('uses catalog price: number near catalog price is the price', () => {
    const r = inferQtyPrice([tok(58)], 60)
    expect(r).toMatchObject({ quantity: 1, unitPrice: 58, fillSource: 'bill', needsVerify: true })
  })

  it('uses catalog price: small number far from catalog price is the quantity, autofills price', () => {
    const r = inferQtyPrice([tok(20)], 60)
    expect(r).toMatchObject({ quantity: 20, unitPrice: 60, fillSource: 'catalog', needsVerify: true, ambiguousQtyPrice: false })
  })

  it('is ambiguous when a bare number has no catalog price to compare against', () => {
    const r = inferQtyPrice([tok(20)], null)
    expect(r).toMatchObject({ ambiguousQtyPrice: true, needsVerify: true })
  })

  it('derives the missing side from a total', () => {
    const r = inferQtyPrice([tok(5, { guessedRole: 'quantity' }), tok(300, { guessedRole: 'total' })], 60)
    expect(r).toMatchObject({ quantity: 5, unitPrice: 60 })
  })

  it('does NOT ask qty-vs-price when there are no numbers (qty 1, price 0, not ambiguous)', () => {
    const r = inferQtyPrice([], null)
    expect(r).toMatchObject({ quantity: 1, unitPrice: 0, ambiguousQtyPrice: false })
  })

  it('does NOT ask qty-vs-price for a bare ZERO (nothing to disambiguate)', () => {
    const r = inferQtyPrice([tok(0)], null)
    expect(r).toMatchObject({ ambiguousQtyPrice: false })
  })

  it('fills the catalog price when there are no usable numbers', () => {
    const r = inferQtyPrice([], 60)
    expect(r).toMatchObject({ quantity: 1, unitPrice: 60, fillSource: 'catalog', ambiguousQtyPrice: false })
  })
})
