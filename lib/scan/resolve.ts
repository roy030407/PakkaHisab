/**
 * FILE: lib/scan/resolve.ts
 *
 * WHAT THIS DOES:
 *   Server glue. Loads the full active catalog for a store plus a recent-
 *   purchase frequency map, then turns the AI's raw read items into final
 *   ExtractionItem rows by calling matchItem() and inferQtyPrice().
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for smart bill matching
 *
 * WHERE IT FITS:
 *   Called by app/api/scan/route.ts after extractBillData().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts ; uses lib/scan/match.ts + lib/scan/inferQtyPrice.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawExtractedItem, ExtractionItem, TransactionType } from '@/types'
import { matchItem, type CatalogEntry } from './match'
import { inferQtyPrice } from './inferQtyPrice'
import { sizeNumber } from './normalize'

export async function resolveItems(
  supabase: SupabaseClient,
  storeId: string,
  items: RawExtractedItem[],
  txType: TransactionType = 'purchase'
): Promise<ExtractionItem[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, parent_product_id, purchase_price, selling_price')
    .eq('store_id', storeId)
    .eq('is_active', true)

  // Recent purchase frequency (last 30 days) for variant tie-breaking.
  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('store_id', storeId)
    .gte('date', since)
  const txIds = (recentTx ?? []).map((t: { id: string }) => t.id)
  const freq: Record<string, number> = {}
  if (txIds.length > 0) {
    const { data: lineItems } = await supabase
      .from('transaction_items')
      .select('product_id')
      .in('transaction_id', txIds)
    for (const li of lineItems ?? []) freq[li.product_id] = (freq[li.product_id] ?? 0) + 1
  }

  const priceOf = (p: { purchase_price: number; selling_price: number }) =>
    Number(txType === 'purchase' ? p.purchase_price : p.selling_price) || 0

  const catalog: CatalogEntry[] = (products ?? []).map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    parentId: p.parent_product_id ?? null,
    unitPrice: priceOf(p),
    freq: freq[p.id] ?? 0,
  }))
  const catalogById = new Map(catalog.map(c => [c.id, c]))

  return items.map((raw): ExtractionItem => {
    const m = matchItem({ normalizedName: raw.normalizedName, sizeToken: raw.sizeToken }, catalog)
    const matchedPrice = m.matchedProductId ? catalogById.get(m.matchedProductId)?.unitPrice ?? null : null
    // Drop the pack-size number (e.g. the 600 in "600ml") so it is never read as
    // a quantity. Keep it only if it is clearly a price.
    const sizeNum = sizeNumber(raw.sizeToken)
    const numberTokens = raw.numberTokens.filter(
      t => !(sizeNum !== null && t.value === sizeNum && t.guessedRole !== 'price' && !t.hasCurrencyMarker)
    )
    const qp = inferQtyPrice(numberTokens, matchedPrice)
    return {
      productNameRaw: raw.productNameRaw,
      normalizedName: raw.normalizedName,
      sizeToken: raw.sizeToken,
      matchedProductId: m.matchedProductId,
      matchedProductName: m.matchedProductName,
      matchState: m.matchState,
      candidates: m.candidates,
      quantity: qp.quantity,
      unitPrice: qp.unitPrice,
      totalPrice: qp.quantity * qp.unitPrice,
      fillSource: qp.fillSource,
      needsVerify: qp.needsVerify,
      ambiguousQtyPrice: qp.ambiguousQtyPrice,
      numberTokens,
    }
  })
}
