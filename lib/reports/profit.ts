/**
 * FILE: lib/reports/profit.ts
 *
 * WHAT THIS DOES:
 *   Calculates gross margin and net profit for any reporting period.
 *   Fixed costs are allocated proportionally to the period length.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Added expenses param to calculateProfit, subtracted from netProfit
 *
 * WHERE IT FITS:
 *   Used by /api/reports to produce the profit breakdown card.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/reports/route.ts
 */

export interface ProfitResult {
  sales: number
  purchases: number
  expenses: number
  grossMargin: number
  fixedCosts: number
  netProfit: number
  marginPct: number  // grossMargin / sales * 100; 0 when sales = 0
}

export function calculateProfit(
  sales: number,
  purchases: number,
  fixedCosts: number,
  expenses: number = 0
): ProfitResult {
  const grossMargin = sales - purchases
  const netProfit = grossMargin - fixedCosts - expenses
  const marginPct = sales > 0 ? Math.round((grossMargin / sales) * 1000) / 10 : 0

  return {
    sales: Math.round(sales),
    purchases: Math.round(purchases),
    expenses: Math.round(expenses),
    grossMargin: Math.round(grossMargin),
    fixedCosts: Math.round(fixedCosts),
    netProfit: Math.round(netProfit),
    marginPct,
  }
}
