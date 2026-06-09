# Phase 2 — Bill Scanning and Transaction Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the core daily loop — merchants scan bills, confirm extracted items, save transactions, and inventory updates automatically. Manual quick/full entry and customer management included.

**Architecture:** Synchronous extraction pipeline (upload → Claude Vision → confirm screen), shared `updateStock` helper for all inventory writes, client-side product filtering over fetched list, BottomNav layout wrapping all dashboard routes.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (Storage + RLS), `@anthropic-ai/sdk` (`claude-sonnet-4-6`), `browser-image-compression`, shadcn/ui, Tailwind CSS

**Pre-conditions (user must do before Task 0):**
1. Create a private `documents` bucket in Supabase Storage dashboard (Storage → New bucket → Name: `documents` → Private)
2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`

---

## File Map

**New:** `lib/anthropic/extraction.ts`, `lib/inventory/updateStock.ts`, `app/api/scan/route.ts`, `app/api/scan/confirm/route.ts`, `app/api/entry/quick/route.ts`, `app/api/entry/full/route.ts`, `app/api/customers/route.ts`, `app/api/customers/[id]/route.ts`, `components/scan/ScanUpload.tsx`, `components/scan/ScanLoading.tsx`, `components/scan/ExtractionReview.tsx`, `components/scan/LedgerReview.tsx`, `components/scan/ConfidenceBadge.tsx`, `components/scan/DuplicateWarning.tsx`, `components/entry/QuickEntry.tsx`, `components/entry/FullEntryForm.tsx`, `components/entry/ProductSearch.tsx`, `components/entry/CustomerSheet.tsx`, `components/customers/CustomerLedger.tsx`, `components/customers/CreditBadge.tsx`, `components/shared/BottomNav.tsx`, `app/(dashboard)/scan/page.tsx`, `app/(dashboard)/entry/page.tsx`, `app/(dashboard)/customers/page.tsx`

**Modified:** `types/index.ts`, `app/(dashboard)/layout.tsx`

---

### Task 0: Install dependencies

**Files:** `package.json`

- [ ] **Step 1: Install**

```bash
cd "c:\Users\harwa\OneDrive\Desktop\Roy\Projects\KhaataOnline"
npm install @anthropic-ai/sdk browser-image-compression
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @anthropic-ai/sdk and browser-image-compression"
```

---

### Task 1: Add Phase 2 types

**Files:** Modify `types/index.ts`

- [ ] **Step 1: Add after the `// ─── TRANSACTIONS` block and before `// ─── SHARED`**

```typescript
// ─── DOCUMENT UPLOADS ────────────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "medium" | "low"
export type DocumentType = "single_bill" | "ledger_page"
export type ExtractionStatus = "pending" | "extracted" | "confirmed" | "failed"
export type StockMovementType = "purchase" | "sale" | "adjustment" | "waste"

export interface ExtractionItem {
  productNameRaw: string
  matchedProductId?: string
  matchedProductName?: string
  needsCatalogAdd: boolean
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRate?: number
  fieldConfidence: {
    quantity: ConfidenceLevel
    unitPrice: ConfidenceLevel
    totalPrice: ConfidenceLevel
  }
}

export interface ExtractionResult {
  documentType: DocumentType
  vendorName?: string
  date?: string
  totalAmount?: number
  confidence: ConfidenceLevel
  items: ExtractionItem[]
  duplicateWarning?: { date: string; id: string }
}

export interface DocumentUpload {
  id: string
  storeId: string
  userId: string
  storagePath: string
  fileType: string
  documentType: DocumentType
  extractionStatus: ExtractionStatus
  rawExtractionJson?: ExtractionResult
  confidence?: ConfidenceLevel
  createdAt: string
}

// ─── ENTRY ────────────────────────────────────────────────────────────────────

export interface QuickEntryItem { productId: string; quantity: number }
export interface QuickEntryPayload {
  type: TransactionType
  items: QuickEntryItem[]
  customerId?: string
  paymentMethod: PaymentMethod
}

export interface FullEntryItem { productId: string; quantity: number; unitPrice: number }
export interface FullEntryPayload {
  date: string
  type: TransactionType
  items: FullEntryItem[]
  customerId?: string
  vendorName?: string
  paymentMethod: PaymentMethod
  notes?: string
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add types/index.ts
git commit -m "feat: add Phase 2 types (ExtractionResult, entry payloads)"
```

---

### Task 2: Anthropic extraction library

**Files:** Create `lib/anthropic/extraction.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: lib/anthropic/extraction.ts
 * WHAT THIS DOES: Builds Claude Vision prompt and calls Anthropic API.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Server-only. Called exclusively by POST /api/scan.
 * CALLED BY / IMPORTS FROM: app/api/scan/route.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractionResult } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ExtractParams {
  storeId: string
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  supabase: SupabaseClient
}

export async function extractBillData(params: ExtractParams): Promise<ExtractionResult> {
  const { storeId, imageBase64, mimeType, supabase } = params

  const [{ data: products }, { data: corrections }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, unit, item_number')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('extraction_corrections')
      .select('field_name, original_value, corrected_value')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const productLines = (products ?? [])
    .map(p => `  {"id":"${p.id}","name":"${p.name}","unit":"${p.unit}","item_number":${p.item_number}}`)
    .join('\n') || '  (no products yet)'

  const correctionLines = (corrections ?? [])
    .map(c => `  - "${c.original_value}" corrected to "${c.corrected_value}" (${c.field_name})`)
    .join('\n') || '  (none yet)'

  const system = `You extract structured data from Indian retail bill images.
Return ONLY valid JSON — no preamble, no markdown.

PREVIOUS CORRECTIONS FOR THIS STORE:
${correctionLines}

STORE CATALOG (match items to these IDs when possible):
${productLines}

Return JSON:
{
  "document_type": "single_bill",
  "vendor_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "total_amount": number_or_null,
  "confidence": "high|medium|low",
  "items": [{
    "product_name_raw": "exact text from bill",
    "matched_product_id": "uuid from catalog or null",
    "matched_product_name": "catalog name or null",
    "needs_catalog_add": false,
    "quantity": 10,
    "unit_price": 22.00,
    "total_price": 220.00,
    "tax_rate": 0,
    "field_confidence": {"quantity":"high","unit_price":"high","total_price":"high"}
  }]
}
Rules:
- matched_product_id MUST be a UUID from the catalog or null
- needs_catalog_add is true when matched_product_id is null
- Handle: Rs./₹, commas as thousands separators, "only" suffix, Devanagari numerals
- document_type "ledger_page" when image shows multiple transaction rows`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: 'Extract all data from this bill. Return only valid JSON.' },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(text) as ExtractionResult
  } catch {
    throw new Error('extraction_failed')
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add lib/anthropic/extraction.ts
git commit -m "feat: add Claude Vision extraction library"
```

---

### Task 3: Inventory update helper

