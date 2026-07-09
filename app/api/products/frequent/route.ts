/**
 * FILE: app/api/products/frequent/route.ts
 *
 * WHAT THIS DOES:
 *   GET - returns the top 10 most-sold products by quantity in the last 30 days.
 *   Falls back to pinned products, then most recently updated active products,
 *   so the quick-add strip never goes blank while the store has a catalog.
 *   Used by the FrequentItems quick-add strip on dashboard, entry, and other pages.
 *
 * CHANGES THIS SESSION:
 *   - Fallback chain: line-item frequency -> pinned -> top active products
 *     (strip was disappearing when no line-item sales existed in 30 days)
 *   - All product queries scoped to store_id
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

  const freq: Record<string, number> = {}
  if (txIds.length > 0) {
    const { data: lineItems } = await supabase
      .from('transaction_items')
      .select('product_id, quantity')
      .in('transaction_id', txIds)
    for (const li of lineItems ?? []) {
      freq[li.product_id] = (freq[li.product_id] ?? 0) + Number(li.quantity)
    }
  }

  const topIds = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  // 1st choice: products actually sold in the last 30 days, by quantity
  if (topIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, selling_price')
      .eq('store_id', store.id)
      .in('id', topIds)
      .eq('is_active', true)

    const sorted = (products ?? [])
      .sort((a: { id: string }, b: { id: string }) => topIds.indexOf(a.id) - topIds.indexOf(b.id))
      .map(toChip)
    if (sorted.length > 0) return NextResponse.json({ products: sorted })
  }

  // 2nd choice: products the merchant pinned to the top
  const { data: pinned } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('is_pinned', true)
    .limit(10)
  if ((pinned ?? []).length > 0) {
    return NextResponse.json({ products: (pinned ?? []).map(toChip) })
  }

  // 3rd choice: most recently updated active products, so the strip
  // still gives one-tap adds for a store with a catalog but no recent sales
  const { data: recent } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ products: (recent ?? []).map(toChip) })
}

function toChip(p: { id: string; name: string; selling_price: number }) {
  return { id: p.id, name: p.name, price: Number(p.selling_price) }
}
