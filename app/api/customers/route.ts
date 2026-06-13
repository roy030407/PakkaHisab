/**
 * FILE: app/api/customers/route.ts
 *
 * WHAT THIS DOES:
 *   GET - list all customers for the store.
 *   POST - create a new customer.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
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

  return NextResponse.json({ customers: customers ?? [] })
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
