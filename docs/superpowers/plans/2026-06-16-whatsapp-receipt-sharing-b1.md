# Slice B1 - WhatsApp Receipt Sharing (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shopkeeper share a plain-text WhatsApp receipt of a sale in one tap, from the manual-sale save screens and from the customer ledger, with a clipboard fallback when there is no phone.

**Architecture:** A pure `buildReceiptText` helper (unit-tested) formats the receipt. A new `GET /api/transactions/[id]` returns the transaction + its items + the customer (phone/balance). A single `ShareReceiptButton` fetches that by id, builds the text, then opens a prefilled `wa.me` link (reusing Slice A's `buildWhatsappUrl`) or copies to the clipboard when there is no usable phone. It is wired into QuickEntry, FullEntryForm, and CustomerLedger for sale transactions only.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (PostgREST + RLS), Vitest, Tailwind, sonner (toasts, already used).

**Spec:** `docs/superpowers/specs/2026-06-15-whatsapp-receipt-sharing-design.md` (Phase B1).

**Conventions (CLAUDE.md):** no em dashes; interactive elements use `.btn-lift` + pointer cursor; every touched file gets/updates its file comment block; never `SELECT *`; scope every query to `store_id`. The `₹` rupee sign is allowed and expected in receipt text. Do not run `git commit` during execution - the user commits manually on request (keep the commit steps in this plan for reference).

---

## File Structure

**New files**
- `lib/share/receipt.ts` - `ReceiptInput`/`ReceiptItem` types + `buildReceiptText` (pure).
- `lib/share/receipt.test.ts` - vitest unit tests.
- `components/share/ShareReceiptButton.tsx` - fetch-by-id + wa.me/clipboard share button.

**Modified files**
- `app/api/transactions/[id]/route.ts` - add a `GET` handler (currently DELETE-only).
- `components/entry/QuickEntry.tsx` - capture `transactionId`; post-sale success state with the share button.
- `components/entry/FullEntryForm.tsx` - same, plus fetch the store name.
- `components/customers/CustomerLedger.tsx` - compact share button on sale rows.

---

## Task 1: `buildReceiptText` pure helper + tests

**Files:**
- Create: `lib/share/receipt.ts`
- Test: `lib/share/receipt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/share/receipt.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildReceiptText } from './receipt'

describe('buildReceiptText', () => {
  it('formats an itemised cash sale', () => {
    const out = buildReceiptText({
      shopName: 'Sharma Stores',
      date: '2026-06-15',
      items: [
        { name: 'Thums Up 500ml', quantity: 2, lineTotal: 60 },
        { name: 'Parle-G', quantity: 1, lineTotal: 10 },
      ],
      total: 70,
      paymentMethod: 'cash',
    })
    expect(out).toBe(
      [
        'Sharma Stores',
        '15 Jun 2026',
        '--------------------',
        '2 x Thums Up 500ml - ₹60',
        '1 x Parle-G - ₹10',
        '--------------------',
        'Total: ₹70',
        'Paid: ₹70 (cash)',
        '',
        'Dhanyavaad! - Sharma Stores',
      ].join('\n')
    )
  })

  it('formats a credit sale with an Udhaar line and a balance line', () => {
    const out = buildReceiptText({
      shopName: 'My Shop',
      date: '2026-06-15',
      items: [{ name: 'Rice 5kg', quantity: 1, lineTotal: 300 }],
      total: 300,
      paymentMethod: 'credit',
      customerName: 'Ramesh',
      balanceAfter: 800,
    })
    expect(out).toBe(
      [
        'My Shop',
        '15 Jun 2026',
        '--------------------',
        '1 x Rice 5kg - ₹300',
        '--------------------',
        'Total: ₹300',
        'Udhaar: ₹300',
        'Balance: ₹800',
        '',
        'Dhanyavaad! - My Shop',
      ].join('\n')
    )
  })

  it('omits the item block when there are no items', () => {
    const out = buildReceiptText({
      shopName: 'S',
      date: '2026-06-15',
      items: [],
      total: 50,
      paymentMethod: 'upi',
    })
    expect(out).toBe(
      ['S', '15 Jun 2026', 'Total: ₹50', 'Paid: ₹50 (upi)', '', 'Dhanyavaad! - S'].join('\n')
    )
  })

  it('groups large amounts the Indian way', () => {
    const out = buildReceiptText({
      shopName: 'S',
      date: '2026-06-15',
      items: [{ name: 'TV', quantity: 1, lineTotal: 150000 }],
      total: 150000,
      paymentMethod: 'cash',
    })
    expect(out).toContain('1 x TV - ₹1,50,000')
    expect(out).toContain('Total: ₹1,50,000')
  })

  it('parses an ISO timestamp date and renders DD Mon YYYY', () => {
    const out = buildReceiptText({
      shopName: 'S', date: '2026-01-09T10:00:00Z', items: [], total: 5, paymentMethod: 'cash',
    })
    expect(out.split('\n')[1]).toBe('9 Jan 2026')
  })

  it('renders an empty date line for a malformed date', () => {
    const out = buildReceiptText({
      shopName: 'S', date: 'not-a-date', items: [], total: 5, paymentMethod: 'cash',
    })
    expect(out.split('\n')[1]).toBe('')
  })

  it('omits the balance line when balanceAfter is null or missing', () => {
    const out = buildReceiptText({
      shopName: 'S', date: '2026-06-15', items: [], total: 5, paymentMethod: 'credit',
    })
    expect(out).not.toContain('Balance:')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/share/receipt.test.ts`
Expected: FAIL with "Failed to resolve import './receipt'".

- [ ] **Step 3: Write the implementation**

Create `lib/share/receipt.ts`:

```typescript
/**
 * FILE: lib/share/receipt.ts
 *
 * WHAT THIS DOES:
 *   Pure helper that turns a sale (shop, date, items, total, payment, optional
 *   customer balance) into a plain-text WhatsApp receipt. No DB, no I/O, so the
 *   formatting is unit-tested in isolation. Deterministic date/amount formatting
 *   (fixed month names + en-IN grouping) keeps tests environment-stable.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice B1 receipt sharing)
 *
 * WHERE IT FITS:
 *   Used by components/share/ShareReceiptButton.tsx to build the message that is
 *   pre-filled into a wa.me link (or copied to the clipboard).
 *
 * CALLED BY / IMPORTS FROM:
 *   components/share/ShareReceiptButton.tsx
 */

export interface ReceiptItem {
  name: string
  quantity: number
  lineTotal: number
}

export interface ReceiptInput {
  shopName: string
  date: string // ISO timestamp or YYYY-MM-DD
  items: ReceiptItem[]
  total: number
  paymentMethod: string // 'cash' | 'upi' | 'credit'
  balanceAfter?: number | null
  customerName?: string | null
}

const SEP = '--------------------'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** DD Mon YYYY from a YYYY-MM-DD or ISO date; empty string if unparseable. */
function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return ''
  const monthIdx = Number(m[2]) - 1
  if (monthIdx < 0 || monthIdx > 11) return ''
  return `${Number(m[3])} ${MONTHS[monthIdx]} ${m[1]}`
}

function rupee(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN')}`
}

