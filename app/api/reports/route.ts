/**
 * FILE: app/api/reports/route.ts
 *
 * WHAT THIS DOES:
 *   GET ?period=daily|weekly|monthly|yearly
 *   Returns a full PeriodReport: sales, purchases, profit, tax summary,
 *   top products, payment breakdown, and cash flow chart data.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *
 * WHERE IT FITS:
 *   Primary data source for app/(dashboard)/reports/page.tsx.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx (client fetch on period change)
 */

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getPeriodBounds,
  fixedCostForPeriod,
  periodDays,
  generateChartLabels,
  buildCashFlowData,
} from '@/lib/reports/periods'
import { calculateProfit } from '@/lib/reports/profit'
import { calculateTax } from '@/lib/reports/tax'
import type { ReportPeriod, PeriodReport, TopProduct, PaymentBreakdown, FixedCost } from '@/types'

const VALID_PERIODS = new Set<ReportPeriod>(['daily', 'weekly', 'monthly', 'yearly'])

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const url = new URL(request.url)
  const rawPeriod = url.searchParams.get('period') ?? 'monthly'
  const period: ReportPeriod = VALID_PERIODS.has(rawPeriod as ReportPeriod)
    ? (rawPeriod as ReportPeriod)
    : 'monthly'

  const bounds = getPeriodBounds(period)
  const startISO = bounds.start.toISOString()
  const endISO = bounds.end.toISOString()

  // All transactions in the period
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, type, total_amount, tax_amount, payment_method, date')
    .eq('store_id', store.id)
    .gte('created_at', startISO)
    .lte('created_at', endISO)

  if (txError) return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })

  const txRows = transactions ?? []

  // Aggregate sales + purchases
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

  // Fixed costs for period
  const { data: costs } = await supabase
    .from('fixed_costs')
    .select('amount, frequency, is_active')
    .eq('store_id', store.id)
    .eq('is_active', true)

  const days = periodDays(period)
  const fixedCosts = fixedCostForPeriod(
    (costs ?? []).map((c) => ({ ...c, isActive: c.is_active })) as unknown as FixedCost[],
    days
  )

  const profit = calculateProfit(totalSales, totalPurchases, fixedCosts)
  const taxSummary = calculateTax(txRows)

  // Top products by revenue — join through transaction_items
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

  // Cash flow chart data
  const labels = generateChartLabels(period)
  const cashFlowData = buildCashFlowData(
    labels,
    txRows.map((t) => ({ date: t.date, type: t.type, total_amount: t.total_amount })),
    period
  )

  const report: PeriodReport = {
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

  return NextResponse.json(report)
}
