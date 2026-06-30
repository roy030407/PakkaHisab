/**
 * FILE: app/api/activity/route.ts
 *
 * WHAT THIS DOES:
 *   GET - returns merchant usage activity for the last 28 days.
 *   Aggregates transactions by date and source so the Reports page can
 *   show feature adoption, active days, and week-over-week growth charts.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for merchant activity analytics
 *
 * WHERE IT FITS:
 *   Called by components/reports/MerchantActivityCard.tsx on the Reports page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx (via MerchantActivityCard)
 */

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Last 28 days - get every transaction with its date and source
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 27)
  const startStr = start.toISOString().split('T')[0]
  const endStr = today.toISOString().split('T')[0]

  const { data: rows } = await supabase
    .from('transactions')
    .select('date, source, type, total_amount')
    .eq('store_id', store.id)
    .is('voided_at', null)
    .gte('date', startStr)
    .lte('date', endStr)

  const txRows = rows ?? []

  // Active days - distinct dates that have at least one transaction
  const distinctDates = new Set(txRows.map(r => r.date as string))
  const activeDays = distinctDates.size

  // Source breakdown - count transactions per source type
  const sourceBreakdown: Record<string, number> = {
    manual_quick: 0,
    manual_full: 0,
    bill_scan: 0,
    voice: 0,
    other: 0,
  }
  for (const r of txRows) {
    const src = (r.source ?? 'other') as string
    if (src in sourceBreakdown) {
      sourceBreakdown[src]++
    } else {
      sourceBreakdown.other++
    }
  }

  // Daily counts - array of 28 numbers (index 0 = 27 days ago, index 27 = today)
  const dailyCounts: number[] = Array(28).fill(0)
  for (const r of txRows) {
    const d = new Date(r.date as string)
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
    const idx = 27 - diff
    if (idx >= 0 && idx < 28) dailyCounts[idx]++
  }

  // Weekly totals - 4 weeks, each with transaction count and sales total
  // Week 1 = days 21-27 ago, week 2 = days 14-20 ago, week 3 = days 7-13 ago, week 4 = days 0-6 ago
  const weeklyTotals = [
    { label: 'Wk 1', count: 0, sales: 0 },
    { label: 'Wk 2', count: 0, sales: 0 },
    { label: 'Wk 3', count: 0, sales: 0 },
    { label: 'Wk 4', count: 0, sales: 0 },
  ]
  for (const r of txRows) {
    const d = new Date(r.date as string)
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
    const weekIdx = Math.min(3, Math.floor(diff / 7))
    const wk = weeklyTotals[3 - weekIdx]
    wk.count++
    if (r.type === 'sale') wk.sales += Number(r.total_amount) || 0
  }

  // Growth: % change from week 3 to week 4
  const wk3 = weeklyTotals[2].count
  const wk4 = weeklyTotals[3].count
  const growth = wk3 > 0 ? Math.round(((wk4 - wk3) / wk3) * 100) : null

  return NextResponse.json({
    activeDays,
    totalDays: 28,
    totalTransactions: txRows.length,
    sourceBreakdown,
    weeklyTotals,
    dailyCounts,
    growth,
  })
}
