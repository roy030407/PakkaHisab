import { describe, it, expect } from 'vitest'
import { computeCashPosition, cashDifference } from './cashReconciliation'

const tx = (type: string, paymentMethod: string | null, totalAmount: number) => ({ type, paymentMethod, totalAmount })

describe('computeCashPosition', () => {
  it('sums cash in across sale, income, and payment (cash method)', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [
        tx('sale', 'cash', 100),
        tx('income', 'cash', 50),
        tx('payment', 'cash', 30),
      ],
    })
    expect(r.cashIn).toBe(180)
    expect(r.cashOut).toBe(0)
    expect(r.expectedCash).toBe(180)
  })

  it('sums cash out across purchase and expense (cash method)', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [tx('purchase', 'cash', 70), tx('expense', 'cash', 20)],
    })
    expect(r.cashOut).toBe(90)
    expect(r.expectedCash).toBe(-90)
  })

  it('applies the opening float to expected cash', () => {
    const r = computeCashPosition({
      openingCash: 500,
      transactions: [tx('sale', 'cash', 100), tx('expense', 'cash', 40)],
    })
    expect(r.expectedCash).toBe(560)
  })

  it('excludes credit from cash and counts UPI only in the upi tally', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [
        tx('sale', 'credit', 1000), // ignored for cash and upi
        tx('sale', 'upi', 200),     // upi tally only
        tx('payment', 'upi', 150),  // upi tally only
        tx('sale', 'cash', 80),     // cash in
      ],
    })
    expect(r.cashIn).toBe(80)
    expect(r.upiTotal).toBe(350)
    expect(r.expectedCash).toBe(80)
  })

  it('a UPI purchase does not reduce cash', () => {
    const r = computeCashPosition({
      openingCash: 100,
      transactions: [tx('purchase', 'upi', 60)],
    })
    expect(r.cashOut).toBe(0)
    expect(r.expectedCash).toBe(100)
  })

  it('an empty day leaves expected equal to opening', () => {
    const r = computeCashPosition({ openingCash: 250, transactions: [] })
    expect(r).toEqual({ cashIn: 0, cashOut: 0, expectedCash: 250, upiTotal: 0 })
  })
})

describe('cashDifference', () => {
  it('is zero when counted equals expected', () => {
    expect(cashDifference(500, 500)).toBe(0)
  })
  it('is negative when short', () => {
    expect(cashDifference(450, 500)).toBe(-50)
  })
  it('is positive when over', () => {
    expect(cashDifference(530, 500)).toBe(30)
  })
})
