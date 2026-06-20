import { describe, it, expect } from 'vitest'
import { addRowsToCart, setRowQuantity, cartTotal, removeLastRow, setLastRowQuantity } from '@/lib/voice/cart'
import type { VoiceCartRow } from '@/lib/voice/types'

const row = (productId: string, quantity: number, unitPrice: number): VoiceCartRow =>
  ({ productId, name: productId, quantity, unitPrice, addedAsNew: false })

describe('addRowsToCart', () => {
  it('appends new rows and merges duplicates by productId', () => {
    const cart = [row('a', 2, 10)]
    const next = addRowsToCart(cart, [row('a', 3, 10), row('b', 1, 50)])
    expect(next.find(r => r.productId === 'a')!.quantity).toBe(5)
    expect(next.find(r => r.productId === 'b')!.quantity).toBe(1)
  })

  it('does not mutate the input cart', () => {
    const cart = [row('a', 2, 10)]
    addRowsToCart(cart, [row('a', 3, 10)])
    expect(cart[0].quantity).toBe(2)
  })
})

describe('setRowQuantity', () => {
  it('sets the quantity of the matching row', () => {
    const next = setRowQuantity([row('a', 2, 10), row('b', 1, 50)], 'a', 7)
    expect(next.find(r => r.productId === 'a')!.quantity).toBe(7)
  })

  it('removes the row when quantity is zero or below', () => {
    const next = setRowQuantity([row('a', 2, 10), row('b', 1, 50)], 'a', 0)
    expect(next.map(r => r.productId)).toEqual(['b'])
  })
})

describe('cartTotal', () => {
  it('sums unitPrice * quantity across rows', () => {
    expect(cartTotal([row('a', 2, 10), row('b', 3, 50)])).toBe(170)
  })

  it('is zero for an empty cart', () => {
    expect(cartTotal([])).toBe(0)
  })
})

describe('removeLastRow', () => {
  it('drops the last row', () => {
    const next = removeLastRow([row('a', 1, 10), row('b', 2, 20)])
    expect(next.map((r) => r.productId)).toEqual(['a'])
  })

  it('is empty-safe and does not mutate the input', () => {
    expect(removeLastRow([])).toEqual([])
    const cart = [row('a', 1, 10)]
    removeLastRow(cart)
    expect(cart).toHaveLength(1)
  })
})

describe('setLastRowQuantity', () => {
  it('sets the quantity of the last row only', () => {
    const next = setLastRowQuantity([row('a', 1, 10), row('b', 2, 20)], 5)
    expect(next.find((r) => r.productId === 'b')!.quantity).toBe(5)
    expect(next.find((r) => r.productId === 'a')!.quantity).toBe(1)
  })

  it('removes the last row when the quantity is zero or below', () => {
    const next = setLastRowQuantity([row('a', 1, 10), row('b', 2, 20)], 0)
    expect(next.map((r) => r.productId)).toEqual(['a'])
  })

  it('is a no-op on an empty cart', () => {
    expect(setLastRowQuantity([], 3)).toEqual([])
  })
})
