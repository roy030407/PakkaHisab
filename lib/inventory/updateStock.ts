/**
 * FILE: lib/inventory/updateStock.ts
 *
 * WHAT THIS DOES:
 *   Shared helper called after every transaction that changes stock.
 *   Writes a stock_movements row and upserts inventory.current_stock.
 *   Used by both the scan confirm route and the manual entry routes.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Called inside DB-write flows: scan confirm and entry quick/full routes.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/confirm/route.ts, app/api/entry/quick/route.ts,
 *   app/api/entry/full/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockMovementType } from '@/types'

interface UpdateStockParams {
  storeId: string
  productId: string
  delta: number                 // positive = add stock, negative = remove stock
  transactionId: string
  movementType: StockMovementType
  unitPrice: number
  reason?: string
}

export async function updateStock(
  supabase: SupabaseClient,
  params: UpdateStockParams
): Promise<void> {
  const { storeId, productId, delta, transactionId, movementType, unitPrice, reason } = params

  // Write movement record
  await supabase.from('stock_movements').insert({
    store_id: storeId,
    product_id: productId,
    movement_type: movementType,
    quantity: Math.abs(delta),
    unit_price: unitPrice,
    transaction_id: transactionId,
    reason: reason ?? null,
  })

  // Upsert inventory row — increment or decrement current_stock
  const { data: existing } = await supabase
    .from('inventory')
    .select('id, current_stock')
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    const newStock = Number(existing.current_stock) + delta
    await supabase
      .from('inventory')
      .update({
        current_stock: newStock,
        ...(delta > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    // First time this product appears in inventory
    await supabase.from('inventory').insert({
      store_id: storeId,
      product_id: productId,
      current_stock: Math.max(0, delta),
      reorder_point: 0,
      ...(delta > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
    })
  }
}
