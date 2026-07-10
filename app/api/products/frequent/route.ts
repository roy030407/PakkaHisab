/**
 * FILE: app/api/products/frequent/route.ts
 *
 * WHAT THIS DOES:
 *   GET - returns the top 10 all-time bestsellers by total quantity sold.
 *   Falls back to pinned products, then most recently updated active products,
 *   so the quick-add strip never goes blank while the store has a catalog.
 *   Unpriced (0-price) products and duplicate names are excluded everywhere.
 *   Used by the FrequentItems quick-add strip on dashboard, entry, and other pages.
 *
 * CHANGES THIS SESSION:
 *   - Fallback chain: line-item frequency -> pinned -> top active products
 *     (strip was disappearing when no line-item sales existed in 30 days)
 *   - All product queries scoped to store_id
 *   - Popularity is now ALL-TIME (30-day window removed per merchant feedback)
 *   - Excludes selling_price <= 0 products; dedupes by lowercase name
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

  const { data: saleTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('store_id', store.id)
    .is('voided_at', null)
    .eq('type', 'sale')

  const txIds = (saleTx ?? []).map((t: { id: string }) => t.id)

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
    .map(([id]) => id)

  // 1st choice: all-time bestsellers by total quantity sold
  if (topIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name, selling_price')
      .eq('store_id', store.id)
      .in('id', topIds)
      .eq('is_active', true)
      .gt('selling_price', 0)

    const sorted = dedupeByName(
      (products ?? [])
        .sort((a: { id: string }, b: { id: string }) => topIds.indexOf(a.id) - topIds.indexOf(b.id))
        .map(toChip),
    )
    if (sorted.length > 0) return NextResponse.json({ products: sorted })
  }

  // 2nd choice: products the merchant pinned to the top
  const { data: pinned } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('is_pinned', true)
    .gt('selling_price', 0)
    .limit(10)
  if ((pinned ?? []).length > 0) {
    return NextResponse.json({ products: dedupeByName((pinned ?? []).map(toChip)) })
  }

  // 3rd choice: most recently updated active products, so the strip
  // still gives one-tap adds for a store with a catalog but no sales yet
  const { data: recent } = await supabase
    .from('products')
    .select('id, name, selling_price')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .gt('selling_price', 0)
    .order('updated_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ products: dedupeByName((recent ?? []).map(toChip)) })
}

interface Chip { id: string; name: string; price: number }

function toChip(p: { id: string; name: string; selling_price: number }): Chip {
  return { id: p.id, name: p.name, price: Number(p.selling_price) }
}

// Keep the first (highest-ranked) chip per lowercase name, cap at 10.
function dedupeByName(chips: Chip[]): Chip[] {
  const seen = new Set<string>()
  const out: Chip[] = []
  for (const c of chips) {
    const key = c.name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length === 10) break
  }
  return out
}
