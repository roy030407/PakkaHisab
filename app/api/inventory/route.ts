/**
 * FILE: app/api/inventory/route.ts
 *
 * WHAT THIS DOES:
 *   GET — returns all products with stock levels, consumption data, and stock status.
 *   PATCH — applies a manual stock adjustment (writes stock_movements + updates inventory).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Quality fixes: delta validation, transaction error handling, updateStock error handling
 *   - Fixed N+1 query: replaced per-product getConsumptionData loop with a single
 *     batch fetch of all stock_movements, then in-memory computation per product.
 *
 * WHERE IT FITS:
 *   Primary data source for the /inventory page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx (via client fetch)
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeConsumptionFromMovements, computeStockStatus } from '@/lib/inventory/consumption'
import { updateStock } from '@/lib/inventory/updateStock'
import type { StockAdjustmentPayload } from '@/types'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Fetch inventory rows, products, and ALL stock movements in 3 parallel queries
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [invResult, prodResult, movResult] = await Promise.all([
    supabase
      .from('inventory')
      .select('id, product_id, current_stock, reorder_point, last_restocked_at, expiry_date')
      .eq('store_id', store.id),
    supabase
      .from('products')
      .select('id, name, brand, category, unit, is_active')
      .eq('store_id', store.id)
      .eq('is_active', true),
    supabase
      .from('stock_movements')
      .select('product_id, quantity, created_at')
      .eq('store_id', store.id)
      .eq('movement_type', 'purchase')
      .gte('created_at', thirtyDaysAgo),
  ])

  if (invResult.error) return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 })
  if (prodResult.error) return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  if (movResult.error) return NextResponse.json({ error: 'Failed to fetch stock movements' }, { status: 500 })

  const inventoryRows = invResult.data ?? []
  if (inventoryRows.length === 0) return NextResponse.json({ items: [] })

  const productMap = new Map(
    (prodResult.data ?? []).map(p => [p.id, p])
  )

  // Group movements by product_id in memory (no per-product DB round-trips)
  const movementsByProduct = new Map<string, Array<{ quantity: number | string; created_at: string }>>()
  for (const m of (movResult.data ?? [])) {
    const list = movementsByProduct.get(m.product_id) ?? []
    list.push(m)
    movementsByProduct.set(m.product_id, list)
  }

  const items = []

  for (const inv of inventoryRows) {
    const product = productMap.get(inv.product_id)
    if (!product) continue

    const currentStock = Number(inv.current_stock ?? 0)
    const reorderPoint = Number(inv.reorder_point ?? 0)
    const movements = movementsByProduct.get(inv.product_id) ?? []
    const consumption = computeConsumptionFromMovements(movements, currentStock)

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

  if (!body.productId || !body.delta || !body.reason) {
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
  const { data: tx, error: txError } = await supabase
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

  if (txError || !tx) return NextResponse.json({ error: 'Failed to record adjustment' }, { status: 500 })

  try {
    await updateStock(supabase, {
      storeId: store.id,
      productId: body.productId,
      delta: body.delta,
      transactionId: tx.id,
      movementType: 'adjustment',
      unitPrice: 0,
      reason: body.reason,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
