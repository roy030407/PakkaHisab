/**
 * FILE: app/api/products/frequent/route.ts
 *
 * WHAT THIS DOES:
 *   GET - returns the top 10 most-sold products by quantity in the last 30 days.
 *   Used by the FrequentItems quick-add strip on dashboard, entry, and other pages.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Called by components/shared/FrequentItems.tsx
 *
 * CALLED BY / IMPORTS FROM:
 *   components/shared/FrequentItems.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ products: [] })

  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const { data: recentTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('store_id', store.id)
    .is('voided_at', null)
    .eq('type', 'sale')
    .gte('date', since)

  const txIds = (recentTx ?? []).map((t: { id: string }) => t.id)
  if (txIds.length === 0) return NextResponse.json({ products: [] })

  const { data: lineItems } = await supabase
    .from('transaction_items')
    .select('product_id, quantity')
    .in('transaction_id', txIds)

  const freq: Record<string, number> = {}
  for (const li of lineItems ?? []) {
    freq[li.product_id] = (freq[li.product_id] ?? 0) + Number(li.quantity)
  }

  const topIds = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topIds.length === 0) return NextResponse.json({ products: [] })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .in('id', topIds)
    .eq('is_active', true)

  const sorted = (products ?? [])
    .sort((a: { id: string }, b: { id: string }) => topIds.indexOf(a.id) - topIds.indexOf(b.id))
    .map((p: { id: string; name: string; selling_price: number }) => ({
      id: p.id,
      name: p.name,
      price: Number(p.selling_price),
    }))

  return NextResponse.json({ products: sorted })
}
