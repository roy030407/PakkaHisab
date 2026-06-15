/**
 * FILE: app/api/customers/[id]/payment/route.ts
 *
 * WHAT THIS DOES:
 *   POST - records a customer repayment as a transactions row with
 *   type = 'payment' (cash in, NOT revenue, no stock), then decrements the
 *   customer's current_balance by the amount (may go negative = advance/jama).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Called by ReceivePaymentSheet from the Customers udhaar tab and the ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/customers/ReceivePaymentSheet.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: { amount?: unknown; paymentMethod?: unknown; date?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 })
  }

  // Optional date: must be YYYY-MM-DD if provided; default to today.
  let date = new Date().toISOString().split('T')[0]
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    const d = String(body.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d).getTime())) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    }
    date = d
  }

  const paymentMethod = body.paymentMethod === 'upi' ? 'upi' : 'cash'
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  // Ownership check + current balance.
  const { data: customer } = await supabase
    .from('customers')
    .select('id, current_balance')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const { error: txError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date,
      type: 'payment',
      total_amount: amount,
      customer_id: customer.id,
      payment_method: paymentMethod,
      source: 'manual_quick',
      tax_amount: 0,
      notes: note,
    })
  if (txError) return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })

  const newBalance = Number(customer.current_balance) - amount
  const { error: balError } = await supabase
    .from('customers')
    .update({ current_balance: newBalance })
    .eq('id', customer.id)
    .eq('store_id', store.id)
  if (balError) return NextResponse.json({ error: 'Payment saved but balance update failed' }, { status: 500 })

  return NextResponse.json({ newBalance }, { status: 201 })
}
