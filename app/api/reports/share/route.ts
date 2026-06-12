/**
 * FILE: app/api/reports/share/route.ts
 *
 * WHAT THIS DOES:
 *   POST — Creates a shareable link for the current period's report.
 *   Generates a UUID share_token, upserts a periodic_reports row,
 *   and returns the shareable URL.
 *
 *   GET ?token=<uuid> — Public read. Returns report JSON for a share token
 *   without requiring auth. Used by the /share/[token] page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 7 report sharing
 *   - Fix: preserve existing share_token on re-share so previously distributed links stay valid
 *   - Fix: validate token is a well-formed UUID before querying (GET handler)
 *
 * WHERE IT FITS:
 *   POST called by the reports page share button.
 *   GET called by the public /share/[token] page (server component).
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx (POST),
 *   app/share/[token]/page.tsx (GET)
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { buildPeriodReport } from '@/lib/reports/buildReport'
import type { ReportPeriod } from '@/types'
import { randomUUID } from 'crypto'

const VALID_PERIODS = new Set<ReportPeriod>(['daily', 'weekly', 'monthly', 'yearly'])

/** POST /api/reports/share — authenticated, creates share link */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: { period?: string }
  try { body = await request.json() } catch { body = {} }

  const rawPeriod = body.period ?? 'monthly'
  const period: ReportPeriod = VALID_PERIODS.has(rawPeriod as ReportPeriod)
    ? (rawPeriod as ReportPeriod)
    : 'monthly'

  const report = await buildPeriodReport(supabase, store.id, period)
  const svc = createSupabaseServiceClient()

  // Reuse the existing share_token if one already exists for this store+period
  // so previously distributed links remain valid after the report is refreshed.
  const { data: existing } = await svc
    .from('periodic_reports')
    .select('share_token')
    .eq('store_id', store.id)
    .eq('report_type', period)
    .maybeSingle()

  const shareToken = existing?.share_token ?? randomUUID()

  const startDate = report.cashFlowData[0]?.date ?? new Date().toISOString().split('T')[0]
  const endDate   = report.cashFlowData.at(-1)?.date ?? new Date().toISOString().split('T')[0]

  const { error: upsertErr } = await svc
    .from('periodic_reports')
    .upsert(
      {
        store_id: store.id,
        report_type: period,
        period_start: startDate,
        period_end:   endDate,
        summary_text: `${report.periodLabel} report for ${store.name}`,
        report_json:  report,
        share_token:  shareToken,
      },
      { onConflict: 'store_id,report_type' }
    )

  if (upsertErr) {
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.json({ url: `${appUrl}/share/${shareToken}` })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/reports/share?token=<uuid> — public, no auth required */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

  const svc = createSupabaseServiceClient()
  const { data, error } = await svc
    .from('periodic_reports')
    .select('report_json, summary_text, report_type, period_start, period_end, store_id')
    .eq('share_token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Fetch store name for display
  const { data: store } = await svc
    .from('stores')
    .select('name')
    .eq('id', data.store_id)
    .maybeSingle()

  return NextResponse.json({
    storeName: store?.name ?? 'Store',
    summaryText: data.summary_text,
    reportType: data.report_type,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    report: data.report_json,
  })
}
