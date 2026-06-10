# Phase 3 — Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchant can see real-time stock levels, consumption rates, expiry alerts, and AI-generated ordering suggestions from the `/inventory` page.

**Architecture:** Pure server-side calculations — no caching layer. The `/api/inventory` route fetches inventory rows + stock_movements and computes consumption rates on each request. The `/api/inventory/suggest` route reuses the same helpers to bucket products into three suggestion lists. All components are client-side with fetch-on-mount. The inventory page also shows an upload-schedule prompt when no transactions have been logged in 24+ hours.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (RLS), Tailwind CSS v4, shadcn/ui

---

## Existing files referenced (read before touching)

| File | Used by |
|---|---|
| `types/index.ts` | Task 0 appends types |
| `lib/inventory/updateStock.ts` | Task 1 sits alongside it |
| `app/(dashboard)/layout.tsx` | inventory page inherits BottomNav from here |
| `app/api/scan/route.ts` | pattern for auth + store lookup |

---

## File map — what gets created / modified

| Action | Path | Responsibility |
|---|---|---|
| Modify | `types/index.ts` | Add Phase 3 types |
| Create | `lib/inventory/consumption.ts` | Daily consumption rate + stockout prediction |
| Create | `lib/inventory/suggestions.ts` | 3-bucket ordering suggestion logic |
| Create | `app/api/inventory/route.ts` | GET stock list, PATCH manual adjustment |
| Create | `app/api/inventory/suggest/route.ts` | GET suggestion buckets |
| Create | `components/inventory/StockList.tsx` | Searchable color-coded stock list |
| Create | `components/inventory/ConsumptionCard.tsx` | Rate + days-until-stockout display |
| Create | `components/inventory/ExpiryAlert.tsx` | Expiry warning banner |
| Create | `components/inventory/OrderSuggestionCard.tsx` | 3-bucket suggestion card with Log purchase CTA |
| Create | `app/(dashboard)/inventory/page.tsx` | Inventory home page |

---

## Task 0 — Add Phase 3 types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Append Phase 3 types after the last existing block**

Open `types/index.ts` and append this section at the bottom (after the `FullEntryPayload` interface):

```typescript
// ─── Phase 3: Inventory ───────────────────────────────────────────────────

export type StockStatus = 'ok' | 'low' | 'critical' | 'out'
export type AdjustmentReason = 'damaged' | 'expired' | 'theft' | 'correction' | 'waste' | 'other'
export type SuggestionType = 'order_today' | 'reduce_ordering' | 'watch_expiry'

export interface ConsumptionData {
  orderedQty: number         // total units received in last 30 days
  daysSinceOrder: number     // days since the most recent purchase movement
  dailyRate: number          // (orderedQty - currentStock) / daysSinceOrder; 0 if nothing consumed
  daysUntilStockout: number  // currentStock / dailyRate; use Infinity for zero-rate products
}

export interface StockItemWithConsumption {
  productId: string
  productName: string
  brand?: string
  category: string
  unit: string
  currentStock: number
  reorderPoint: number
  lastRestockedAt?: string
  expiryDate?: string
  stockStatus: StockStatus
  consumption?: ConsumptionData
}

export interface OrderSuggestion {
  productId: string
  productName: string
  unit: string
  currentStock: number
  reorderPoint: number
  reason: string
  suggestionType: SuggestionType
  expiryDate?: string
  daysUntilExpiry?: number
}

export interface InventorySuggestionsResult {
  orderToday: OrderSuggestion[]
  reduceOrdering: OrderSuggestion[]
  watchExpiry: OrderSuggestion[]
  generatedAt: string
}

export interface StockAdjustmentPayload {
  productId: string
  delta: number         // positive = add, negative = remove
  reason: AdjustmentReason
  notes?: string
}
```

- [ ] **Step 2: Update the CHANGES comment block at the top of types/index.ts**

