/**
 * FILE: app/api/inventory/route.ts
 *
 * WHAT THIS DOES:
 *   GET — returns all products with stock levels, consumption data, and stock status.
 *   PATCH — applies a manual stock adjustment (writes stock_movements + updates inventory).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Primary data source for the /inventory page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx (via client fetch)
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getConsumptionData, computeStockStatus } from '@/lib/inventory/consumption'
import { updateStock } from '@/lib/inventory/updateStock'
import type { StockAdjustmentPayload } from '@/types'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: inventoryRows, error: invError } = await supabase
    .from('inventory')
    .select('id, product_id, current_stock, reorder_point, last_restocked_at, expiry_date, updated_at')
    .eq('store_id', store.id)

  if (invError) return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })

  if (!inventoryRows || inventoryRows.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const productIds = inventoryRows.map((r: { product_id: string }) => r.product_id)

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, brand, category, unit, is_active')
    .in('id', productIds)
    .eq('store_id', store.id)
    .eq('is_active', true)

  if (prodError) return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })

  const productMap = new Map(
    (products ?? []).map((p: { id: string; name: string; brand?: string; category: string; unit: string; is_active: boolean }) => [p.id, p])
  )

  const items = []

  for (const inv of inventoryRows) {
    const product = productMap.get(inv.product_id)
    if (!product) continue

    const currentStock = Number(inv.current_stock ?? 0)
    const reorderPoint = Number(inv.reorder_point ?? 0)
    const consumption = await getConsumptionData(supabase, store.id, inv.product_id, currentStock)

    items.push({
      productId: inv.product_id,
      productName: product.name,
      brand: product.brand ?? null,
      category: product.category,
      unit: product.unit,
      currentStock,
      reorderPoint,
      lastRestockedAt: inv.last_restocked_at ?? null,
      expiryDate: inv.expiry_date ?? null,
      stockStatus: computeStockStatus(currentStock, reorderPoint),
      consumption: consumption ?? null,
    })
  }

  // Sort: out/critical/low first, then alphabetical within each group
  const statusOrder: Record<string, number> = { out: 0, critical: 1, low: 2, ok: 3 }
  items.sort((a, b) => {
    const diff = (statusOrder[a.stockStatus] ?? 3) - (statusOrder[b.stockStatus] ?? 3)
    return diff !== 0 ? diff : a.productName.localeCompare(b.productName)
  })

  return NextResponse.json({ items })
}

export async function PATCH(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: StockAdjustmentPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.productId || body.delta === 0 || !body.reason) {
    return NextResponse.json({ error: 'productId, delta (non-zero), and reason are required' }, { status: 400 })
  }

  // Verify product belongs to this store
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', body.productId)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Write a placeholder transaction for the adjustment
  const { data: tx } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      type: body.delta > 0 ? 'purchase' : 'expense',
      total_amount: 0,
      payment_method: 'cash',
      source: 'manual_quick',
      tax_amount: 0,
      notes: `Manual adjustment: ${body.reason}${body.notes ? ' — ' + body.notes : ''}`,
    })
    .select('id')
    .single()

  if (!tx) return NextResponse.json({ error: 'Failed to record adjustment' }, { status: 500 })

  await updateStock(supabase, {
    storeId: store.id,
    productId: body.productId,
    delta: body.delta,
    transactionId: tx.id,
    movementType: 'adjustment',
    unitPrice: 0,
    reason: body.reason,
  })

  return NextResponse.json({ success: true })
}
