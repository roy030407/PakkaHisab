import { describe, it, expect } from 'vitest'
import { balanceReversalAmount, inventoryReversals } from './reverse'

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

  it('payment moves no stock', () => {
    expect(inventoryReversals('payment', [{ productId: 'p1', quantity: 2 }])).toEqual([])
  })
})

describe('balanceReversalAmount', () => {
  it('deleting a credit sale subtracts the amount from the balance (positive reversal)', () => {
    expect(
      balanceReversalAmount({ type: 'sale', paymentMethod: 'credit', customerId: 'c1', totalAmount: 500 })
    ).toBe(500)
  })

  it('a cash sale never touches the balance', () => {
    expect(
      balanceReversalAmount({ type: 'sale', paymentMethod: 'cash', customerId: 'c1', totalAmount: 500 })
    ).toBe(0)
  })

  it('is zero when there is no customer', () => {
    expect(
      balanceReversalAmount({ type: 'sale', paymentMethod: 'credit', customerId: null, totalAmount: 250 })
    ).toBe(0)
  })

  it('is zero for a credit purchase', () => {
    expect(
      balanceReversalAmount({ type: 'purchase', paymentMethod: 'credit', customerId: 'c1', totalAmount: 250 })
    ).toBe(0)
  })

  it('deleting a payment re-adds the amount to the balance (negative reversal)', () => {
    expect(
      balanceReversalAmount({ type: 'payment', paymentMethod: 'cash', customerId: 'c1', totalAmount: 300 })
    ).toBe(-300)
  })

  it('a payment with no customer is a no-op', () => {
    expect(
      balanceReversalAmount({ type: 'payment', paymentMethod: 'cash', customerId: null, totalAmount: 300 })
    ).toBe(0)
  })

  it('an expense never touches the balance', () => {
    expect(
      balanceReversalAmount({ type: 'expense', paymentMethod: 'cash', customerId: 'c1', totalAmount: 300 })
    ).toBe(0)
  })
})