Change the line:
```
 *   - Added Phase 2 types: ConfidenceLevel, DocumentType, StockMovementType,
 *     ExtractionStatus, ExtractionItem, ExtractionResult, DocumentUpload,
 *     QuickEntryItem, QuickEntryPayload, FullEntryItem, FullEntryPayload
```
to:
```
 *   - Added Phase 2 types: ConfidenceLevel, DocumentType, StockMovementType,
 *     ExtractionStatus, ExtractionItem, ExtractionResult, DocumentUpload,
 *     QuickEntryItem, QuickEntryPayload, FullEntryItem, FullEntryPayload
 *   - Added Phase 3 types: StockStatus, AdjustmentReason, SuggestionType,
 *     ConsumptionData, StockItemWithConsumption, OrderSuggestion,
 *     InventorySuggestionsResult, StockAdjustmentPayload
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Phase 3 inventory types"
```

---

## Task 1 — Consumption calculation library

**Files:**
- Create: `lib/inventory/consumption.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: lib/inventory/consumption.ts
 *
 * WHAT THIS DOES:
 *   Calculates daily consumption rate and days-until-stockout for a product.
 *   Uses stock_movements (purchase type) from the last 30 days.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
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

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('quantity, created_at')
    .eq('store_id', storeId)
    .eq('product_id', productId)
    .eq('movement_type', 'purchase')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })

  if (!movements || movements.length === 0) return null

  const lastPurchaseDate = new Date(movements[0].created_at)
  const daysSinceOrder = Math.max(
    1,
    Math.floor((Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
  )

  const orderedQty = movements.reduce((sum, m) => sum + Number(m.quantity), 0)
  const consumed = orderedQty - currentStock

  if (consumed <= 0) {
    return { orderedQty, daysSinceOrder, dailyRate: 0, daysUntilStockout: Infinity }
  }

  const dailyRate = Math.round((consumed / daysSinceOrder) * 10) / 10
  const daysUntilStockout = dailyRate > 0
    ? Math.round((currentStock / dailyRate) * 10) / 10
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/inventory/consumption.ts
git commit -m "feat: add consumption rate and stock status helpers"
```

---

## Task 2 — Ordering suggestions library

**Files:**
- Create: `lib/inventory/suggestions.ts`

- [ ] **Step 1: Create the file**

```typescript
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
 *
 * WHERE IT FITS:
 *   Called by GET /api/inventory/suggest.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/inventory/suggest/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventorySuggestionsResult, OrderSuggestion } from '@/types'
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
  unit: string
  category: string
}

export async function generateOrderingSuggestions(
  supabase: SupabaseClient,
  storeId: string
): Promise<InventorySuggestionsResult> {
  const { data: inventoryRows } = await supabase
    .from('inventory')
    .select('product_id, current_stock, reorder_point, expiry_date')
    .eq('store_id', storeId)

  if (!inventoryRows || inventoryRows.length === 0) {
    return { orderToday: [], reduceOrdering: [], watchExpiry: [], generatedAt: new Date().toISOString() }
  }

  const productIds = inventoryRows.map((r: RawInventoryRow) => r.product_id)

  const { data: products } = await supabase
    .from('products')
    .select('id, name, unit, category')
    .in('id', productIds)
    .eq('store_id', storeId)
    .eq('is_active', true)

  const productMap = new Map((products as RawProduct[] ?? []).map(p => [p.id, p]))

  const orderToday: OrderSuggestion[] = []
  const reduceOrdering: OrderSuggestion[] = []
  const watchExpiry: OrderSuggestion[] = []
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  for (const inv of inventoryRows as RawInventoryRow[]) {
    const product = productMap.get(inv.product_id)
    if (!product) continue

    const currentStock = Number(inv.current_stock)
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/inventory/suggestions.ts
git commit -m "feat: add AI ordering suggestion generator"
```

---

## Task 3 — GET/PATCH /api/inventory

**Files:**
- Create: `app/api/inventory/route.ts`

