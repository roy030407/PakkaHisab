/**
 * FILE: lib/reports/buildReport.ts
 *
 * WHAT THIS DOES:
 *   Shared function that builds a PeriodReport from Supabase data.
 *   Extracted from /api/reports so the PDF route and any cron jobs can
 *   reuse the same logic without duplication.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (extracted from app/api/reports/route.ts)
 *   - Fix: filter on logical `date` column instead of `created_at` for correct period bucketing
 *   - Fix: chunk transaction_items IN query to avoid PostgREST URL-length limit on busy stores
 *
 * WHERE IT FITS:
 *   Called by /api/reports, /api/reports/pdf, and /api/cron/* routes.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/reports/route.ts, app/api/reports/pdf/route.ts,
 *   app/api/cron/weekly-report/route.ts, app/api/cron/monthly-report/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getPeriodBounds,
  fixedCostForPeriod,
  periodDays,
  generateChartLabels,
  buildCashFlowData,
} from './periods'
import { calculateProfit } from './profit'
import { calculateTax } from './tax'
import type { ReportPeriod, PeriodReport, TopProduct, PaymentBreakdown, FixedCost } from '@/types'

export async function buildPeriodReport(
  supabase: SupabaseClient,
  storeId: string,
  period: ReportPeriod,
): Promise<PeriodReport> {
  const bounds = getPeriodBounds(period)
  // Use the logical business `date` column (not created_at) so back-entered
  // transactions are bucketed into the period they belong to, not when they were typed.
  const startDate = bounds.start.toISOString().split('T')[0]
  const endDate   = bounds.end.toISOString().split('T')[0]

  const [txResult, costsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, total_amount, tax_amount, payment_method, date')
      .eq('store_id', storeId)
      .is('voided_at', null)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('fixed_costs')
      .select('amount, frequency, is_active')
      .eq('store_id', storeId)
      .eq('is_active', true),
  ])

  const txRows = txResult.data ?? []

  let totalSales = 0
  let totalPurchases = 0
  const paymentBreakdown: PaymentBreakdown = { cash: 0, upi: 0, credit: 0 }

  for (const tx of txRows) {
    const amt = Number(tx.total_amount) || 0
    if (tx.type === 'sale') {
      totalSales += amt
      const method = tx.payment_method as keyof PaymentBreakdown
      if (method && method in paymentBreakdown) paymentBreakdown[method] += amt
    } else if (tx.type === 'purchase') {
      totalPurchases += amt
    }
  }

  const days = periodDays(period)
  const fixedCosts = fixedCostForPeriod(
    (costsResult.data ?? []).map((c) => ({ ...c, isActive: c.is_active })) as unknown as FixedCost[],
    days
  )

  const profit = calculateProfit(totalSales, totalPurchases, fixedCosts)
  const taxSummary = calculateTax(txRows)

  // Top products - chunked to avoid PostgREST URL-length limit (each UUID is ~37 chars;
  // a 200+ UUID IN clause exceeds the ~8 KB URL limit on busy stores).
  const txIds = txRows.filter((t) => t.type === 'sale').map((t) => t.id)
  let topProducts: TopProduct[] = []
  let itemsSold: TopProduct[] = []

  if (txIds.length > 0) {
    const CHUNK = 100
    const chunks: string[][] = []
    for (let i = 0; i < txIds.length; i += CHUNK) chunks.push(txIds.slice(i, i + CHUNK))
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        supabase
          .from('transaction_items')
          .select('product_id, product_name_raw, quantity, total_price')
          .in('transaction_id', chunk)
      )
    )
    const items = chunkResults.flatMap((r) => r.data ?? [])

    const productMap = new Map<string, { name: string; revenue: number; quantity: number }>()
    for (const item of items) {
      const key = item.product_id ?? item.product_name_raw
      const existing = productMap.get(key)
      if (existing) {
        existing.revenue += Number(item.total_price) || 0
        existing.quantity += Number(item.quantity) || 0
      } else {
        productMap.set(key, {
          name: item.product_name_raw,
          revenue: Number(item.total_price) || 0,
          quantity: Number(item.quantity) || 0,
        })
      }
    }

    itemsSold = Array.from(productMap.entries())
      .map(([id, v]) => ({
        productId: id,
        productName: v.name,
        revenue: Math.round(v.revenue),
        quantity: Math.round(v.quantity),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // Charts only need the leaders; the per-item section uses the full list.
    topProducts = itemsSold.slice(0, 10)
  }

  const labels = generateChartLabels(period)
  const cashFlowData = buildCashFlowData(
    labels,
    txRows.map((t) => ({ date: t.date, type: t.type, total_amount: t.total_amount })),
    period
  )

  return {
    period,
    periodLabel: bounds.label,
    sales: profit.sales,
    purchases: profit.purchases,
    grossMargin: profit.grossMargin,
    fixedCosts: Math.round(fixedCosts),
    netProfit: profit.netProfit,
    taxSummary,
    topProducts,
    itemsSold,
    paymentBreakdown: {
      cash: Math.round(paymentBreakdown.cash),
      upi: Math.round(paymentBreakdown.upi),
      credit: Math.round(paymentBreakdown.credit),
    },
    cashFlowData,
    transactionCount: txRows.length,
  }
}
