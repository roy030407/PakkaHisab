/**
 * FILE: app/api/cron/monthly-report/route.ts
 *
 * WHAT THIS DOES:
 *   Vercel Cron Job endpoint that runs on the 1st of every month at 06:00 IST.
 *   Generates a monthly report for every store and upserts it into
 *   periodic_reports. Protected by CRON_SECRET header check.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 7 periodic reports
 *
 * WHERE IT FITS:
 *   Invoked by Vercel Cron (vercel.json schedule). Never called by users.
 *
 * CALLED BY / IMPORTS FROM:
 *   vercel.json cron schedule
 */
import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { buildPeriodReport } from '@/lib/reports/buildReport'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svc = createSupabaseServiceClient()
  const { data: stores, error } = await svc
    .from('stores')
    .select('id, name')

  if (error || !stores) {
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 })
  }

  let generated = 0
  const errors: string[] = []

  for (const store of stores) {
    try {
      const report = await buildPeriodReport(svc, store.id, 'monthly')
      await svc
        .from('periodic_reports')
        .upsert(
          {
            store_id: store.id,
            report_type: 'monthly',
            period_start: report.cashFlowData[0]?.date ?? new Date().toISOString().split('T')[0],
            period_end:   report.cashFlowData.at(-1)?.date ?? new Date().toISOString().split('T')[0],
            summary_text: `Monthly report for ${store.name} - ${report.periodLabel}`,
            report_json:  report,
          },
          { onConflict: 'store_id,report_type' }
        )
      generated++
    } catch (e) {
      errors.push(`store ${store.id}: ${String(e)}`)
    }
  }

  return NextResponse.json({ generated, errors })
}
