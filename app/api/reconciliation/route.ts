/**
 * FILE: app/api/reconciliation/route.ts
 *
 * WHAT THIS DOES:
 *   GET  - computes the day's cash position (opening carried forward from the
 *          last close, cash in/out, expected, UPI tally) and returns any saved
 *          close for that date.
 *   POST - recomputes the position server-side from the day's transactions
 *          (never trusts client sums) and upserts one cash_reconciliations row
 *          per store per day.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice C cash reconciliation)
 *
 * WHERE IT FITS:
 *   Called by the /reconcile screen.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reconcile/page.tsx, lib/reports/cashReconciliation
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeCashPosition, cashDifference, type CashTxn } from '@/lib/reports/cashReconciliation'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function dayTransactions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  storeId: string,
  date: string
): Promise<CashTxn[]> {
  const { data } = await supabase
    .from('transactions')
    .select('type, payment_method, total_amount')
    .eq('store_id', storeId)
    .eq('date', date)
  return (data ?? []).map(t => ({
    type: t.type,
    paymentMethod: t.payment_method,
    totalAmount: Number(t.total_amount),
  }))
}

async function carriedOpening(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  storeId: string,
  date: string
): Promise<number> {
  const { data } = await supabase
    .from('cash_reconciliations')
    .select('counted_cash')
    .eq('store_id', storeId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? Number(data.counted_cash) : 0
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const url = new URL(request.url)
  const rawDate = url.searchParams.get('date')
  const date = rawDate && DATE_RE.test(rawDate) ? rawDate : new Date().toISOString().split('T')[0]

  const { data: saved } = await supabase
    .from('cash_reconciliations')
    .select('id, date, opening_cash, cash_in, cash_out, expected_cash, counted_cash, upi_total, difference, note')
    .eq('store_id', store.id)
    .eq('date', date)
    .maybeSingle()

  const opening = saved ? Number(saved.opening_cash) : await carriedOpening(supabase, store.id, date)
  const position = computeCashPosition({ openingCash: opening, transactions: await dayTransactions(supabase, store.id, date) })

  return NextResponse.json({
    date,
    openingCash: opening,
    cashIn: position.cashIn,
    cashOut: position.cashOut,
    expectedCash: position.expectedCash,
    upiTotal: position.upiTotal,
    saved: saved ?? null,
  })
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: { date?: unknown; openingCash?: unknown; countedCash?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const date = typeof body.date === 'string' && DATE_RE.test(body.date)
    ? body.date
    : new Date().toISOString().split('T')[0]

  const openingCash = Number(body.openingCash)
  const countedCash = Number(body.countedCash)
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    return NextResponse.json({ error: 'Enter a valid opening cash amount.' }, { status: 400 })
  }
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return NextResponse.json({ error: 'Enter a valid counted cash amount.' }, { status: 400 })
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  // Recompute from transactions; never trust client-sent sums.
  const position = computeCashPosition({ openingCash, transactions: await dayTransactions(supabase, store.id, date) })
  const difference = cashDifference(countedCash, position.expectedCash)

  const { data: saved, error } = await supabase
    .from('cash_reconciliations')
    .upsert(
      {
        store_id: store.id,
        date,
        opening_cash: openingCash,
        cash_in: position.cashIn,
        cash_out: position.cashOut,
        expected_cash: position.expectedCash,
        counted_cash: countedCash,
        upi_total: position.upiTotal,
        difference,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,date' }
    )
    .select('id, date, opening_cash, cash_in, cash_out, expected_cash, counted_cash, upi_total, difference, note')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save the day close' }, { status: 500 })
  return NextResponse.json({ saved })
}