- [ ] **Step 1: Create the route**

```typescript
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

  const { data: inventoryRows } = await supabase
    .from('inventory')
    .select('id, product_id, current_stock, reorder_point, last_restocked_at, expiry_date, updated_at')
    .eq('store_id', store.id)

  if (!inventoryRows || inventoryRows.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const productIds = inventoryRows.map((r: { product_id: string }) => r.product_id)

  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, category, unit, is_active')
    .in('id', productIds)
    .eq('store_id', store.id)
    .eq('is_active', true)

  const productMap = new Map(
    (products ?? []).map((p: { id: string; name: string; brand?: string; category: string; unit: string; is_active: boolean }) => [p.id, p])
  )

  const items = []

  for (const inv of inventoryRows) {
    const product = productMap.get(inv.product_id)
    if (!product) continue

    const currentStock = Number(inv.current_stock)
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
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/inventory/route.ts
git commit -m "feat: add GET/PATCH /api/inventory for stock list and manual adjustment"
```

---

## Task 4 — GET /api/inventory/suggest

**Files:**
- Create: `app/api/inventory/suggest/route.ts`

- [ ] **Step 1: Create the route**

```typescript
/**
 * FILE: app/api/inventory/suggest/route.ts
 *
 * WHAT THIS DOES:
 *   GET — returns three suggestion buckets: orderToday, reduceOrdering, watchExpiry.
 *   Used by the OrderSuggestionCard on the inventory page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Thin wrapper around lib/inventory/suggestions.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/inventory/OrderSuggestionCard.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { generateOrderingSuggestions } from '@/lib/inventory/suggestions'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const suggestions = await generateOrderingSuggestions(supabase, store.id)
  return NextResponse.json(suggestions)
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/inventory/suggest/route.ts
git commit -m "feat: add GET /api/inventory/suggest ordering suggestion endpoint"
```

---

## Task 5 — StockList component

**Files:**
- Create: `components/inventory/StockList.tsx`

- [ ] **Step 1: Create the component**

