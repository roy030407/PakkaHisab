/**
 * FILE: app/api/customers/route.ts
 *
 * WHAT THIS DOES:
 *   GET - list all customers for the store.
 *   POST - create a new customer.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - GET also returns oldest_credit_at + last_payment_at per customer (udhaar aging)
 *
 * WHERE IT FITS:
 *   Called by CustomerSheet (both GET and POST) and customers page (GET).
 *
 * CALLED BY / IMPORTS FROM:
 *   components/entry/CustomerSheet.tsx, app/(dashboard)/customers/page.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, type, credit_limit, current_balance, notes, created_at')
    .eq('store_id', store.id)
    .order('name')

  // Oldest credit sale per customer (ascending so the first seen per id is oldest).
  const { data: creditSales } = await supabase
    .from('transactions')
    .select('customer_id, created_at')
    .eq('store_id', store.id)
    .eq('type', 'sale')
    .eq('payment_method', 'credit')
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: true })

  const oldestCreditAt = new Map<string, string>()
  for (const row of creditSales ?? []) {
    if (row.customer_id && !oldestCreditAt.has(row.customer_id)) {
      oldestCreditAt.set(row.customer_id, row.created_at)
    }
  }

  // Most recent payment per customer (descending so the first seen per id is latest).
  const { data: payments } = await supabase
    .from('transactions')
    .select('customer_id, created_at')
    .eq('store_id', store.id)
    .eq('type', 'payment')
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: false })

  const lastPaymentAt = new Map<string, string>()
  for (const row of payments ?? []) {
    if (row.customer_id && !lastPaymentAt.has(row.customer_id)) {
      lastPaymentAt.set(row.customer_id, row.created_at)
    }
  }

  const enriched = (customers ?? []).map(c => ({
    ...c,
    oldest_credit_at: oldestCreditAt.get(c.id) ?? null,
    last_payment_at: lastPaymentAt.get(c.id) ?? null,
  }))

  return NextResponse.json({ customers: enriched })
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: { name: string; phone?: string; type?: string; creditLimit?: number; notes?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: customer, error } = await supabase.from('customers').insert({
    store_id: store.id,
    name: body.name.trim(),
    phone: body.phone ?? null,
    type: body.type ?? 'walk_in',
    credit_limit: body.creditLimit ?? 0,
    current_balance: 0,
    notes: body.notes ?? null,
  }).select('id, name, phone, type, current_balance').single()

  if (error) return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  return NextResponse.json({ customer }, { status: 201 })
}
