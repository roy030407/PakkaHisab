/**
 * FILE: app/api/dashboard/route.ts
 *
 * WHAT THIS DOES:
 *   GET: returns today's business snapshot for the dashboard home screen.
 *   Computes today's sales, purchases, net profit (after daily fixed costs),
 *   outstanding receivables, low-stock count, and expiry alert count.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 dashboard
 *
 * WHERE IT FITS:
 *   Called by app/(dashboard)/dashboard/page.tsx on every page load.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fixedCostForPeriod } from '@/lib/reports/periods'
import type { FixedCost, DashboardSnapshot } from '@/types'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, owner_name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]

  // Today's transactions
  const { data: todayTx } = await supabase
    .from('transactions')
    .select('type, total_amount')
    .eq('store_id', store.id)
    .eq('date', today)

  let todaySales = 0
  let todayPurchases = 0
  for (const tx of todayTx ?? []) {
    const amt = Number(tx.total_amount) || 0
    if (tx.type === 'sale') todaySales += amt
    else if (tx.type === 'purchase') todayPurchases += amt
  }

  // Daily fixed cost allocation
  const { data: costs } = await supabase
    .from('fixed_costs')
    .select('amount, frequency, is_active')
    .eq('store_id', store.id)
    .eq('is_active', true)

  const dailyFixedCost = fixedCostForPeriod(
    (costs ?? []).map((c) => ({ ...c, isActive: c.is_active })) as unknown as FixedCost[],
    1
  )

  const todayNetProfit = todaySales - todayPurchases - dailyFixedCost

  // Outstanding receivables (customers with a positive balance owed)
  const { data: customers } = await supabase
    .from('customers')
    .select('current_balance')
    .eq('store_id', store.id)
    .gt('current_balance', 0)

  const outstandingReceivables = (customers ?? []).reduce(
    (sum, c) => sum + (Number(c.current_balance) || 0),
    0
  )

  // Low stock count: out + critical + low
  const { data: inventory } = await supabase
    .from('inventory')
    .select('current_stock, reorder_point')
    .eq('store_id', store.id)

  let lowStockCount = 0
  for (const inv of inventory ?? []) {
    const stock = Number(inv.current_stock) || 0
    const reorder = Number(inv.reorder_point) || 0
    if (stock <= 0 || (reorder > 0 && stock <= reorder)) lowStockCount++
  }

  // Expiry alert count: items expiring within 7 days
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { count: expiryAlertCount } = await supabase
    .from('inventory')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .lte('expiry_date', in7Days)
    .gt('current_stock', 0)

  const snapshot: DashboardSnapshot = {
    todaySales: Math.round(todaySales),
    todayPurchases: Math.round(todayPurchases),
    todayNetProfit: Math.round(todayNetProfit),
    outstandingReceivables: Math.round(outstandingReceivables),
    lowStockCount,
    expiryAlertCount: expiryAlertCount ?? 0,
    storeName: store.name,
    ownerName: store.owner_name,
  }

  return NextResponse.json(snapshot)
}