**Files:** Create `lib/inventory/updateStock.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: lib/inventory/updateStock.ts
 * WHAT THIS DOES: Writes stock_movements row and upserts inventory.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: All stock changes go through this. Server-only.
 * CALLED BY / IMPORTS FROM: /api/scan/confirm, /api/entry/quick, /api/entry/full
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StockMovementType } from '@/types'

interface UpdateStockParams {
  storeId: string
  productId: string
  delta: number        // positive = add stock, negative = remove stock
  transactionId: string
  movementType: StockMovementType
  unitPrice?: number
}

export async function updateStock(supabase: SupabaseClient, p: UpdateStockParams): Promise<void> {
  const { error: moveError } = await supabase.from('stock_movements').insert({
    store_id: p.storeId,
    product_id: p.productId,
    movement_type: p.movementType,
    quantity: Math.abs(p.delta),
    unit_price: p.unitPrice ?? null,
    transaction_id: p.transactionId,
  })
  if (moveError) throw new Error(`stock_movement_failed: ${moveError.message}`)

  const { data: existing } = await supabase
    .from('inventory')
    .select('id, current_stock')
    .eq('store_id', p.storeId)
    .eq('product_id', p.productId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('inventory')
      .update({
        current_stock: Number(existing.current_stock) + p.delta,
        ...(p.delta > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
      })
      .eq('id', existing.id)
    if (error) throw new Error(`inventory_update_failed: ${error.message}`)
  } else {
    const { error } = await supabase.from('inventory').insert({
      store_id: p.storeId,
      product_id: p.productId,
      current_stock: Math.max(0, p.delta),
      reorder_point: 0,
      ...(p.delta > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
    })
    if (error) throw new Error(`inventory_insert_failed: ${error.message}`)
  }
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add lib/inventory/updateStock.ts
git commit -m "feat: add updateStock inventory helper"
```

---

### Task 4: POST /api/scan

**Files:** Create `app/api/scan/route.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: app/api/scan/route.ts
 * WHAT THIS DOES: Accepts bill image, uploads to Storage, calls Claude Vision,
 *   returns structured extraction result. Synchronous — client waits.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Called by /scan page after user selects file.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/scan/page.tsx
 */

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { extractBillData } from '@/lib/anthropic/extraction'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type AllowedMime = typeof ALLOWED_TYPES[number]

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let formData: FormData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type))
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP are supported' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('documents').upload(storagePath, fileBuffer, { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const { data: docUpload, error: docError } = await supabase
    .from('document_uploads')
    .insert({
      store_id: store.id, user_id: user.id, storage_path: storagePath,
      file_type: file.type, document_type: 'single_bill', extraction_status: 'pending',
    })
    .select('id').single()
  if (docError) return NextResponse.json({ error: 'Database error' }, { status: 500 })

  const { data: blob } = await supabase.storage.from('documents').download(storagePath)
  if (!blob) return NextResponse.json({ error: 'Could not read uploaded file' }, { status: 500 })

  const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64')

  let result
  try {
    result = await extractBillData({ storeId: store.id, imageBase64, mimeType: file.type as AllowedMime, supabase })
  } catch {
    await supabase.from('document_uploads').update({ extraction_status: 'failed' }).eq('id', docUpload.id)
    return NextResponse.json({ error: 'Could not read this bill. Please try a clearer photo.' }, { status: 422 })
  }

  // Duplicate detection
  if (result.vendorName && result.totalAmount) {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const { data: dup } = await supabase.from('transactions')
      .select('id, created_at')
      .eq('store_id', store.id)
      .eq('vendor_name', result.vendorName)
      .eq('total_amount', result.totalAmount)
      .gte('created_at', yesterday)
      .maybeSingle()
    if (dup) result.duplicateWarning = { date: dup.created_at, id: dup.id }
  }

  await supabase.from('document_uploads').update({
    document_type: result.documentType, extraction_status: 'extracted',
    raw_extraction_json: result, confidence: result.confidence,
  }).eq('id', docUpload.id)

  return NextResponse.json({ result, documentUploadId: docUpload.id })
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add app/api/scan/route.ts
git commit -m "feat: add POST /api/scan upload and extraction route"
```

---

### Task 5: POST /api/scan/confirm

**Files:** Create `app/api/scan/confirm/route.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: app/api/scan/confirm/route.ts
 * WHAT THIS DOES: Saves confirmed extraction. Writes transaction, items,
 *   stock movements, extraction corrections. Creates placeholder products
 *   for unrecognised items.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Called after merchant reviews and confirms extraction.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/scan/page.tsx
 */

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateStock } from '@/lib/inventory/updateStock'
import type { ExtractionItem } from '@/types'

interface ConfirmItem {
  productId?: string
  productNameRaw: string
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRate: number
  needsCatalogAdd: boolean
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body: {
    documentUploadId: string; vendorName?: string; date?: string; totalAmount?: number
    items: ConfirmItem[]; originalItems?: ExtractionItem[]
  } = await request.json()

  if (!body.items?.length) return NextResponse.json({ error: 'No items to save' }, { status: 400 })

  const total = body.totalAmount ?? body.items.reduce((s, i) => s + i.totalPrice, 0)

  const { data: tx, error: txError } = await supabase.from('transactions').insert({
    store_id: store.id, user_id: user.id,
    date: body.date ?? new Date().toISOString().split('T')[0],
    type: 'purchase', total_amount: total,
    vendor_name: body.vendorName ?? null,
    source: 'bill_scan', source_document_id: body.documentUploadId,
    tax_amount: 0, payment_method: 'cash',
  }).select('id').single()
  if (txError) return NextResponse.json({ error: 'Failed to save transaction' }, { status: 500 })

  for (const item of body.items) {
    let productId = item.productId ?? null

    if (item.needsCatalogAdd && !productId) {
      const { data: np } = await supabase.from('products').insert({
        store_id: store.id, name: item.productNameRaw, unit: 'piece',
        purchase_price: item.unitPrice, selling_price: item.unitPrice,
        tax_rate: item.taxRate, is_active: false, is_pinned: false,
      }).select('id').single()
      productId = np?.id ?? null
    }

    await supabase.from('transaction_items').insert({
      transaction_id: tx.id, product_id: productId,
      product_name_raw: item.productNameRaw, quantity: item.quantity,
      unit_price: item.unitPrice, total_price: item.totalPrice,
      tax_rate: item.taxRate, is_confirmed: true,
    })

    if (productId) {
      await updateStock(supabase, {
        storeId: store.id, productId, delta: item.quantity,
        transactionId: tx.id, movementType: 'purchase', unitPrice: item.unitPrice,
      })
    }
  }

  // Save corrections for extraction learning
  if (body.originalItems?.length) {
    for (let i = 0; i < Math.min(body.items.length, body.originalItems.length); i++) {
      const orig = body.originalItems[i], confirmed = body.items[i]
      if (orig.quantity !== confirmed.quantity) {
        await supabase.from('extraction_corrections').insert({
          store_id: store.id, document_upload_id: body.documentUploadId,
          field_name: 'quantity',
          original_value: String(orig.quantity), corrected_value: String(confirmed.quantity),
        })
      }
    }
  }

  await supabase.from('document_uploads')
    .update({ extraction_status: 'confirmed' })
    .eq('id', body.documentUploadId).eq('store_id', store.id)

  return NextResponse.json({ transactionId: tx.id }, { status: 201 })
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add app/api/scan/confirm/route.ts
git commit -m "feat: add POST /api/scan/confirm transaction save route"
```

