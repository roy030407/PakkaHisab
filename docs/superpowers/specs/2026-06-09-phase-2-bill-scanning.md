# Phase 2 — Bill Scanning and Transaction Entry
# PakkaHisab Design Spec
# Date: 2026-06-09

---

## Scope

Phase 2 delivers the core daily loop: a merchant can scan a bill, review the extracted
items, confirm, and have inventory update automatically. They can also enter transactions
manually (quick or full mode) and manage customers with running balances.

Covers: 2a (bill scanning), 2b (confirm UX), 2c (manual entry), 2d (customer management),
2e (inventory auto-update).

---

## Visual Decisions (locked)

| Question | Choice | Description |
|---|---|---|
| Scan upload UI | B — Source selector grid | Camera / Gallery / File as 3 equal tiles (2+1 grid) |
| Confirm screen | B — Dark sticky header | Vendor + total pinned in dark bar; items scroll below; amber = low confidence; red outline = not in catalog |
| Quick entry | B — Full-width list rows | Product name left, `+` button far right; dimmed `−` and `0` until quantity is added |
| Extraction pipeline | A — Synchronous | Upload → spinner with live sub-messages → confirm screen; no background jobs for v1 |

---

## 1. Bill Scanning Pipeline (2a)

### Upload screen (`/app/(dashboard)/scan/page.tsx`)

Three source options displayed as a 2+1 grid:
- **Camera** — opens device camera
- **Gallery** — opens photo picker
- **File** — opens file picker (PDF or image)

On selection the file is compressed client-side to ≤2MB using `browser-image-compression`
before upload. The page immediately transitions to the loading state.

### Loading state

Full-screen spinner with a status line that updates as the pipeline progresses:
- "Uploading your bill..."
- "Reading your bill..."
- "Finding your products..."

No background jobs. The user waits on this screen. Acceptable wait: 5–15 seconds.

### Server-side extraction pipeline (`POST /api/scan`)

Steps executed in order on the server:

1. **Auth check** — 401 if no valid session
2. **MIME validation** — accept only `image/jpeg`, `image/png`, `image/webp`, `application/pdf`; reject with 400 otherwise
3. **Size check** — reject files >10MB with 400
4. **Upload** — store at `documents/{user_id}/{uuid}.{ext}` in the private Supabase `documents` bucket
5. **Write `document_uploads` row** — status `pending`
6. **Fetch store's top-20 frequent products** — by transaction count in last 7 days
7. **Fetch last 5 `extraction_corrections`** — for this store, most recent first
8. **Build Claude Vision prompt** — see Prompt Spec below
9. **Call `claude-sonnet-4-20250514`** — synchronous, no streaming
10. **Parse JSON response** — if parsing fails, return 422 with `{ error: "extraction_failed" }`
11. **Fuzzy-match each line item** — against store product catalog; exact match first, then fuzzy
12. **Flag unmatched items** — `needs_catalog_add: true`
13. **Duplicate detection** — query `transactions` for same store_id, same vendor_name, same total_amount, within 24 hours. If found, set `duplicate_warning: { date, id }` in response.
14. **Update `document_uploads` row** — status `extracted`, store raw JSON
15. **Return structured result** to client

### Extraction prompt spec

The prompt sent to Claude must include:
- System instruction: return ONLY valid JSON, no preamble, no markdown
- 3 few-shot examples of correctly extracted Indian bills (from `bill_examples` table, filtered by detected document type)
- Last 5 extraction corrections for this store, formatted as:
  `"In a previous scan for this store, '[original]' was corrected to '[corrected]'."`
- Top 20 frequent products for this store (id, name, unit) for catalog matching
- The bill image (base64 or signed URL)

Claude must return:
```json
{
  "document_type": "single_bill | ledger_page",
  "vendor_name": "string | null",
  "date": "YYYY-MM-DD | null",
  "total_amount": number | null,
  "confidence": "high | medium | low",
  "items": [
    {
      "product_name_raw": "string",
      "matched_product_id": "uuid | null",
      "matched_product_name": "string | null",
      "needs_catalog_add": boolean,
      "quantity": number,
      "unit_price": number,
      "total_price": number,
      "tax_rate": number | null,
      "field_confidence": {
        "quantity": "high | medium | low",
        "unit_price": "high | medium | low",
        "total_price": "high | medium | low"
      }
    }
  ]
}
```

For `ledger_page`, `items` is replaced with `transactions: [...]` — an array of
transaction objects each with the same structure as a single bill.

---

## 2. Confirm Screen (2b)

