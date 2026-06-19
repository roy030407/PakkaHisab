import { describe, it, expect } from 'vitest'
import { addRowsToCart, setRowQuantity, cartTotal } from '@/lib/voice/cart'
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
