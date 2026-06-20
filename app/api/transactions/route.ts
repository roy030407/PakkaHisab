/**
 * FILE: app/api/transactions/route.ts
 *
 * WHAT THIS DOES:
 *   GET - lists transactions for the authenticated store, newest first.
 *   Supports date filter (default: today IST), includeVoided flag, and limit.
 *   Returns each transaction with item count and a short item summary string.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (transaction history feature)
 *
 * WHERE IT FITS:
 *   Called by components/dashboard/RecentTransactions.tsx on the dashboard.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/dashboard/RecentTransactions.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ transactions: [] })

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || todayIST()
  const includeVoided = url.searchParams.get('includeVoided') !== 'false'
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50)

  let query = supabase
    .from('transactions')
    .select('id, date, type, total_amount, payment_method, source, customer_id, vendor_name, created_at, voided_at')
    .eq('store_id', store.id)
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!includeVoided) {
    query = query.is('voided_at', null)
  }

  const { data: txRows } = await query
  if (!txRows || txRows.length === 0) return NextResponse.json({ transactions: [] })

  const txIds = txRows.map((t: { id: string }) => t.id)

  const { data: itemsData } = await supabase
    .from('transaction_items')
    .select('transaction_id, product_name_raw')
    .in('transaction_id', txIds)

  const customerIds = Array.from(new Set(
    txRows.filter((t: { customer_id: string | null }) => t.customer_id).map((t: { customer_id: string | null }) => t.customer_id!)
  ))

  let customerMap: Record<string, string> = {}
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)
    for (const c of customers ?? []) customerMap[c.id] = c.name
  }

  const itemsByTx: Record<string, string[]> = {}
  for (const item of itemsData ?? []) {
    const list = itemsByTx[item.transaction_id] ?? []
    list.push(item.product_name_raw || 'Item')
    itemsByTx[item.transaction_id] = list
  }

  const transactions = txRows.map((tx: {
    id: string; date: string; type: string; total_amount: number;
    payment_method: string | null; source: string; customer_id: string | null;
    vendor_name: string | null; created_at: string; voided_at: string | null
  }) => {
    const names = itemsByTx[tx.id] ?? []
    const itemCount = names.length
    let itemSummary = ''
    if (itemCount === 0) {
      itemSummary = tx.type === 'expense' ? 'Expense' : tx.type === 'income' ? 'Income' : ''
    } else if (itemCount <= 2) {
      itemSummary = names.join(', ')
    } else {
      itemSummary = `${names[0]}, ${names[1]}, +${itemCount - 2} more`
    }

    return {
      id: tx.id,
      date: tx.date,
      type: tx.type,
      totalAmount: Number(tx.total_amount) || 0,
      paymentMethod: tx.payment_method,
      source: tx.source,
      customerName: tx.customer_id ? (customerMap[tx.customer_id] ?? null) : null,
      itemCount,
      itemSummary,
      createdAt: tx.created_at,
      voidedAt: tx.voided_at,
    }
  })

  return NextResponse.json({ transactions })
}