### Single bill confirm

**Header (dark, sticky):**
- Vendor name + date (sub-text, muted)
- Total amount (large, white)
- "Edit" ghost button (for post-save edits, opens full form)

**Items list (scrollable):**
Each row: `[product name] [−] [qty] [+] [unit price]`
- If matched to catalog: show catalog name, not raw extracted name
- If `field_confidence` is `medium` or `low`: amber row background, "⚠ please check" sub-text
- If `needs_catalog_add: true`: red sub-text "Not in catalog — will be added as new product"
- `+` and `−` buttons adjust quantity inline; total updates in real time

**Low-confidence banner (yellow, above items):**
Shown if overall `confidence` is `medium` or `low`.
Text: "Some fields may be incorrect — review before saving."

**Footer:**
- "Save purchase · ₹X,XXX" — green primary button (or "Save sale" depending on type)
- "Edit all details" text link — navigates to full entry form pre-populated

### Ledger page confirm

Shown when `document_type === "ledger_page"`.

Scrollable checklist of rows. Each row:
`[checkbox] [date] [party] [amount] [type badge]`
- All rows checked by default
- Unchecked rows excluded from save
- Tap any field to edit inline
- Bottom: "Save X transactions" button

### On confirm (`POST /api/scan/confirm`)

Writes in a single DB transaction:
1. One `transactions` row
2. N `transaction_items` rows (one per line item)
3. N `stock_movements` rows
4. Upserts `inventory` (current_stock delta)
5. For each field the merchant edited: writes to `extraction_corrections`
6. Updates `document_uploads.extraction_status` to `confirmed`

For new-product items (`needs_catalog_add: true`):
Creates a `products` row with `is_active: false`, `item_number` auto-assigned.
The merchant can activate and fill in pricing from `/products` later.

---

## 3. Manual Transaction Entry (2c)

### Entry page (`/app/(dashboard)/entry/page.tsx`)

Opens in Quick mode. Type pill at top: **Sale** | **Purchase** | **Expense** — defaults to Sale.

### Quick mode

**Type pill** — switching type updates:
- Price shown per product (selling_price for Sale, purchase_price for Purchase)
- Save button label ("Save sale" / "Save purchase" / "Save expense")

**Product list** — full-width rows (B layout):
- Frequent products (last 7 days) at top, then alphabetical
- Each row: product name (left), price (sub-text), `−` / qty / `+` (right)
- Dimmed `−` and greyed `0` when nothing added yet
- Running total in sticky dark bar at top

**Customer attachment (optional):**
Below the running total: "+ Add customer" link.
Opens a bottom sheet (not modal) with:
- Search existing customers by name or phone
- "New customer" if no match — name + phone fields
- "On credit" toggle — sets payment_method to `credit`

**Save:** calls `POST /api/entry/quick`

**"Switch to full entry"** link at bottom — navigates to full form with current items pre-filled.

### Full mode

Form fields:
- Date (date picker, defaults today)
- Type (sale / purchase / expense / income)
- Product search — fuzzy, by name / item number / brand; shows variant selector if product has variants
- Quantity (number input with `+`/`−` stepper)
- Price override (optional, pre-fills from product)
- Customer (sale) or Vendor name (purchase) — typeahead search
- Payment method: Cash / UPI / Credit (segmented control)
- Notes (optional text field)

Calls `POST /api/entry/full`.

---

## 4. Customer Management (2d)

### Customers page (`/app/(dashboard)/customers/page.tsx`)

Searchable list. Each customer card:
- Name, phone (if set)
- Balance badge: green (credit/zero), red (owes money)
- Type badge: walk-in / regular / wholesale

**Customer ledger (tap to open):**
- All transactions for this customer, chronological
- Running balance column
- Read-only in Phase 2
- Balance updates automatically as transactions are saved/deleted

### Customer creation

Inline during transaction entry (bottom sheet) or from the customers page (full form).
Fields: name, phone (optional), type (walk-in default), credit_limit (optional).

### Balance calculation

Derived at query time, not stored. The `GET /api/customers` endpoint calculates:
`current_balance = SUM(amount WHERE type='sale' AND payment_method='credit') - SUM(payments)`

For Phase 2, payments are tracked as `income` transactions linked to the customer.

---

## 5. Inventory Auto-Update (2e)

No separate UI. Happens inside the confirm and entry API routes.

**On purchase confirm:**
```
stock_movements INSERT: { type: 'purchase', quantity: +N, product_id, transaction_id }
inventory UPSERT: current_stock += N, last_restocked_at = NOW()
```

