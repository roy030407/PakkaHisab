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
  const startISO = bounds.start.toISOString()
  const endISO = bounds.end.toISOString()

  const [txResult, costsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, total_amount, tax_amount, payment_method, date')
      .eq('store_id', storeId)
      .gte('created_at', startISO)
      .lte('created_at', endISO),
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

  // Top products
  const txIds = txRows.filter((t) => t.type === 'sale').map((t) => t.id)
  let topProducts: TopProduct[] = []

  if (txIds.length > 0) {
    const { data: items } = await supabase
      .from('transaction_items')
      .select('product_id, product_name_raw, quantity, total_price')
      .in('transaction_id', txIds)

    const productMap = new Map<string, { name: string; revenue: number; quantity: number }>()
    for (const item of items ?? []) {
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

    topProducts = Array.from(productMap.entries())
      .map(([id, v]) => ({
        productId: id,
        productName: v.name,
        revenue: Math.round(v.revenue),
        quantity: Math.round(v.quantity),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
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
    paymentBreakdown: {
      cash: Math.round(paymentBreakdown.cash),
      upi: Math.round(paymentBreakdown.upi),
      credit: Math.round(paymentBreakdown.credit),
    },
    cashFlowData,
    transactionCount: txRows.length,
  }
}