```typescript
/**
 * FILE: components/inventory/StockList.tsx
 *
 * WHAT THIS DOES:
 *   Searchable list of all products with colour-coded stock status badges.
 *   Critical/low/out items appear first. Each row shows current stock,
 *   unit, and reorder point. Tapping a row opens a mini-adjustment sheet.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Main content area of the inventory page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
'use client'

import { useState } from 'react'
import type { StockItemWithConsumption, AdjustmentReason } from '@/types'

interface Props {
  items: StockItemWithConsumption[]
  onAdjust: (productId: string, delta: number, reason: AdjustmentReason) => Promise<void>
}

const STATUS_COLORS: Record<string, string> = {
  ok: 'bg-green-100 text-green-800',
  low: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
  out: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  low: 'Low',
  critical: 'Critical',
  out: 'Out',
}

export function StockList({ items, onAdjust }: Props) {
  const [search, setSearch] = useState('')
  const [adjusting, setAdjusting] = useState<string | null>(null)   // productId
  const [delta, setDelta] = useState(0)
  const [reason, setReason] = useState<AdjustmentReason>('correction')
  const [saving, setSaving] = useState(false)

  const filtered = items.filter(item =>
    item.productName.toLowerCase().includes(search.toLowerCase()) ||
    (item.brand ?? '').toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave() {
    if (!adjusting || delta === 0) return
    setSaving(true)
    await onAdjust(adjusting, delta, reason)
    setAdjusting(null)
    setDelta(0)
    setSaving(false)
  }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-3">
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {search ? 'No products match your search.' : 'No stock data yet. Add products and scan bills to see inventory here.'}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        {filtered.map((item, idx) => (
          <div
            key={item.productId}
            className={`flex items-center px-4 py-3 gap-3 cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors ${idx < filtered.length - 1 ? 'border-b border-border' : ''}`}
            onClick={() => { setAdjusting(item.productId); setDelta(0); setReason('correction') }}
          >
            {/* Status dot */}
            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.stockStatus]}`}>
              {STATUS_LABELS[item.stockStatus]}
            </span>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
              {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand}</p>}
            </div>

            {/* Stock count */}
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-foreground">
                {item.currentStock} <span className="font-normal text-muted-foreground text-xs">{item.unit}</span>
              </p>
              {item.reorderPoint > 0 && (
                <p className="text-xs text-muted-foreground">reorder @ {item.reorderPoint}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Adjustment bottom sheet */}
      {adjusting && (() => {
        const item = items.find(i => i.productId === adjusting)
        if (!item) return null
        return (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setAdjusting(null)}>
            <div
              className="w-full rounded-t-2xl bg-background border-t border-border p-6 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold text-base">{item.productName}</h3>
              <p className="text-sm text-muted-foreground">Current stock: {item.currentStock} {item.unit}</p>

              {/* Delta stepper */}
              <div>
                <p className="text-sm font-medium mb-2">Adjust by</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setDelta(d => d - 1)}
                    className="w-10 h-10 rounded-full bg-muted text-foreground text-xl flex items-center justify-center"
                  >-</button>
                  <span className={`min-w-[3rem] text-center text-lg font-bold ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                  <button
                    onClick={() => setDelta(d => d + 1)}
                    className="w-10 h-10 rounded-full bg-slate-800 text-white text-xl flex items-center justify-center"
                  >+</button>
                </div>
              </div>

              {/* Reason */}
              <div>
                <p className="text-sm font-medium mb-2">Reason</p>
                <div className="flex flex-wrap gap-2">
                  {(['correction', 'damaged', 'expired', 'theft', 'waste', 'other'] as AdjustmentReason[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${reason === r ? 'bg-slate-800 text-white border-slate-800' : 'bg-background text-foreground border-border'}`}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={delta === 0 || saving}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm disabled:opacity-40"
              >
                {saving ? 'Saving...' : `Save adjustment (${delta > 0 ? '+' : ''}${delta} ${item.unit})`}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/inventory/StockList.tsx
git commit -m "feat: add StockList component with colour-coded status and adjustment sheet"
```

---

## Task 6 — ConsumptionCard component

**Files:**
- Create: `components/inventory/ConsumptionCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
/**
 * FILE: components/inventory/ConsumptionCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows consumption intelligence for a single product:
 *   "Ordered X units Y days ago. Z remaining. Rate: ~N/day. Runs out in ~D days."
 *   Matches the example from CLAUDE.md §3b.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Rendered inside the inventory page for products that have consumption data.
 *   Can also be shown in a product detail view later.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
import type { ConsumptionData } from '@/types'

interface Props {
  productName: string
  unit: string
  currentStock: number
  consumption: ConsumptionData
}

export function ConsumptionCard({ productName, unit, currentStock, consumption }: Props) {
  const { orderedQty, daysSinceOrder, dailyRate, daysUntilStockout } = consumption

  const urgencyColor =
    daysUntilStockout <= 1 ? 'border-red-200 bg-red-50'
    : daysUntilStockout <= 3 ? 'border-amber-200 bg-amber-50'
    : 'border-slate-100 bg-slate-50'

  const stockoutText =
    daysUntilStockout === Infinity || dailyRate === 0
      ? 'Consumption not tracked yet.'
      : daysUntilStockout < 1
      ? 'Running out today. Order now.'
      : daysUntilStockout < 2
      ? `Runs out tomorrow at this rate.`
      : `Runs out in ~${Math.floor(daysUntilStockout)} day${Math.floor(daysUntilStockout) === 1 ? '' : 's'}.`

  return (
    <div className={`rounded-xl border p-4 text-sm ${urgencyColor}`}>
      <p className="font-medium text-foreground mb-1">{productName}</p>
      <p className="text-muted-foreground">
        Ordered {orderedQty} {unit}{orderedQty === 1 ? '' : 's'} {daysSinceOrder} day{daysSinceOrder === 1 ? '' : 's'} ago.{' '}
        {currentStock} remaining.
      </p>
      {dailyRate > 0 && (
        <p className="text-muted-foreground">
          Consumption: ~{dailyRate}/{unit}/day.{' '}
          <span className={daysUntilStockout <= 3 ? 'text-red-700 font-medium' : 'text-foreground'}>
            {stockoutText}
          </span>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/inventory/ConsumptionCard.tsx
git commit -m "feat: add ConsumptionCard consumption intelligence component"
```

---

## Task 7 — ExpiryAlert component

**Files:**
- Create: `components/inventory/ExpiryAlert.tsx`

- [ ] **Step 1: Create the component**

```typescript
/**
 * FILE: components/inventory/ExpiryAlert.tsx
 *
 * WHAT THIS DOES:
 *   Yellow banner listing all products whose expiry date is within 7 days.
 *   Shows product name, units remaining, and days until expiry.
 *   Hidden when no expiring items exist.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Top of the inventory page, above the stock list.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
import type { StockItemWithConsumption } from '@/types'

interface Props {
  items: StockItemWithConsumption[]
}

export function ExpiryAlert({ items }: Props) {
  const expiring = items.filter(item => {
    if (!item.expiryDate || item.currentStock <= 0) return false
    const daysUntil = Math.ceil(
      (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysUntil <= 7
  })

  if (expiring.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-800">
        {expiring.length} item{expiring.length === 1 ? '' : 's'} expiring soon
      </p>
      {expiring.map(item => {
        const daysUntil = Math.ceil(
          (new Date(item.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return (
          <div key={item.productId} className="flex items-center justify-between text-sm">
            <span className="text-amber-900">
              {item.productName} — {item.currentStock} {item.unit}{item.currentStock === 1 ? '' : 's'}
            </span>
            <span className="text-amber-700 font-medium shrink-0 ml-2">
              {daysUntil <= 0 ? 'Expired' : `${daysUntil}d left`}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-amber-700 pt-1">Consider a discount or priority sale.</p>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/inventory/ExpiryAlert.tsx
git commit -m "feat: add ExpiryAlert component for products expiring within 7 days"
```

---

## Task 8 — OrderSuggestionCard component

**Files:**
- Create: `components/inventory/OrderSuggestionCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
/**
 * FILE: components/inventory/OrderSuggestionCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows three suggestion buckets (Order Today, Reduce Ordering, Watch Expiry).
 *   Each item in "Order Today" has a "Log purchase" CTA that navigates to /entry
 *   with the product pre-selected.
 *   Fetches /api/inventory/suggest on mount.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Top section of the inventory page, below the upload schedule prompt.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InventorySuggestionsResult, OrderSuggestion } from '@/types'

export function OrderSuggestionCard() {
  const [data, setData] = useState<InventorySuggestionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/inventory/suggest')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground animate-pulse">
      Loading suggestions...
    </div>
  )

  if (!data) return null

  const hasAnything = data.orderToday.length > 0 || data.reduceOrdering.length > 0 || data.watchExpiry.length > 0
  if (!hasAnything) return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
      All stock levels look good. No orders needed today.
    </div>
  )

  return (
    <div className="space-y-3">
      {data.orderToday.length > 0 && (
        <SuggestionSection
          title="Order today"
          items={data.orderToday}
          accentClass="border-red-200 bg-red-50"
          titleClass="text-red-800"
          showLogPurchase
          onLogPurchase={pid => router.push(`/entry?mode=full&productId=${pid}`)}
        />
      )}
      {data.watchExpiry.length > 0 && (
        <SuggestionSection
          title="Watch for expiry"
          items={data.watchExpiry}
          accentClass="border-amber-200 bg-amber-50"
          titleClass="text-amber-800"
          showLogPurchase={false}
          onLogPurchase={() => {}}
        />
      )}
      {data.reduceOrdering.length > 0 && (
        <SuggestionSection
          title="Reduce ordering"
          items={data.reduceOrdering}
          accentClass="border-slate-100 bg-slate-50"
          titleClass="text-slate-700"
          showLogPurchase={false}
          onLogPurchase={() => {}}
        />
      )}
    </div>
  )
}

function SuggestionSection({
  title,
  items,
  accentClass,
  titleClass,
  showLogPurchase,
  onLogPurchase,
}: {
  title: string
  items: OrderSuggestion[]
  accentClass: string
  titleClass: string
  showLogPurchase: boolean
  onLogPurchase: (productId: string) => void
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${accentClass}`}>
      <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>
      {items.map(item => (
        <div key={item.productId} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
            <p className="text-xs text-muted-foreground">{item.reason}</p>
          </div>
          {showLogPurchase && (
            <button
              onClick={() => onLogPurchase(item.productId)}
              className="shrink-0 text-xs font-medium text-slate-700 underline underline-offset-2"
            >
              Log purchase
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/inventory/OrderSuggestionCard.tsx
git commit -m "feat: add OrderSuggestionCard with 3-bucket AI suggestions"
```

---

## Task 9 — Inventory page

**Files:**
- Create: `app/(dashboard)/inventory/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
/**
 * FILE: app/(dashboard)/inventory/page.tsx
 *
 * WHAT THIS DOES:
 *   Main inventory screen. Shows:
 *   1. Upload schedule prompt (if no transactions in 24+ hours)
 *   2. AI ordering suggestions (OrderSuggestionCard)
 *   3. Expiry alerts (ExpiryAlert)
 *   4. Searchable stock list (StockList) with manual adjustment
 *   5. Top-5 critical/low products with consumption cards
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Accessed via /inventory route, BottomNav "Stock" tab.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx (inherits BottomNav)
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import type { StockItemWithConsumption, AdjustmentReason } from '@/types'
import { StockList } from '@/components/inventory/StockList'
import { ExpiryAlert } from '@/components/inventory/ExpiryAlert'
import { ConsumptionCard } from '@/components/inventory/ConsumptionCard'
import { OrderSuggestionCard } from '@/components/inventory/OrderSuggestionCard'

interface InventoryResponse {
  items: StockItemWithConsumption[]
}

export default function InventoryPage() {
  const [items, setItems] = useState<StockItemWithConsumption[]>([])
  const [loading, setLoading] = useState(true)
  const [lastTxDate, setLastTxDate] = useState<string | null>(null)
  const [uploadPromptDismissed, setUploadPromptDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [invRes, txRes] = await Promise.all([
      fetch('/api/inventory'),
      fetch('/api/transactions/last'),
    ])
    if (invRes.ok) {
      const data: InventoryResponse = await invRes.json()
      setItems(data.items)
    }
    if (txRes.ok) {
      const data = await txRes.json()
      setLastTxDate(data.lastDate ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdjust(productId: string, delta: number, reason: AdjustmentReason) {
    await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, delta, reason }),
    })
    await load()
  }

  // Show upload prompt if last transaction was more than 24h ago
  const showUploadPrompt = !uploadPromptDismissed && lastTxDate != null && (() => {
    const ageMs = Date.now() - new Date(lastTxDate).getTime()
    return ageMs > 24 * 60 * 60 * 1000
  })()

  // Products with alerting consumption data (stockout <= 7 days), show top 5
  const consumptionAlerts = items
    .filter(i => i.consumption && i.consumption.daysUntilStockout <= 7 && i.consumption.dailyRate > 0)
    .slice(0, 5)

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="h-6 bg-muted rounded w-32 mb-6 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map(n => <div key={n} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5 pb-24">
      <h1 className="text-xl font-semibold text-foreground">Stock</h1>

      {/* Upload schedule prompt */}
      {showUploadPrompt && lastTxDate && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-blue-900">
              No transactions since {new Date(lastTxDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">Upload now to keep inventory accurate.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/scan" className="text-xs font-semibold text-blue-700 underline underline-offset-2">
              Scan bill
            </Link>
            <button
              onClick={() => setUploadPromptDismissed(true)}
              className="text-blue-400 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* AI ordering suggestions */}
      <OrderSuggestionCard />

      {/* Expiry alerts */}
      <ExpiryAlert items={items} />

      {/* Consumption alerts (stockout within 7 days) */}
      {consumptionAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Running low soon</p>
          {consumptionAlerts.map(item => (
            <ConsumptionCard
              key={item.productId}
              productName={item.productName}
              unit={item.unit}
              currentStock={item.currentStock}
              consumption={item.consumption!}
            />
          ))}
        </div>
      )}

      {/* Full stock list */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">All products</p>
        <StockList items={items} onAdjust={handleAdjust} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the `/api/transactions/last` route** (needed by the page to check upload schedule)

Create `app/api/transactions/last/route.ts`:

```typescript
/**
 * FILE: app/api/transactions/last/route.ts
 *
 * WHAT THIS DOES:
 *   Returns the created_at date of the most recent transaction for this store.
 *   Used by the inventory page to show the upload schedule prompt.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Called by app/(dashboard)/inventory/page.tsx on mount.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ lastDate: null })

  const { data: tx } = await supabase
    .from('transactions')
    .select('created_at')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ lastDate: tx?.created_at ?? null })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Build check**

```bash
npm run build
```
Expected: successful build, `/inventory` route appears in the output.

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/inventory/page.tsx app/api/transactions/last/route.ts
git commit -m "feat: add inventory page with upload prompt, suggestions, expiry alerts, and stock list"
```

---

## Self-Review Checklist

### Spec coverage

| CLAUDE.md requirement | Covered by |
|---|---|
| 3a — Stock tracker: per-product stock, reorder point, colour coding | Task 3 (API), Task 5 (StockList) |
| 3a — Frequently low products at top | Task 3 (sort by statusOrder) |
| 3b — Consumption tracking: ordered qty, current qty, days since order | Task 1 (consumption.ts) |
| 3b — Daily rate + days-until-stockout | Task 1 |
| 3b — "Ordered 100 units 5 days ago…" display | Task 6 (ConsumptionCard) |
| 3c — Expiry date per product | Task 3 fetches expiry_date, Task 7 renders ExpiryAlert |
| 3c — Warning within 7 days | Task 7 (ExpiryAlert) |
| 3d — Order today list | Task 2 (suggestions.ts), Task 4 (API), Task 8 (OrderSuggestionCard) |
| 3d — Reduce ordering list | Task 2, Task 4, Task 8 |
| 3d — Watch for expiry list | Task 2, Task 4, Task 8 |
| 3d — "Log purchase" CTA on order items | Task 8 (showLogPurchase) |
| 3e — Upload schedule prompt | Task 9 (InventoryPage, showUploadPrompt) |
| 3e — "You haven't added transactions since [date]" | Task 9 |

All requirements covered. No gaps found.

### Placeholder scan

No TBD / TODO / placeholder text found.

### Type consistency

- `StockItemWithConsumption` used consistently across Task 0, 3, 5, 6, 7, 9
- `ConsumptionData` returned by Task 1, consumed by Task 6 and 9
- `InventorySuggestionsResult` returned by Task 4, consumed by Task 8
- `AdjustmentReason` used in Task 0, 3, 5, 9 — consistent
- `getConsumptionData` signature identical in Tasks 1, 3, 2 (via import)
- `generateOrderingSuggestions(supabase, storeId)` defined in Task 2, called in Task 4

All consistent. ✓

---

Plan complete and saved to `docs/superpowers/plans/2026-06-10-phase-3-inventory.md`.