**On sale confirm:**
```
stock_movements INSERT: { type: 'sale', quantity: -N, product_id, transaction_id }
inventory UPDATE: current_stock -= N
```

Stock cannot go negative in the UI — if a sale would exceed current stock, show a warning:
"Only X in stock. Continue anyway?" with a confirm option (some merchants sell on pre-order).

Shared helper: `lib/inventory/updateStock(storeId, productId, delta, transactionId, movementType)`.

---

## 6. New Types (`types/index.ts` additions)

```typescript
export type ConfidenceLevel = "high" | "medium" | "low"
export type DocumentType = "single_bill" | "ledger_page"
export type StockMovementType = "purchase" | "sale" | "adjustment" | "waste"
export type ExtractionStatus = "pending" | "extracted" | "confirmed" | "failed"

export interface ExtractionItem {
  productNameRaw: string
  matchedProductId?: string
  matchedProductName?: string
  needsCatalogAdd: boolean
  quantity: number
  unitPrice: number
  totalPrice: number
  taxRate?: number
  fieldConfidence: Record<"quantity" | "unitPrice" | "totalPrice", ConfidenceLevel>
}

export interface ExtractionResult {
  documentType: DocumentType
  vendorName?: string
  date?: string
  totalAmount?: number
  confidence: ConfidenceLevel
  items: ExtractionItem[]
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
```

---

## 7. New Components

```
/components/scan/
  ScanUpload.tsx           — source selector grid (Camera / Gallery / File)
  ScanLoading.tsx          — spinner with live sub-messages
  ExtractionReview.tsx     — single bill confirm screen
  LedgerReview.tsx         — ledger page checklist confirm
  ConfidenceBadge.tsx      — amber/red inline indicator
  DuplicateWarning.tsx     — "looks like it was already added" banner

/components/entry/
  QuickEntry.tsx           — full-width list rows with running total
  FullEntryForm.tsx        — full transaction form
  ProductSearch.tsx        — fuzzy search with item numbers
  VariantSelector.tsx      — dropdown for product variants
  CustomerSheet.tsx        — bottom sheet for customer attach

/components/customers/
  CustomerLedger.tsx       — per-customer transaction list + balance
  CreditBadge.tsx          — balance indicator badge
```

---

## 8. New API Routes

| Route | Method | Description |
|---|---|---|
| `/api/scan` | POST | Upload + extract (synchronous) |
| `/api/scan/confirm` | POST | Save confirmed extraction |
| `/api/entry/quick` | POST | Quick mode transaction save |
| `/api/entry/full` | POST | Full form transaction save |
| `/api/customers` | GET | List customers with balances |
| `/api/customers` | POST | Create customer |
| `/api/customers/[id]` | GET | Customer detail + ledger |
| `/api/customers/[id]` | PATCH | Update customer |

All routes: 401 if no session. All queries scoped to store_id.

---

## 9. Manual Supabase Steps (before coding)

1. Create a private `documents` bucket in Supabase Storage dashboard.
2. Apply `supabase/migrations/002_storage_rls.sql`:
```sql
CREATE POLICY "user_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]);
```
3. Add `ANTHROPIC_API_KEY` to `.env.local` (server-only, never NEXT_PUBLIC_).

---

## 10. New npm Dependencies

```
browser-image-compression   — client-side image compression before upload
@anthropic-ai/sdk           — already installed (Phase 1)
```

---

## 11. Phase 2 "Done" Criteria

| Check | Pass criteria |
|---|---|
| Bill scan — happy path | Upload photo → extracted items on confirm screen ≤15s |
| Bill scan — low confidence | Amber rows shown, yellow banner visible |
| Bill scan — new product | Red "not in catalog" shown; product created on confirm |
| Duplicate detection | Same vendor + amount within 24h shows warning |
| Quick entry | Tap `+` 3 times on product → save → inventory decremented by 3 |
| Quick entry — sale type | Selling price shown; transaction type = sale |
| Quick entry — purchase type | Purchase price shown; transaction type = purchase |
| Customer inline | Add customer during quick entry → balance updates after save |
| Credit sale | Payment method = credit → shows in customer balance |
| Full entry | Past-date transaction saves with correct date |
| Correction learning | Edit extracted field → correction row written to DB |
| Security — auth | All API routes return 401 without session |
| Security — MIME | .exe upload rejected with 400 |
| Security — size | 11MB image rejected with 400 |
| Security — store scope | User A cannot see User B's transactions |
| TypeScript | `npx tsc --noEmit` passes |