---

### Task 6: Scan base components

**Files:** `components/scan/ScanUpload.tsx`, `ScanLoading.tsx`, `ConfidenceBadge.tsx`, `DuplicateWarning.tsx`

- [ ] **Step 1: Create `components/scan/ScanUpload.tsx`**

```typescript
/**
 * FILE: components/scan/ScanUpload.tsx
 * WHAT THIS DOES: Source selector grid — Camera / Gallery / File.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: First screen on /scan.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/scan/page.tsx
 */
'use client'
import { useRef } from 'react'

export function ScanUpload({ onFileSelected }: { onFileSelected: (f: File) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) onFileSelected(f); e.target.value = ''
  }
  const tile = (onClick: () => void, icon: string, label: string, sub: string) => (
    <button onClick={onClick}
      className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-xl p-6 hover:border-slate-400 hover:bg-gray-50 transition-colors">
      <span className="text-3xl mb-2">{icon}</span>
      <span className="text-sm font-semibold text-gray-900">{label}</span>
      <span className="text-xs text-gray-500 mt-0.5">{sub}</span>
    </button>
  )
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Scan a bill</h1>
      <p className="text-sm text-gray-500 mb-8 text-center">Take a photo or choose an image</p>
      <div className="w-full max-w-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {tile(() => cameraRef.current?.click(), '📷', 'Camera', 'Take new photo')}
          {tile(() => galleryRef.current?.click(), '🖼️', 'Gallery', 'Pick from photos')}
        </div>
        {tile(() => fileRef.current?.click(), '📄', 'Choose file', 'Image from files')}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
    </div>
  )
}
```

- [ ] **Step 2: Create `components/scan/ScanLoading.tsx`**

```typescript
/**
 * FILE: components/scan/ScanLoading.tsx
 * WHAT THIS DOES: Full-screen spinner with live sub-message during extraction.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Between file selection and confirm screen.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/scan/page.tsx
 */
'use client'
export function ScanLoading({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700 mb-6" />
      <p className="text-base font-medium text-gray-900">{message}</p>
      <p className="text-sm text-gray-400 mt-2">This usually takes 5–15 seconds</p>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/scan/ConfidenceBadge.tsx`**

```typescript
/**
 * FILE: components/scan/ConfidenceBadge.tsx
 * WHAT THIS DOES: Inline amber warning for low-confidence extraction fields.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Inside ExtractionReview item rows.
 * CALLED BY / IMPORTS FROM: components/scan/ExtractionReview.tsx
 */
import type { ConfidenceLevel } from '@/types'
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  if (level === 'high') return null
  return <span className="text-xs text-amber-700 font-medium">⚠ Low confidence — please check</span>
}
```

- [ ] **Step 4: Create `components/scan/DuplicateWarning.tsx`**

```typescript
/**
 * FILE: components/scan/DuplicateWarning.tsx
 * WHAT THIS DOES: Warning banner when a bill appears to be already recorded.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Top of ExtractionReview when duplicate detected.
 * CALLED BY / IMPORTS FROM: components/scan/ExtractionReview.tsx
 */
export function DuplicateWarning({ date }: { date: string }) {
  const formatted = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
      <p className="text-sm font-medium text-orange-800">Looks like this was already added on {formatted}</p>
      <p className="text-xs text-orange-600 mt-0.5">Save again only if this is a different delivery.</p>
    </div>
  )
}
```

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
git add components/scan/
git commit -m "feat: add scan base UI components"
```

---

### Task 7: ExtractionReview component

**Files:** Create `components/scan/ExtractionReview.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: components/scan/ExtractionReview.tsx
 * WHAT THIS DOES: Confirm screen for a single extracted bill.
 *   Dark sticky header. Scrollable item rows with +/- buttons.
 *   Amber rows for low confidence, red sub-text for not-in-catalog.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Shown after successful extraction on /scan.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState } from 'react'
import type { ExtractionResult, ExtractionItem } from '@/types'
import { ConfidenceBadge } from './ConfidenceBadge'
import { DuplicateWarning } from './DuplicateWarning'

interface Props {
  result: ExtractionResult
  documentUploadId: string
  onConfirm: (items: ExtractionItem[], docId: string) => Promise<void>
  onEditAll: () => void
}