export function buildReceiptText(input: ReceiptInput): string {
  const lines: string[] = []
  lines.push(input.shopName)
  lines.push(formatDate(input.date))

  if (input.items.length > 0) {
    lines.push(SEP)
    for (const it of input.items) {
      lines.push(`${it.quantity} x ${it.name} - ${rupee(it.lineTotal)}`)
    }
    lines.push(SEP)
  }

  lines.push(`Total: ${rupee(input.total)}`)
  if (input.paymentMethod === 'credit') {
    lines.push(`Udhaar: ${rupee(input.total)}`)
  } else {
    lines.push(`Paid: ${rupee(input.total)} (${input.paymentMethod})`)
  }
  if (input.balanceAfter != null && Number.isFinite(input.balanceAfter)) {
    lines.push(`Balance: ${rupee(input.balanceAfter)}`)
  }

  lines.push('')
  lines.push(`Dhanyavaad! - ${input.shopName}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/share/receipt.test.ts`
Expected: PASS (all 7 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/share/receipt.ts lib/share/receipt.test.ts
git commit -m "feat(share): buildReceiptText receipt formatter"
```

---

## Task 2: `GET /api/transactions/[id]`

**Files:**
- Modify: `app/api/transactions/[id]/route.ts` (add a `GET` handler; leave DELETE unchanged)

- [ ] **Step 1: Add the GET handler**

In `app/api/transactions/[id]/route.ts`, add this function (above or below the existing `DELETE`; do not modify DELETE):

```typescript
export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: transaction } = await supabase
    .from('transactions')
    .select('id, date, type, total_amount, payment_method, customer_id, vendor_name')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!transaction) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('transaction_items')
    .select('product_name_raw, quantity, unit_price, total_price')
    .eq('transaction_id', transaction.id)

  let customer: { name: string; phone: string | null; current_balance: number } | null = null
  if (transaction.customer_id) {
    const { data: c } = await supabase
      .from('customers')
      .select('name, phone, current_balance')
      .eq('id', transaction.customer_id)
      .eq('store_id', store.id)
      .maybeSingle()
    customer = c ?? null
  }

  return NextResponse.json({ transaction, items: items ?? [], customer })
}
```

- [ ] **Step 2: Update the file comment block**

Add to `CHANGES THIS SESSION` at the top of the file:

```
 *   - GET returns a transaction + its items + customer (for receipt sharing)
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/transactions/[id]/route.ts
git commit -m "feat(api): GET a transaction with items and customer"
```

---

## Task 3: `ShareReceiptButton` component

**Files:**
- Create: `components/share/ShareReceiptButton.tsx`

- [ ] **Step 1: Write the component**

Create `components/share/ShareReceiptButton.tsx`:

```tsx
/**
 * FILE: components/share/ShareReceiptButton.tsx
 *
 * WHAT THIS DOES:
 *   One-tap WhatsApp receipt for a saved sale. Fetches the transaction (with its
 *   items and customer) by id, builds the receipt text, and opens a prefilled
 *   wa.me link when the customer has a usable phone, or copies the text to the
 *   clipboard otherwise. The shopkeeper reviews the message before sending.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice B1 receipt sharing)
 *
 * WHERE IT FITS:
 *   Used after a manual sale saves (QuickEntry/FullEntry) and on sale rows in the
 *   customer ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/entry/QuickEntry.tsx, components/entry/FullEntryForm.tsx,
 *   components/customers/CustomerLedger.tsx, lib/share/receipt,
 *   lib/collections/reminder
 */
