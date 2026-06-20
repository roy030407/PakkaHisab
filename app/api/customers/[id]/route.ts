/**
 * FILE: app/api/customers/[id]/route.ts
 *
 * WHAT THIS DOES:
 *   GET - customer detail with last 50 transactions.
 *   PATCH - update customer fields (name, phone, type, creditLimit, notes).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Security: try/catch on request.json() in PATCH
 *
 * WHERE IT FITS:
 *   Called by CustomerLedger component.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/customers/CustomerLedger.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, type, credit_limit, current_balance, notes, created_at')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .single()
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, date, type, total_amount, payment_method, source, created_at, voided_at')
    .eq('customer_id', params.id)
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ customer, transactions: transactions ?? [] })
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const allowed: Record<string, unknown> = {}
  if (body.name) allowed.name = body.name
  if (body.phone !== undefined) allowed.phone = body.phone
  if (body.type) allowed.type = body.type
  if (body.creditLimit !== undefined) allowed.credit_limit = body.creditLimit
  if (body.notes !== undefined) allowed.notes = body.notes

  const { data: customer, error } = await supabase
    .from('customers')
    .update(allowed)
    .eq('id', params.id)
    .eq('store_id', store.id)
    .select('id, name')
    .single()
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ customer })
}