export function ExtractionReview({ result, documentUploadId, onConfirm, onEditAll }: Props) {
  const [items, setItems] = useState<ExtractionItem[]>(result.items)
  const [saving, setSaving] = useState(false)

  function adj(i: number, d: number) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.max(0, it.quantity + d) } : it))
  }

  async function handleSave() {
    setSaving(true); await onConfirm(items, documentUploadId); setSaving(false)
  }

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
  const hasLowConf = result.confidence !== 'high' ||
    items.some(it => Object.values(it.fieldConfidence).some(c => c !== 'high'))

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-slate-900 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 truncate max-w-[200px]">
            {result.vendorName ?? 'Unknown vendor'} · {result.date ?? 'Unknown date'}
          </p>
          <p className="text-xl font-bold text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        </div>
        <button onClick={onEditAll} className="text-xs text-slate-300 bg-white/10 px-3 py-1.5 rounded-md">Edit all</button>
      </div>

      <div className="flex-1 px-4 py-3 space-y-2">
        {result.duplicateWarning && <DuplicateWarning date={result.duplicateWarning.date} />}
        {hasLowConf && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-800 font-medium">Some fields may be incorrect — review before saving</p>
          </div>
        )}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{items.length} items · scroll to review</p>
          </div>
          {items.map((it, i) => {
            const lowConf = Object.values(it.fieldConfidence).some(c => c !== 'high')
            return (
              <div key={i} className={`flex items-center px-3 py-3 border-b border-gray-100 last:border-0 ${lowConf ? 'bg-amber-50' : ''}`}>
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{it.matchedProductName ?? it.productNameRaw}</p>
                  {lowConf && <ConfidenceBadge level="low" />}
                  {it.needsCatalogAdd && <p className="text-xs text-red-600 mt-0.5">Not in catalog — will be added</p>}
                  <p className="text-xs text-gray-400 mt-0.5">₹{it.unitPrice} each</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => adj(i, -1)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${it.quantity === 0 ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>−</button>
                  <span className={`text-sm font-bold min-w-[20px] text-center ${it.quantity === 0 ? 'text-gray-300' : 'text-gray-900'}`}>{it.quantity}</span>
                  <button onClick={() => adj(i, 1)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm text-gray-600 hover:bg-gray-200">+</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100">
        <button onClick={handleSave} disabled={saving || items.every(it => it.quantity === 0)}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60">
          {saving ? 'Saving...' : `Save ${items.filter(it => it.quantity > 0).length} items · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <button onClick={onEditAll} className="w-full text-center text-xs text-gray-400 mt-2 py-1">Edit all details</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/scan/ExtractionReview.tsx
git commit -m "feat: add ExtractionReview confirm screen"
```

---

### Task 8: LedgerReview component

**Files:** Create `components/scan/LedgerReview.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: components/scan/LedgerReview.tsx
 * WHAT THIS DOES: Checklist confirm for ledger pages. Each row has a checkbox.
 *   Unchecked rows are excluded from save.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Shown when document_type === 'ledger_page'.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/scan/page.tsx
 */
'use client'
import { useState } from 'react'
import type { ExtractionItem } from '@/types'

interface Props {
  items: ExtractionItem[]
  documentUploadId: string
  vendorName?: string
  onConfirm: (items: ExtractionItem[], docId: string) => Promise<void>
}

export function LedgerReview({ items, documentUploadId, vendorName, onConfirm }: Props) {
  const [checked, setChecked] = useState<boolean[]>(items.map(() => true))
  const [saving, setSaving] = useState(false)

  const toggle = (i: number) => setChecked(prev => prev.map((c, idx) => idx === i ? !c : c))
  const selected = items.filter((_, i) => checked[i])
  const total = selected.reduce((s, it) => s + it.totalPrice, 0)

  async function handleSave() {
    setSaving(true); await onConfirm(selected, documentUploadId); setSaving(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-slate-900 px-4 py-3">
        <p className="text-xs text-slate-400">{vendorName ?? 'Ledger page'}</p>
        <p className="text-xl font-bold text-white">{selected.length} transactions · ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      </div>
      <div className="flex-1 px-4 py-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Uncheck rows to exclude</p>
          </div>
          {items.map((it, i) => (
            <button key={i} onClick={() => toggle(i)}
              className={`w-full flex items-center px-3 py-3 border-b border-gray-100 last:border-0 text-left ${!checked[i] ? 'opacity-40' : ''}`}>
              <div className={`w-5 h-5 rounded border-2 mr-3 flex-shrink-0 flex items-center justify-center ${checked[i] ? 'bg-slate-800 border-slate-800' : 'border-gray-300'}`}>
                {checked[i] && <span className="text-white text-xs">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{it.matchedProductName ?? it.productNameRaw}</p>
                <p className="text-xs text-gray-500">{it.quantity} × ₹{it.unitPrice}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900 ml-2">₹{it.totalPrice.toLocaleString('en-IN')}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100">
        <button onClick={handleSave} disabled={saving || selected.length === 0}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60">
          {saving ? 'Saving...' : `Save ${selected.length} transactions · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/scan/LedgerReview.tsx
git commit -m "feat: add LedgerReview component"
```

---

### Task 9: Scan page

**Files:** Create `app/(dashboard)/scan/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: app/(dashboard)/scan/page.tsx
 * WHAT THIS DOES: Orchestrates scan flow: upload → loading → review (3-state machine).
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Route /scan — entry point for bill scanning.
 * CALLED BY / IMPORTS FROM: BottomNav
 */
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ScanUpload } from '@/components/scan/ScanUpload'
import { ScanLoading } from '@/components/scan/ScanLoading'
import { ExtractionReview } from '@/components/scan/ExtractionReview'
import { LedgerReview } from '@/components/scan/LedgerReview'
import type { ExtractionResult, ExtractionItem } from '@/types'

type State = 'upload' | 'loading' | 'review' | 'error'

export default function ScanPage() {
  const [state, setState] = useState<State>('upload')
  const [msg, setMsg] = useState('Uploading your bill...')
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleFileSelected(file: File) {
    setState('loading'); setMsg('Uploading your bill...')
    let uploadFile = file
    if (file.type !== 'application/pdf') {
      try {
        const ic = (await import('browser-image-compression')).default
        uploadFile = await ic(file, { maxSizeMB: 2, useWebWorker: true })
      } catch { /* use original */ }
    }
    const fd = new FormData(); fd.append('file', uploadFile)
    setMsg('Reading your bill...')
    try {
      const res = await fetch('/api/scan', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setState('error'); return }
      setMsg('Finding your products...')
      setResult(data.result); setDocId(data.documentUploadId); setState('review')
    } catch { setError('Could not connect. Check your connection.'); setState('error') }
  }

  async function handleConfirm(items: ExtractionItem[], documentUploadId: string) {
    const res = await fetch('/api/scan/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUploadId, vendorName: result?.vendorName, date: result?.date,
        totalAmount: result?.totalAmount,
        items: items.map(it => ({
          productId: it.matchedProductId, productNameRaw: it.productNameRaw,
          quantity: it.quantity, unitPrice: it.unitPrice,
          totalPrice: it.quantity * it.unitPrice, taxRate: it.taxRate ?? 0,
          needsCatalogAdd: it.needsCatalogAdd,
        })),
        originalItems: result?.items,
      }),
    })
    if (res.ok) { router.push('/dashboard'); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? 'Failed to save.'); setState('error') }
  }

  if (state === 'upload') return <ScanUpload onFileSelected={handleFileSelected} />
  if (state === 'loading') return <ScanLoading message={msg} />
  if (state === 'error') return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-sm text-red-600 mb-4">{error}</p>
      <button onClick={() => { setState('upload'); setError(null) }} className="text-sm text-slate-700 underline">Try again</button>
    </div>
  )
  if (!result || !docId) return null
  if (result.documentType === 'ledger_page')
    return <LedgerReview items={result.items} documentUploadId={docId} vendorName={result.vendorName} onConfirm={handleConfirm} />
  return <ExtractionReview result={result} documentUploadId={docId} onConfirm={handleConfirm} onEditAll={() => router.push('/entry?mode=full')} />
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add "app/(dashboard)/scan/page.tsx"
git commit -m "feat: add scan page (upload → loading → review flow)"
```


---

### Task 10: Entry API routes

**Files:** Create `app/api/entry/quick/route.ts`, `app/api/entry/full/route.ts`

- [ ] **Step 1: Create `app/api/entry/quick/route.ts`**

```typescript
/**
 * FILE: app/api/entry/quick/route.ts
 * WHAT THIS DOES: Saves a quick-mode transaction. Looks up product prices
 *   server-side, writes transaction + items + stock movements.
 *   Updates customer balance for credit sales.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Called by QuickEntry component on save.
 * CALLED BY / IMPORTS FROM: components/entry/QuickEntry.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateStock } from '@/lib/inventory/updateStock'
import type { QuickEntryPayload } from '@/types'

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body: QuickEntryPayload = await request.json()
  if (!body.items?.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 })

  const { data: products } = await supabase
    .from('products')
    .select('id, name, selling_price, purchase_price, tax_rate')
    .in('id', body.items.map(i => i.productId))
    .eq('store_id', store.id)

  const pm = new Map(products?.map(p => [p.id, p]) ?? [])
  const enriched = body.items.map(item => {
    const p = pm.get(item.productId)
    if (!p) throw new Error('product_not_found')
    const unitPrice = body.type === 'sale' ? Number(p.selling_price) : Number(p.purchase_price)
    return { productId: item.productId, productName: p.name, quantity: item.quantity,
             unitPrice, totalPrice: item.quantity * unitPrice, taxRate: Number(p.tax_rate) }
  })

  const totalAmount = enriched.reduce((s, i) => s + i.totalPrice, 0)

  const { data: tx, error: txError } = await supabase.from('transactions').insert({
    store_id: store.id, user_id: user.id,
    date: new Date().toISOString().split('T')[0],
    type: body.type, total_amount: totalAmount,
    customer_id: body.customerId ?? null,
    payment_method: body.paymentMethod,
    source: 'manual_quick', tax_amount: 0,
  }).select('id').single()
  if (txError) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  for (const item of enriched) {
    await supabase.from('transaction_items').insert({
      transaction_id: tx.id, product_id: item.productId,
      product_name_raw: item.productName, quantity: item.quantity,
      unit_price: item.unitPrice, total_price: item.totalPrice,
      tax_rate: item.taxRate, is_confirmed: true,
    })
    const delta = body.type === 'sale' ? -item.quantity : item.quantity
    await updateStock(supabase, {
      storeId: store.id, productId: item.productId, delta,
      transactionId: tx.id,
      movementType: body.type === 'sale' ? 'sale' : 'purchase',
      unitPrice: item.unitPrice,
    })
  }

  // Update customer balance for credit sales
  if (body.customerId && body.paymentMethod === 'credit' && body.type === 'sale') {
    const { data: c } = await supabase.from('customers')
      .select('current_balance').eq('id', body.customerId).eq('store_id', store.id).single()
    if (c) await supabase.from('customers')
      .update({ current_balance: Number(c.current_balance) + totalAmount })
      .eq('id', body.customerId)
  }

  return NextResponse.json({ transactionId: tx.id }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/entry/full/route.ts`**

```typescript
/**
 * FILE: app/api/entry/full/route.ts
 * WHAT THIS DOES: Full-form transaction save. Client provides explicit unitPrice
 *   and date. Otherwise identical to quick route.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Called by FullEntryForm on save.
 * CALLED BY / IMPORTS FROM: components/entry/FullEntryForm.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { updateStock } from '@/lib/inventory/updateStock'
import type { FullEntryPayload } from '@/types'

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body: FullEntryPayload = await request.json()
  if (!body.items?.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 })

  const { data: products } = await supabase
    .from('products').select('id, name, tax_rate')
    .in('id', body.items.map(i => i.productId)).eq('store_id', store.id)
  const pm = new Map(products?.map(p => [p.id, p]) ?? [])

  const enriched = body.items.map(item => {
    const p = pm.get(item.productId)
    return { productId: item.productId, productName: p?.name ?? item.productId,
             quantity: item.quantity, unitPrice: item.unitPrice,
             totalPrice: item.quantity * item.unitPrice, taxRate: Number(p?.tax_rate ?? 0) }
  })

  const totalAmount = enriched.reduce((s, i) => s + i.totalPrice, 0)

  const { data: tx, error: txError } = await supabase.from('transactions').insert({
    store_id: store.id, user_id: user.id, date: body.date,
    type: body.type, total_amount: totalAmount,
    customer_id: body.customerId ?? null, vendor_name: body.vendorName ?? null,
    payment_method: body.paymentMethod, source: 'manual_full',
    tax_amount: 0, notes: body.notes ?? null,
  }).select('id').single()
  if (txError) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  for (const item of enriched) {
    await supabase.from('transaction_items').insert({
      transaction_id: tx.id, product_id: item.productId,
      product_name_raw: item.productName, quantity: item.quantity,
      unit_price: item.unitPrice, total_price: item.totalPrice,
      tax_rate: item.taxRate, is_confirmed: true,
    })
    if (body.type === 'sale' || body.type === 'purchase') {
      const delta = body.type === 'sale' ? -item.quantity : item.quantity
      await updateStock(supabase, {
        storeId: store.id, productId: item.productId, delta,
        transactionId: tx.id, movementType: body.type, unitPrice: item.unitPrice,
      })
    }
  }

  if (body.customerId && body.paymentMethod === 'credit' && body.type === 'sale') {
    const { data: c } = await supabase.from('customers')
      .select('current_balance').eq('id', body.customerId).eq('store_id', store.id).single()
    if (c) await supabase.from('customers')
      .update({ current_balance: Number(c.current_balance) + totalAmount }).eq('id', body.customerId)
  }

  return NextResponse.json({ transactionId: tx.id }, { status: 201 })
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add app/api/entry/quick/route.ts app/api/entry/full/route.ts
git commit -m "feat: add entry quick and full API routes"
```

---

### Task 11: ProductSearch component

**Files:** Create `components/entry/ProductSearch.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: components/entry/ProductSearch.tsx
 * WHAT THIS DOES: Searchable product dropdown. Filters by name, brand, item number.
 *   Results appear below input as a floating list. Closes on selection.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Used in QuickEntry (search bar) and FullEntryForm.
 * CALLED BY / IMPORTS FROM: components/entry/QuickEntry.tsx, FullEntryForm.tsx
 */
'use client'
import { useState } from 'react'
import type { Product } from '@/types'

interface Props {
  products: Product[]
  onSelect: (product: Product) => void
  placeholder?: string
}

export function ProductSearch({ products, onSelect, placeholder = 'Search products...' }: Props) {
  const [query, setQuery] = useState('')

  const filtered = query.length < 1 ? [] : products.filter(p => {
    const q = query.toLowerCase()
    return p.name.toLowerCase().includes(q) ||
      (p.brand ?? '').toLowerCase().includes(q) ||
      String(p.itemNumber).includes(q)
  })

  return (
    <div className="relative">
      <input type="text" value={query} onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      {filtered.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {filtered.slice(0, 20).map(p => (
            <button key={p.id} onClick={() => { onSelect(p); setQuery('') }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
              <p className="text-sm font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-400">#{p.itemNumber} · ₹{p.sellingPrice}</p>
            </button>
          ))}
        </div>
      )}
      {query.length > 0 && filtered.length === 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-3">
          <p className="text-sm text-gray-500">No products found</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/entry/ProductSearch.tsx
git commit -m "feat: add ProductSearch component"
```

---

### Task 12: CustomerSheet component

**Files:** Create `components/entry/CustomerSheet.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: components/entry/CustomerSheet.tsx
 * WHAT THIS DOES: Bottom sheet for attaching a customer to a transaction.
 *   Search existing, create new inline, toggle credit/cash.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Opened from QuickEntry and FullEntryForm footer.
 * CALLED BY / IMPORTS FROM: components/entry/QuickEntry.tsx, FullEntryForm.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import type { Customer } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (customerId: string, paymentMethod: 'cash' | 'upi' | 'credit') => void
}

export function CustomerSheet({ open, onClose, onSelect }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [credit, setCredit] = useState(false)

  useEffect(() => {
    if (open) fetch('/api/customers').then(r => r.json()).then(d => setCustomers(d.customers ?? []))
  }, [open])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query)
  )

  async function createAndSelect() {
    if (!name.trim()) return
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, type: 'walk_in' }),
    })
    const d = await res.json()
    if (res.ok) onSelect(d.customer.id, credit ? 'credit' : 'cash')
  }

  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl p-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Add customer</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">✕</button>
        </div>
        <button onClick={() => setCredit(!credit)}
          className="flex items-center gap-2 mb-3 text-sm text-gray-700 self-start">
          <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${credit ? 'bg-slate-800 justify-end' : 'bg-gray-200 justify-start'}`}>
            <div className="w-5 h-5 rounded-full bg-white shadow" />
          </div>
          On credit (pay later)
        </button>
        {!creating ? (
          <>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customers..."
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <div className="flex-1 overflow-y-auto">
              {filtered.map(c => (
                <button key={c.id} onClick={() => onSelect(c.id, credit ? 'credit' : 'cash')}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                </button>
              ))}
              <button onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-700 font-medium">+ New customer</button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" type="tel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm">Back</button>
              <button onClick={createAndSelect} className="flex-1 bg-slate-800 text-white rounded-lg py-2.5 text-sm font-medium">Save & select</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/entry/CustomerSheet.tsx
git commit -m "feat: add CustomerSheet bottom sheet component"
```