'use client'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { buildReceiptText, type ReceiptInput } from '@/lib/share/receipt'
import { buildWhatsappUrl } from '@/lib/collections/reminder'

interface Props {
  transactionId: string
  shopName: string
  variant?: 'prominent' | 'compact'
  className?: string
}

interface ApiItem { product_name_raw: string; quantity: number; total_price: number }

export function ShareReceiptButton({ transactionId, shopName, variant = 'prominent', className }: Props) {
  const [busy, setBusy] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  async function share() {
    setBusy(true)
    try {
      const res = await fetch(`/api/transactions/${transactionId}`)
      if (!res.ok) {
        toast.error('Could not load the bill to share.')
        return
      }
      const d = await res.json()
      const tx = d.transaction
      const customer = d.customer as { name: string; phone: string | null; current_balance: number } | null

      const input: ReceiptInput = {
        shopName,
        date: tx.date,
        items: (d.items ?? []).map((i: ApiItem) => ({
          name: i.product_name_raw,
          quantity: Number(i.quantity),
          lineTotal: Number(i.total_price),
        })),
        total: Number(tx.total_amount),
        paymentMethod: tx.payment_method,
        customerName: customer?.name ?? null,
        balanceAfter: tx.payment_method === 'credit' && customer ? Number(customer.current_balance) : null,
      }

      const text = buildReceiptText(input)
      const url = buildWhatsappUrl(customer?.phone, text)
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      try {
        await navigator.clipboard.writeText(text)
        toast.success('Receipt copied - paste it into WhatsApp.')
      } catch {
        // Last resort: show the text so the shopkeeper can select and copy it.
        if (variant === 'prominent') setFallbackText(text)
        else toast.error('Could not copy the receipt. Open the bill to copy it.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={share}
        disabled={busy}
        aria-label="Share receipt on WhatsApp"
        className={className ?? 'btn-lift ml-1 p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-60'}
      >
        <MessageCircle size={16} />
      </button>
    )
  }

  return (
    <div className="w-full">
      <button
        onClick={share}
        disabled={busy}
        className={
          className ??
          'btn-lift inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60'
        }
      >
        <MessageCircle size={16} />
        {busy ? 'Opening...' : 'Share receipt on WhatsApp'}
      </button>
      {fallbackText && (
        <textarea
          readOnly
          value={fallbackText}
          onFocus={(e) => e.currentTarget.select()}
          rows={6}
          className="mt-2 w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-700"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/share/ShareReceiptButton.tsx
git commit -m "feat(share): ShareReceiptButton (wa.me or clipboard)"
```

---

## Task 4: Wire QuickEntry post-sale share

**Files:**
- Modify: `components/entry/QuickEntry.tsx`

After a sale saves, capture the returned `transactionId` and show a brief success state with the share button + a Done button (instead of dismissing immediately). Expense/income behaviour is unchanged.

- [ ] **Step 1: Add imports + state**

In `components/entry/QuickEntry.tsx`, add the import (after the `AnimatedNumber` import):

```tsx
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'
```

Add state next to the other `useState` calls (after `const [saving, setSaving] = useState(false)`):

```tsx
  const [shopName, setShopName] = useState('')
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)
```

Add a store-name fetch next to the existing products `useEffect`:

```tsx
  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setShopName(d.store?.name ?? '')).catch(() => {})
  }, [])
```

- [ ] **Step 2: Capture the transactionId on save**

Replace the body of `handleSave` (the part from the `await fetch(...)` through `onSaved()`) so it reads the response and branches for sales. The current tail is:

```tsx
    await fetch('/api/entry/quick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    toast.success(`${TYPE_META[type].label} saved`)
    onSaved()
```

Replace it with:

```tsx
    const res = await fetch('/api/entry/quick', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    toast.success(`${TYPE_META[type].label} saved`)
    const data = await res.json().catch(() => ({}))
    if (type === 'sale' && data?.transactionId) {
      setSavedSale({ id: data.transactionId, total })
    } else {
      onSaved()
    }
```

- [ ] **Step 3: Render the success state**

In `QuickEntry`, immediately after the `const sorted = ...` line and before the `return (`, add an early return for the saved-sale success screen:

```tsx
  if (savedSale) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
          &#10003;
        </div>
        <p className="text-lg font-semibold text-gray-900">Sale saved</p>
        <p className="mt-1 text-sm text-gray-500">
          &#8377;{savedSale.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <ShareReceiptButton transactionId={savedSale.id} shopName={shopName} variant="prominent" />
          <button
            onClick={() => { setSavedSale(null); onSaved() }}
            className="btn-lift w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - Slice B1: after a sale saves, offer a WhatsApp receipt share
```

- [ ] **Step 5: Verify types compile and build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/entry/QuickEntry.tsx
git commit -m "feat(entry): share receipt after a quick sale"
```

---

## Task 5: Wire FullEntryForm post-sale share

**Files:**
- Modify: `components/entry/FullEntryForm.tsx`

- [ ] **Step 1: Add imports + state**

In `components/entry/FullEntryForm.tsx`, add the import (after the `CustomerSheet` import):

```tsx
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'
```

Add state (after `const [saving, setSaving] = useState(false)`):

```tsx
  const [shopName, setShopName] = useState('')
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)
```

Add a store-name fetch next to the existing products `useEffect`:

```tsx
  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setShopName(d.store?.name ?? '')).catch(() => {})
  }, [])
```

- [ ] **Step 2: Capture the transactionId on save**

Replace the tail of `handleSave`. The current tail is:

```tsx
    await fetch('/api/entry/full', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, type, paymentMethod, customerId,
        vendorName: vendorName || undefined,
        notes: notes || undefined,
        items,
      }),
    })
    setSaving(false)
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} saved`)
    onSaved()
```

Replace it with:

```tsx
    const res = await fetch('/api/entry/full', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date, type, paymentMethod, customerId,
        vendorName: vendorName || undefined,
        notes: notes || undefined,
        items,
      }),
    })
    setSaving(false)
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} saved`)
    const data = await res.json().catch(() => ({}))
    if (type === 'sale' && data?.transactionId) {
      setSavedSale({ id: data.transactionId, total })
    } else {
      onSaved()
    }
```

