import { describe, it, expect } from 'vitest'
import { inventoryReversals, balanceReversalAmount } from '@/lib/transactions/reverse'

describe('inventoryReversals', () => {
  it('adds stock back when a sale is deleted', () => {
    expect(inventoryReversals('sale', [{ productId: 'p1', quantity: 3 }])).toEqual([{ productId: 'p1', delta: 3 }])
  })

  it('removes stock when a purchase is deleted', () => {
    expect(inventoryReversals('purchase', [{ productId: 'p1', quantity: 4 }])).toEqual([{ productId: 'p1', delta: -4 }])
  })

  it('does not touch stock for expense or income', () => {
    expect(inventoryReversals('expense', [{ productId: 'p1', quantity: 5 }])).toEqual([])
    expect(inventoryReversals('income', [{ productId: 'p1', quantity: 5 }])).toEqual([])
  })

  it('handles multiple line items', () => {
    expect(inventoryReversals('sale', [
      { productId: 'a', quantity: 2 },
      { productId: 'b', quantity: 1 },
    ])).toEqual([{ productId: 'a', delta: 2 }, { productId: 'b', delta: 1 }])
  })
})

describe('balanceReversalAmount', () => {
  it('subtracts a credit sale amount', () => {
    expect(balanceReversalAmount({ type: 'sale', paymentMethod: 'credit', customerId: 'c1', totalAmount: 250 })).toBe(250)
  })

  it('is zero for a cash sale', () => {
    expect(balanceReversalAmount({ type: 'sale', paymentMethod: 'cash', customerId: 'c1', totalAmount: 250 })).toBe(0)
  })

  it('is zero when there is no customer', () => {
    expect(balanceReversalAmount({ type: 'sale', paymentMethod: 'credit', customerId: null, totalAmount: 250 })).toBe(0)
  })

  it('is zero for a credit purchase', () => {
    expect(balanceReversalAmount({ type: 'purchase', paymentMethod: 'credit', customerId: 'c1', totalAmount: 250 })).toBe(0)
  })
})