---

### Task 13: QuickEntry component

**Files:** Create `components/entry/QuickEntry.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: components/entry/QuickEntry.tsx
 * WHAT THIS DOES: Full-width list of frequent products. Type pill at top
 *   (Sale/Purchase/Expense). +/- buttons. Running total. Save button.
 *   Optional customer attachment via CustomerSheet.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Default mode on /entry page.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/entry/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import type { Product, TransactionType, PaymentMethod } from '@/types'
import { CustomerSheet } from './CustomerSheet'

interface LineItem { productId: string; productName: string; unitPrice: number; quantity: number }
interface Props { onSaved: () => void; onSwitchFull: (items: LineItem[]) => void }

export function QuickEntry({ onSaved, onSwitchFull }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [type, setType] = useState<TransactionType>('sale')
  const [qtys, setQtys] = useState<Map<string, number>>(new Map())
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [showCustomer, setShowCustomer] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  function getPrice(p: Product) { return type === 'sale' ? Number(p.sellingPrice) : Number(p.purchasePrice) }
  function adj(pid: string, d: number) {
    setQtys(prev => { const n = new Map(prev); const q = (n.get(pid) ?? 0) + d; q <= 0 ? n.delete(pid) : n.set(pid, q); return n })
  }

  const total = products.reduce((s, p) => s + (qtys.get(p.id) ?? 0) * getPrice(p), 0)
  const itemCount = qtys.size

  async function handleSave() {
    if (itemCount === 0) return
    setSaving(true)
    await fetch('/api/entry/quick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, paymentMethod, customerId,
        items: Array.from(qtys.entries()).map(([productId, quantity]) => ({ productId, quantity })),
      }),
    })
    setSaving(false); onSaved()
  }

  function buildLineItems(): LineItem[] {
    return Array.from(qtys.entries()).map(([pid, qty]) => {
      const p = products.find(x => x.id === pid)!
      return { productId: pid, productName: p.name, unitPrice: getPrice(p), quantity: qty }
    })
  }

  const sorted = [...products].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) || a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-slate-900 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} added</p>
          <p className="text-xl font-bold text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-lg p-1">
          {(['sale', 'purchase', 'expense'] as TransactionType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-2 py-1 rounded transition-colors ${type === t ? 'bg-white text-slate-900 font-semibold' : 'text-slate-400'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-2">
        {products.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-gray-400">No products yet — add some in Settings</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {sorted.map(p => {
              const qty = qtys.get(p.id) ?? 0
              const price = getPrice(p)
              return (
                <div key={p.id} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">₹{price} each</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => adj(p.id, -1)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${qty === 0 ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>−</button>
                    <span className={`text-sm font-bold min-w-[20px] text-center ${qty === 0 ? 'text-gray-300' : 'text-gray-900'}`}>{qty}</span>
                    <button onClick={() => adj(p.id, 1)}
                      className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm hover:bg-slate-700">+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        {type === 'sale' && (
          <button onClick={() => setShowCustomer(true)} className="w-full text-sm text-slate-600 py-1">
            {customerId ? '✓ Customer added' : '+ Add customer (optional)'}
          </button>
        )}
        <button onClick={handleSave} disabled={saving || itemCount === 0}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60 hover:bg-green-700">
          {saving ? 'Saving...' : `Save ${type} · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <button onClick={() => onSwitchFull(buildLineItems())} className="w-full text-center text-xs text-gray-400 py-1">Switch to full entry</button>
      </div>

      <CustomerSheet open={showCustomer} onClose={() => setShowCustomer(false)}
        onSelect={(id, pm) => { setCustomerId(id); setPaymentMethod(pm); setShowCustomer(false) }} />
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/entry/QuickEntry.tsx
git commit -m "feat: add QuickEntry component"
```

---

### Task 14: FullEntryForm component

**Files:** Create `components/entry/FullEntryForm.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: components/entry/FullEntryForm.tsx
 * WHAT THIS DOES: Full transaction form. Product search, quantity stepper,
 *   price override, date picker, customer/vendor, payment method, notes.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: "Full entry" mode on /entry page.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/entry/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import type { Product, TransactionType, PaymentMethod, FullEntryItem } from '@/types'