- [ ] **Step 3: Render the success state**

Immediately before the component's `return (` (after the `pmOptions` line), add:

```tsx
  if (savedSale) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
          &#10003;
        </div>
        <p className="text-lg font-semibold text-gray-900">Sale saved</p>
        <p className="mt-1 text-sm text-gray-500">
          &#8377;{savedSale.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
        <div className="mt-6 w-full max-w-xs space-y-2">
          <ShareReceiptButton transactionId={savedSale.id} shopName={shopName} variant="prominent" />
          <button
            onClick={() => { setSavedSale(null); onSaved() }}
            className="btn-lift w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    )
  }
```

- [ ] **Step 4: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - Slice B1: after a sale saves, offer a WhatsApp receipt share
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/entry/FullEntryForm.tsx
git commit -m "feat(entry): share receipt after a full-entry sale"
```

---

## Task 6: Wire CustomerLedger sale-row share

**Files:**
- Modify: `components/customers/CustomerLedger.tsx`

The ledger already fetches the store (`shop.name`) for Slice A's RemindButton. Add a compact ShareReceiptButton on `sale` rows, next to the existing delete control.

- [ ] **Step 1: Add the import**

In `components/customers/CustomerLedger.tsx`, add (after the `RemindButton` import):

```tsx
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'
```

- [ ] **Step 2: Render it on sale rows**

In the transaction row, the controls currently end with the delete button:

```tsx
                <button
                  onClick={() => askDelete(tx)}
                  aria-label="Delete transaction"
                  className="btn-lift ml-1 text-gray-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={16} />
                </button>
