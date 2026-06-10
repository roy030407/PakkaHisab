/**
 * FILE: lib/reports/periods.ts
 *
 * WHAT THIS DOES:
 *   Period boundary helpers for daily/weekly/monthly/yearly report windows.
 *   Also allocates fixed costs to any period length.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *
 * WHERE IT FITS:
 *   Used by /api/dashboard and /api/reports to scope all DB queries.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/dashboard/route.ts, app/api/reports/route.ts
 */

import type { ReportPeriod, CashFlowPoint } from '@/types'
import type { FixedCost } from '@/types'

export interface PeriodBounds {
  start: Date
  end: Date
  label: string
}

export function getPeriodBounds(period: ReportPeriod): PeriodBounds {
  const now = new Date()

  switch (period) {
    case 'daily': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
      return { start, end, label: 'Today' }
    }
    case 'weekly': {
      const day = now.getDay() // 0=Sun
      const diff = day === 0 ? 6 : day - 1 // make Monday the start
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
      return { start, end, label: 'This week' }
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      return { start, end, label: 'This month' }
    }
    case 'yearly': {
      const start = new Date(now.getFullYear(), 0, 1)
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
      return { start, end, label: `FY ${now.getFullYear()}` }
    }
  }
}

export function getTodayBounds(): { start: string; end: string } {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  return { start: date, end: date }
}

/** Daily cost of a fixed cost item regardless of its frequency. */
function dailyCost(cost: FixedCost): number {
  switch (cost.frequency) {
    case 'daily':   return cost.amount
    case 'weekly':  return cost.amount / 7
    case 'monthly': return cost.amount / 30
    case 'yearly':  return cost.amount / 365
  }
}

/** Total fixed cost allocated to a period of `days` calendar days. */
export function fixedCostForPeriod(costs: FixedCost[], days: number): number {
  return costs
    .filter((c) => c.isActive)
    .reduce((sum, c) => sum + dailyCost(c) * days, 0)
}

/** Number of calendar days in a period (inclusive of both boundaries). */
export function periodDays(period: ReportPeriod): number {
  const now = new Date()
  switch (period) {
    case 'daily':   return 1
    case 'weekly':  return 7
    case 'monthly': return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    case 'yearly':  return isLeapYear(now.getFullYear()) ? 366 : 365
  }
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/**
 * Generates the date-axis labels for the cash flow chart.
 * Daily → hourly buckets (not useful at scale, so returns single point).
 * Weekly → 7 day labels.
 * Monthly → week labels.
 * Yearly → 12 month labels.
 */
export function generateChartLabels(period: ReportPeriod): string[] {
  const now = new Date()
  if (period === 'daily') {
    return [now.toISOString().split('T')[0]]
  }
  if (period === 'weekly') {
    const bounds = getPeriodBounds('weekly')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(bounds.start.getTime() + i * 86400000)
      return d.toISOString().split('T')[0]
    })
  }
  if (period === 'monthly') {
    const days = periodDays('monthly')
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), i + 1)
      return d.toISOString().split('T')[0]
    })
  }
  // yearly → 12 months
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1)
    return d.toISOString().split('T')[0].slice(0, 7) // YYYY-MM
  })
}

/** Merges flat transaction rows into CashFlowPoint[] matching chart labels. */
export function buildCashFlowData(
  labels: string[],
  rows: { date: string; type: string; total_amount: string }[],
  period: ReportPeriod
): CashFlowPoint[] {
  const key = (date: string) =>
    period === 'yearly' ? date.slice(0, 7) : date.slice(0, 10)

  const map = new Map<string, { sales: number; purchases: number }>()
  for (const label of labels) {
    map.set(key(label), { sales: 0, purchases: 0 })
  }

  for (const row of rows) {
    const k = key(row.date)
    const bucket = map.get(k)
    if (!bucket) continue
    const amt = Number(row.total_amount) || 0
    if (row.type === 'sale') bucket.sales += amt
    else if (row.type === 'purchase') bucket.purchases += amt
  }

  return labels.map((label) => {
    const k = key(label)
    const bucket = map.get(k) ?? { sales: 0, purchases: 0 }
    return {
      date: period === 'yearly' ? label.slice(0, 7) : label.slice(5), // MM-DD or YYYY-MM
      sales: Math.round(bucket.sales),
      purchases: Math.round(bucket.purchases),
    }
  })
}
