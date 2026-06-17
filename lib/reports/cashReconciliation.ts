/**
 * FILE: lib/reports/cashReconciliation.ts
 *
 * WHAT THIS DOES:
 *   Pure helpers for the end-of-day cash reconciliation ("Din ka hisab").
 *   computeCashPosition derives the physical-cash position (cash in, cash out,
 *   expected cash) and a separate UPI tally from a day's transactions.
 *   cashDifference compares the counted cash to the expected cash. No DB, no I/O,
 *   so the money logic is unit-tested in isolation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice C cash reconciliation)
 *
 * WHERE IT FITS:
 *   Used by app/api/reconciliation/route.ts (server-side recompute) and the
 *   /reconcile screen (live expected/difference).
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/reconciliation/route.ts, app/(dashboard)/reconcile/page.tsx
 */

export interface CashTxn {
  type: string
  paymentMethod: string | null
  totalAmount: number
}

export interface CashPosition {
  cashIn: number
  cashOut: number
  expectedCash: number
  upiTotal: number
}

const IN_TYPES = new Set(['sale', 'income', 'payment'])
const OUT_TYPES = new Set(['purchase', 'expense'])

export function computeCashPosition(input: {
  openingCash: number
  transactions: CashTxn[]
}): CashPosition {
  const opening = Number(input.openingCash) || 0
  let cashIn = 0
  let cashOut = 0
  let upiTotal = 0

  for (const t of input.transactions) {
    const amount = Number(t.totalAmount) || 0
    const isIn = IN_TYPES.has(t.type)
    const isOut = OUT_TYPES.has(t.type)
    if (t.paymentMethod === 'cash') {
      if (isIn) cashIn += amount
      else if (isOut) cashOut += amount
    } else if (t.paymentMethod === 'upi') {
      if (isIn) upiTotal += amount
    }
  }

  return { cashIn, cashOut, expectedCash: opening + cashIn - cashOut, upiTotal }
}

export function cashDifference(countedCash: number, expectedCash: number): number {
  return (Number(countedCash) || 0) - (Number(expectedCash) || 0)
}
