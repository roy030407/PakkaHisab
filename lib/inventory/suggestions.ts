/**
 * FILE: lib/inventory/suggestions.ts
 *
 * WHAT THIS DOES:
 *   Generates three ordering suggestion buckets for a store:
 *   - orderToday: below reorder point or running out in <3 days
 *   - reduceOrdering: stock will last >30 days at current rate
 *   - watchExpiry: expiry within 7 days
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Quality fixes: Supabase error handling, null-safe stock coercion
 *
 * WHERE IT FITS:
 *   Called by GET /api/inventory/suggest.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/inventory/suggest/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventorySuggestionsResult, OrderSuggestion, ProductUnit } from '@/types'
import { getConsumptionData } from './consumption'

interface RawInventoryRow {
  product_id: string
  current_stock: number
  reorder_point: number
  expiry_date: string | null
}

interface RawProduct {
  id: string
  name: string
  unit: ProductUnit
  category: string
}

export async function generateOrderingSuggestions(
  supabase: SupabaseClient,
  storeId: string
): Promise<InventorySuggestionsResult> {
  const { data: inventoryRows, error: invError } = await supabase
    .from('inventory')
    .select('product_id, current_stock, reorder_point, expiry_date')
    .eq('store_id', storeId)

  if (invError) throw new Error(`inventory query failed: ${invError.message}`)

  if (!inventoryRows || inventoryRows.length === 0) {
    return { orderToday: [], reduceOrdering: [], watchExpiry: [], generatedAt: new Date().toISOString() }
  }

  const productIds = inventoryRows.map((r: RawInventoryRow) => r.product_id)

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, unit, category')
    .in('id', productIds)
    .eq('store_id', storeId)
    .eq('is_active', true)

  if (prodError) throw new Error(`products query failed: ${prodError.message}`)

  const productMap = new Map((products as RawProduct[] ?? []).map(p => [p.id, p]))

  const orderToday: OrderSuggestion[] = []
  const reduceOrdering: OrderSuggestion[] = []
  const watchExpiry: OrderSuggestion[] = []

  for (const inv of inventoryRows as RawInventoryRow[]) {
    const product = productMap.get(inv.product_id)
    if (!product) continue

    const currentStock = Number(inv.current_stock ?? 0)
    const reorderPoint = Number(inv.reorder_point ?? 0)

    // Expiry check takes priority
    if (inv.expiry_date && currentStock > 0) {
      const daysUntilExpiry = Math.ceil(
        (new Date(inv.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      if (daysUntilExpiry <= 7) {
        watchExpiry.push({
          productId: inv.product_id,
          productName: product.name,
          unit: product.unit,
          currentStock,
          reorderPoint,
          reason: `${currentStock} ${product.unit}(s) expiring in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`,
          suggestionType: 'watch_expiry',
          expiryDate: inv.expiry_date,
          daysUntilExpiry,
        })
        continue
      }
    }

    const consumption = await getConsumptionData(supabase, storeId, inv.product_id, currentStock)

    // Order today: below reorder point OR running out within 3 days
    const belowReorder = reorderPoint > 0 && currentStock <= reorderPoint
    const runningOutSoon = consumption != null && consumption.daysUntilStockout <= 3

    if (belowReorder || runningOutSoon) {
      let reason: string
      if (consumption && consumption.daysUntilStockout <= 3 && consumption.daysUntilStockout !== Infinity) {
        const days = Math.ceil(consumption.daysUntilStockout)
        reason = days < 1 ? 'Running out today' : `Running out in ${days} day${days === 1 ? '' : 's'}`
      } else {
        reason = `Below reorder point (${reorderPoint} ${product.unit}${reorderPoint === 1 ? '' : 's'})`
      }
      orderToday.push({
        productId: inv.product_id, productName: product.name, unit: product.unit,
        currentStock, reorderPoint, reason, suggestionType: 'order_today',
      })
      continue
    }

    // Reduce ordering: stock will last >30 days
    if (consumption && consumption.dailyRate > 0 && consumption.daysUntilStockout > 30) {
      reduceOrdering.push({
        productId: inv.product_id, productName: product.name, unit: product.unit,
        currentStock, reorderPoint,
        reason: `Stock lasts ~${Math.floor(consumption.daysUntilStockout)} days at current rate`,
        suggestionType: 'reduce_ordering',
      })
    }
  }

  return { orderToday, reduceOrdering, watchExpiry, generatedAt: new Date().toISOString() }
}
