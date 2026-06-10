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
import { buildPeriodReport } from '@/lib/reports/buildReport'
import type { ReportPeriod } from '@/types'

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

  const report = await buildPeriodReport(supabase, store.id, period)
  return NextResponse.json(report)
}
