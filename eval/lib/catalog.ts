/**
 * FILE: eval/lib/catalog.ts
 *
 * WHAT THIS DOES:
 *   The eval store: the app's own kirana sample catalog (data/seeds/kirana.ts,
 *   what a merchant gets from "start with a sample store") as products rows,
 *   plus the CatalogEntry list and transcription-bias names built exactly the
 *   way app/api/voice/parse/route.ts builds them.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Used by eval/lib/tasks/scan.ts and eval/lib/tasks/voice.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/lib/tasks/* ; imports data/seeds/kirana.ts, lib/scan/match.ts (type)
 */
import { KIRANA_PRODUCTS } from '@/data/seeds/kirana'
import type { CatalogEntry } from '@/lib/scan/match'
import type { Row } from './fakeSupabase'

export const STORE_ID = 'store-eval'

export const PRODUCT_ROWS: Row[] = KIRANA_PRODUCTS.map((p, i) => ({
  id: `p-${String(i + 1).padStart(3, '0')}`,
  store_id: STORE_ID,
  is_active: true,
  name: p.name,
  brand: p.brand ?? null,
  parent_product_id: null,
  purchase_price: p.purchase_price,
  selling_price: p.selling_price,
}))

export const productIdByName = new Map(PRODUCT_ROWS.map(r => [String(r.name), String(r.id)]))
export const productNameById = new Map(PRODUCT_ROWS.map(r => [String(r.id), String(r.name)]))

// Same mapping as loadCatalog() in app/api/voice/parse/route.ts (selling price, freq 0: no history).
export const VOICE_CATALOG: CatalogEntry[] = PRODUCT_ROWS.map(p => ({
  id: String(p.id),
  name: String(p.name),
  brand: (p.brand as string | null) ?? null,
  parentId: null,
  unitPrice: Number(p.selling_price) || 0,
  freq: 0,
}))

// Same as the route: top 50 by freq (all 0 here, so insertion order), brand-prefixed.
export const VOICE_CATALOG_NAMES: string[] = [...VOICE_CATALOG]
  .sort((a, b) => b.freq - a.freq)
  .slice(0, 50)
  .map(c => (c.brand && !c.name.toLowerCase().includes(c.brand.toLowerCase()) ? `${c.brand} ${c.name}` : c.name))