import { ProductSearch } from './ProductSearch'
import { CustomerSheet } from './CustomerSheet'

interface LineItem extends FullEntryItem { productName: string }
interface Props { initialItems?: LineItem[]; onSaved: () => void; onSwitchQuick: () => void }

export function FullEntryForm({ initialItems, onSaved, onSwitchQuick }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [items, setItems] = useState<LineItem[]>(initialItems ?? [])
  const [type, setType] = useState<TransactionType>('sale')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [vendorName, setVendorName] = useState('')
  const [notes, setNotes] = useState('')
  const [showCustomer, setShowCustomer] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch('/api/products').then(r => r.json()).then(d => setProducts(d.products ?? [])) }, [])

  function addProduct(p: Product) {
    const price = type === 'sale' ? Number(p.sellingPrice) : Number(p.purchasePrice)
    setItems(prev => {
      const existing = prev.findIndex(i => i.productId === p.id)
      if (existing >= 0) return prev.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: p.id, productName: p.name, quantity: 1, unitPrice: price }]
    })
  }

  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateQty(i: number, qty: number) { if (qty <= 0) removeItem(i); else setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: qty } : it)) }
  function updatePrice(i: number, price: number) { setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unitPrice: price } : it)) }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  async function handleSave() {
    if (!items.length) return
    setSaving(true)
    await fetch('/api/entry/full', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, type, paymentMethod, customerId, vendorName: vendorName || undefined, notes: notes || undefined, items }),
    })
    setSaving(false); onSaved()
  }

  const pmOptions: PaymentMethod[] = ['cash', 'upi', 'credit']

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-slate-900 px-4 py-3">
        <p className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        <p className="text-xl font-bold text-white">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
      </div>

      <div className="flex-1 px-4 py-3 space-y-3">
        {/* Type + date */}
        <div className="flex gap-2">
          <select value={type} onChange={e => setType(e.target.value as TransactionType)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
        </div>

        {/* Product search */}
        <ProductSearch products={products} onSelect={addProduct} placeholder="Add product..." />

        {/* Item list */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {items.map((item, i) => (
              <div key={i} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQty(i, item.quantity - 1)} className="w-6 h-6 rounded-full bg-gray-100 text-sm text-gray-600 flex items-center justify-center">−</button>
                    <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(i, item.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-100 text-sm text-gray-600 flex items-center justify-center">+</button>
                    <span className="text-xs text-gray-400 ml-1">× ₹</span>
                    <input type="number" value={item.unitPrice} onChange={e => updatePrice(i, Number(e.target.value))}
                      className="w-20 border-b border-gray-200 text-sm text-gray-900 focus:outline-none px-1" />
                  </div>
                </div>
                <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Vendor / customer */}
        {type === 'purchase' || type === 'expense'
          ? <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name (optional)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
          : <button onClick={() => setShowCustomer(true)} className="w-full text-left text-sm text-slate-600 border border-gray-200 rounded-lg px-3 py-2 bg-white">
              {customerId ? '✓ Customer selected' : '+ Add customer (optional)'}
            </button>
        }

        {/* Payment method */}
        <div className="flex gap-2">
          {pmOptions.map(pm => (
            <button key={pm} onClick={() => setPaymentMethod(pm)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${paymentMethod === pm ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200'}`}>
              {pm.charAt(0).toUpperCase() + pm.slice(1)}
            </button>
          ))}
        </div>

        {/* Notes */}
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none" />
      </div>

      <div className="sticky bottom-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100 space-y-2">
        <button onClick={handleSave} disabled={saving || items.length === 0}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-60">
          {saving ? 'Saving...' : `Save ${type} · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
        </button>
        <button onClick={onSwitchQuick} className="w-full text-center text-xs text-gray-400 py-1">Switch to quick entry</button>
      </div>

      <CustomerSheet open={showCustomer} onClose={() => setShowCustomer(false)}
        onSelect={(id, pm) => { setCustomerId(id); setPaymentMethod(pm); setShowCustomer(false) }} />
    </div>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/entry/FullEntryForm.tsx
git commit -m "feat: add FullEntryForm component"
```

---

### Task 15: Entry page

**Files:** Create `app/(dashboard)/entry/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
/**
 * FILE: app/(dashboard)/entry/page.tsx
 * WHAT THIS DOES: Wraps QuickEntry and FullEntryForm. mode=quick (default)
 *   or mode=full (via query param). Handles save → dashboard redirect.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Route /entry.
 * CALLED BY / IMPORTS FROM: BottomNav, scan page "edit all" link
 */
'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QuickEntry } from '@/components/entry/QuickEntry'
import { FullEntryForm } from '@/components/entry/FullEntryForm'

interface LineItem { productId: string; productName: string; unitPrice: number; quantity: number }

export default function EntryPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<'quick' | 'full'>(params.get('mode') === 'full' ? 'full' : 'quick')
  const [transferItems, setTransferItems] = useState<LineItem[]>([])

  function handleSaved() { router.push('/dashboard'); router.refresh() }

  function switchToFull(items: LineItem[]) { setTransferItems(items); setMode('full') }
  function switchToQuick() { setTransferItems([]); setMode('quick') }

  if (mode === 'full')
    return <FullEntryForm initialItems={transferItems} onSaved={handleSaved} onSwitchQuick={switchToQuick} />
  return <QuickEntry onSaved={handleSaved} onSwitchFull={switchToFull} />
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add "app/(dashboard)/entry/page.tsx"
git commit -m "feat: add entry page (quick/full mode toggle)"
```

---

### Task 16: Customer API routes

**Files:** Create `app/api/customers/route.ts`, `app/api/customers/[id]/route.ts`

- [ ] **Step 1: Create `app/api/customers/route.ts`**

```typescript
/**
 * FILE: app/api/customers/route.ts
 * WHAT THIS DOES: GET — list all customers for the store.
 *   POST — create a new customer.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Called by CustomerSheet, customers page.
 * CALLED BY / IMPORTS FROM: components/entry/CustomerSheet.tsx,
 *   app/(dashboard)/customers/page.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, type, credit_limit, current_balance, notes, created_at')
    .eq('store_id', store.id)
    .order('name')

  return NextResponse.json({ customers: customers ?? [] })
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body: { name: string; phone?: string; type?: string; creditLimit?: number; notes?: string } = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: customer, error } = await supabase.from('customers').insert({
    store_id: store.id, name: body.name.trim(),
    phone: body.phone ?? null, type: body.type ?? 'walk_in',
    credit_limit: body.creditLimit ?? 0, current_balance: 0,
    notes: body.notes ?? null,
  }).select('id, name, phone, type, current_balance').single()

  if (error) return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
  return NextResponse.json({ customer }, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/customers/[id]/route.ts`**

```typescript
/**
 * FILE: app/api/customers/[id]/route.ts
 * WHAT THIS DOES: GET — customer detail with last 50 transactions.
 *   PATCH — update customer fields.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Called by CustomerLedger component.
 * CALLED BY / IMPORTS FROM: components/customers/CustomerLedger.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, type, credit_limit, current_balance, notes, created_at')
    .eq('id', params.id).eq('store_id', store.id).single()
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, date, type, total_amount, payment_method, source, created_at')
    .eq('customer_id', params.id).eq('store_id', store.id)
    .order('created_at', { ascending: false }).limit(50)

  return NextResponse.json({ customer, transactions: transactions ?? [] })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (body.name) allowed.name = body.name
  if (body.phone !== undefined) allowed.phone = body.phone
  if (body.type) allowed.type = body.type
  if (body.creditLimit !== undefined) allowed.credit_limit = body.creditLimit
  if (body.notes !== undefined) allowed.notes = body.notes

  const { data: customer, error } = await supabase.from('customers')
    .update(allowed).eq('id', params.id).eq('store_id', store.id)
    .select('id, name').single()
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ customer })
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add app/api/customers/route.ts "app/api/customers/[id]/route.ts"
git commit -m "feat: add /api/customers GET/POST and /api/customers/[id] GET/PATCH"
```

---

### Task 17: Customer components + page + BottomNav + layout update

**Files:** `components/customers/CreditBadge.tsx`, `components/customers/CustomerLedger.tsx`, `app/(dashboard)/customers/page.tsx`, `components/shared/BottomNav.tsx`, `app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `components/customers/CreditBadge.tsx`**

```typescript
/**
 * FILE: components/customers/CreditBadge.tsx
 * WHAT THIS DOES: Balance badge — green when zero/credit, red when owes.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Customer list cards and customer ledger header.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/customers/page.tsx
 */
interface Props { balance: number }
export function CreditBadge({ balance }: Props) {
  const fmt = Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (balance <= 0) return <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">₹{fmt} credit</span>
  return <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">₹{fmt} owes</span>
}
```

- [ ] **Step 2: Create `components/customers/CustomerLedger.tsx`**

```typescript
/**
 * FILE: components/customers/CustomerLedger.tsx
 * WHAT THIS DOES: Per-customer transaction list. Fetches from /api/customers/[id].
 *   Shows transactions in chronological order with running balance.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Opened by tapping a customer in the customers page.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/customers/page.tsx
 */
'use client'
import { useState, useEffect } from 'react'
import { CreditBadge } from './CreditBadge'

interface Tx { id: string; date: string; type: string; total_amount: number; payment_method: string; created_at: string }
interface CustomerDetail { id: string; name: string; phone?: string; type: string; current_balance: number }

interface Props { customerId: string; onBack: () => void }

export function CustomerLedger({ customerId, onBack }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/customers/${customerId}`)
      .then(r => r.json())
      .then(d => { setCustomer(d.customer); setTransactions(d.transactions ?? []); setLoading(false) })
  }, [customerId])

  if (loading) return <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700" /></div>
  if (!customer) return null

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <button onClick={onBack} className="text-sm text-slate-600 mb-2">← Back</button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{customer.name}</h2>
            {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
          </div>
          <CreditBadge balance={customer.current_balance} />
        </div>
      </div>

      <div className="flex-1 px-4 py-3">
        {transactions.length === 0 ? (
          <div className="flex items-center justify-center py-16"><p className="text-sm text-gray-400">No transactions yet</p></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center px-3 py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 capitalize">{tx.type}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })} · {tx.payment_method}</p>
                </div>
                <p className={`text-sm font-semibold ${tx.type === 'sale' ? 'text-green-700' : 'text-gray-900'}`}>
                  {tx.type === 'sale' ? '+' : '−'}₹{Number(tx.total_amount).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(dashboard)/customers/page.tsx`**

```typescript
/**
 * FILE: app/(dashboard)/customers/page.tsx
 * WHAT THIS DOES: Searchable customer list. Tap to open ledger.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Route /customers.
 * CALLED BY / IMPORTS FROM: BottomNav
 */
'use client'
import { useState, useEffect } from 'react'
import type { Customer } from '@/types'
import { CreditBadge } from '@/components/customers/CreditBadge'
import { CustomerLedger } from '@/components/customers/CustomerLedger'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json())
      .then(d => { setCustomers(d.customers ?? []); setLoading(false) })
  }, [])

  if (selected) return <CustomerLedger customerId={selected} onBack={() => setSelected(null)} />

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query)
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Customers</h1>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or phone..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
      </div>
      <div className="flex-1 px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-700" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-gray-900">No customers yet</p>
            <p className="text-sm text-gray-400 mt-1">Customers are added when you record a transaction</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)}
                className="w-full text-left flex items-center px-3 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                </div>
                <CreditBadge balance={c.currentBalance} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/shared/BottomNav.tsx`**

```typescript
/**
 * FILE: components/shared/BottomNav.tsx
 * WHAT THIS DOES: Fixed bottom navigation bar. 5 items: Home, Scan, Entry, Stock, Customers.
 *   Active item highlighted based on current pathname.
 * CHANGES THIS SESSION: Initial creation
 * WHERE IT FITS: Mounted in the dashboard layout, visible on all dashboard routes.
 * CALLED BY / IMPORTS FROM: app/(dashboard)/layout.tsx
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/scan', label: 'Scan', icon: '📷' },
  { href: '/entry', label: 'Entry', icon: '✏️' },
  { href: '/inventory', label: 'Stock', icon: '📦' },
  { href: '/customers', label: 'Customers', icon: '👥' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-area-inset-bottom">
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${active ? 'text-slate-900 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}>
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 5: Update `app/(dashboard)/layout.tsx` — add BottomNav**

Open `app/(dashboard)/layout.tsx`. Replace the `return <>{children}</>` line with:

```typescript
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-16">{children}</main>
      <BottomNav />
    </div>
  )
```

Also add the import at the top of the file (after the existing imports):

```typescript
import { BottomNav } from '@/components/shared/BottomNav'
```

- [ ] **Step 6: Verify and commit**

```bash
npx tsc --noEmit
git add components/customers/ components/shared/BottomNav.tsx "app/(dashboard)/customers/page.tsx" "app/(dashboard)/layout.tsx"
git commit -m "feat: add customer components, customers page, BottomNav, and dashboard layout update"
```

---

## Self-Review

**Spec coverage check:**
- [x] 2a Bill scanning — Tasks 2, 4, 6, 7, 8, 9
- [x] 2b Confirm UX (single + ledger) — Tasks 7, 8, 9
- [x] 2c Manual entry (quick + full) — Tasks 10, 11, 12, 13, 14, 15
- [x] 2d Customer management — Tasks 16, 17
- [x] 2e Inventory auto-update — Tasks 3, 5, 10
- [x] Correction learning — Task 5
- [x] Duplicate detection — Task 4
- [x] MIME + size validation — Task 4
- [x] Storage RLS (already in 001_rls_policies.sql) — Pre-condition
- [x] Customer balance update on credit sale — Tasks 10 (quick) and 14 (full)
- [x] BottomNav wiring — Task 17

**Placeholder scan:** None found.

**Type consistency:**
- `ExtractionItem`, `ExtractionResult` defined in Task 1, used in Tasks 5, 7, 8, 9 ✓
- `QuickEntryPayload`, `FullEntryPayload` defined in Task 1, used in Tasks 10, 13, 14 ✓
- `updateStock` defined in Task 3, used in Tasks 5, 10 ✓
- `StockMovementType` defined in Task 1, used in Task 3 ✓

---

## Phase 2 Done Criteria

| Check | How to verify |
|---|---|
| Bill scan — happy path | Upload photo → confirm screen ≤15s |
| Bill scan — low confidence | Amber rows shown, yellow banner visible |
| Bill scan — new product | Red sub-text shown; is_active=false product created on confirm |
| Duplicate detection | Same vendor + amount within 24h shows orange banner |
| Quick entry | Tap + 3× on product → save → `inventory.current_stock` decreased |
| Quick entry — purchase | `current_stock` increases, stock_movements row has type='purchase' |
| Credit sale | `customers.current_balance` increases after save |
| Customer inline | Add new customer via sheet → appears in /customers list |
| Full entry — past date | Transaction date = selected date, not today |
| Correction learning | Edit item qty → `extraction_corrections` row written |
| Auth — all routes | All /api/scan, /api/entry/*, /api/customers/* return 401 without session |
| MIME check | .exe file returns 400 |
| Size check | 11MB image returns 400 |
| Store scope | User A cannot access User B's transactions |
| TypeScript | `npx tsc --noEmit` → 0 errors |

