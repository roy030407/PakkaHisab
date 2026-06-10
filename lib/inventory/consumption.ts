/**
 * FILE: lib/inventory/consumption.ts
 *
 * WHAT THIS DOES:
 *   Calculates daily consumption rate and days-until-stockout for a product.
 *   Uses stock_movements (purchase type) from the last 30 days.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Quality fixes: Supabase error handling, negative stock guard, NaN-safe quantity coercion
 *
 * WHERE IT FITS:
 *   Called by /api/inventory (GET) and lib/inventory/suggestions.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/inventory/route.ts, lib/inventory/suggestions.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConsumptionData, StockStatus } from '@/types'

export async function getConsumptionData(
  supabase: SupabaseClient,
  storeId: string,
  productId: string,
  currentStock: number
): Promise<ConsumptionData | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('quantity, created_at')
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('movement_type', 'purchase')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })

  if (error) return null

  const safeStock = Math.max(0, currentStock)

  if (!movements || movements.length === 0) return null

  const lastPurchaseDate = new Date(movements[0].created_at)
  const daysSinceOrder = Math.max(
    1,
    Math.floor((Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
  )

  const orderedQty = movements.reduce((sum, m) => {
    const qty = parseFloat(m.quantity)
    return sum + (isFinite(qty) ? qty : 0)
  }, 0)
  const consumed = orderedQty - safeStock

  if (consumed <= 0) {
    return { orderedQty, daysSinceOrder, dailyRate: 0, daysUntilStockout: Infinity }
  }

  const dailyRate = Math.round((consumed / daysSinceOrder) * 10) / 10
  const daysUntilStockout = dailyRate > 0
    ? Math.round((safeStock / dailyRate) * 10) / 10
    : Infinity

  return { orderedQty, daysSinceOrder, dailyRate, daysUntilStockout }
}

export function computeStockStatus(
  currentStock: number,
  reorderPoint: number
): StockStatus {
  if (currentStock <= 0) return 'out'
  if (reorderPoint > 0 && currentStock <= reorderPoint * 0.5) return 'critical'
  if (reorderPoint > 0 && currentStock <= reorderPoint) return 'low'
  return 'ok'
}