```

Insert the share button immediately before that delete button:

```tsx
                {tx.type === 'sale' && (
                  <ShareReceiptButton transactionId={tx.id} shopName={shop.name} variant="compact" />
                )}
                <button
                  onClick={() => askDelete(tx)}
                  aria-label="Delete transaction"
                  className="btn-lift ml-1 text-gray-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={16} />
                </button>
```

- [ ] **Step 3: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - Slice B1: compact WhatsApp receipt share on sale rows
```

- [ ] **Step 4: Verify types compile and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/customers/CustomerLedger.tsx
git commit -m "feat(ledger): share a sale receipt on WhatsApp"
```

---

## Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including `lib/share/receipt.test.ts`.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds (`/entry`, `/customers` compiled).

- [ ] **Step 4: Manual reasoning checklist (report to the user)**

- A saved sale's receipt is built from `GET /api/transactions/[id]` (one source of truth); phone/balance come from that response, not the host.
- Phone present -> wa.me opens prefilled for review; no phone -> clipboard copy (prominent variant shows a selectable box if the clipboard is blocked).
- Share is shown only for `sale` transactions (QuickEntry/FullEntry success state and ledger sale rows); expense/income/purchase/payment have no share affordance.
- The wa.me normalization is the Slice A helper (already tested); only `buildReceiptText` is newly unit-tested here.

---

## Self-Review (completed by plan author)

**Spec coverage (Phase B1):**
- Plain-text receipt via `buildReceiptText` -> Task 1.
- `GET /api/transactions/[id]` (transaction + items + customer) -> Task 2.
- `ShareReceiptButton` fetch-by-id, wa.me or clipboard fallback, loading/error handling -> Task 3.
- Manual-sale save share (QuickEntry, FullEntry), sale-only, capture transactionId, shopName fetch -> Tasks 4, 5.
- Ledger compact share on sale rows -> Task 6.
- Sale-only scope guard -> Tasks 4, 5, 6 all gate on `type === 'sale'`.
- Clipboard fallback box (prominent) / toast (compact) -> Task 3 (documented variant difference).

**Type consistency:** `ReceiptInput`/`ReceiptItem` defined in Task 1 are imported by Task 3; the GET response shape in Task 2 (`transaction`, `items` with `product_name_raw/quantity/total_price`, `customer` with `name/phone/current_balance`) is exactly what Task 3 maps; `savedSale: { id, total }` and `ShareReceiptButton` props (`transactionId`, `shopName`, `variant`) are consistent across Tasks 3-6.

**Placeholder scan:** none - every code step has full code.

**Note on scope:** Phase B2 (scan-as-sale) is a separate plan, written after B1 is built.
