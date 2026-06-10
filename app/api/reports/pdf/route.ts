/**
 * FILE: app/api/reports/pdf/route.ts
 *
 * WHAT THIS DOES:
 *   GET endpoint that generates and streams a PDF of the period report.
 *   Accepts ?period=daily|weekly|monthly|yearly. Fetches the same report
 *   data as /api/reports, renders it with @react-pdf/renderer, and returns
 *   it as application/pdf with Content-Disposition: attachment.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 7 PDF export
 *
 * WHERE IT FITS:
 *   Called by the download button on the reports page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx download button
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildPeriodReport } from '@/lib/reports/buildReport'
import { generateReportPDF } from '@/lib/reports/generatePDF'
import type { ReportPeriod } from '@/types'

const VALID_PERIODS: ReportPeriod[] = ['daily', 'weekly', 'monthly', 'yearly']

export async function GET(request: Request) {
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
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const rawPeriod = url.searchParams.get('period') ?? 'monthly'
  const period = VALID_PERIODS.includes(rawPeriod as ReportPeriod)
    ? (rawPeriod as ReportPeriod)
    : 'monthly'

  const report = await buildPeriodReport(supabase, store.id, period)
  const pdfBuffer = await generateReportPDF(store.name, period, report)

  const filename = `pakkahisab-${period}-report.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
