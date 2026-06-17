# Slice B2 - Scan as a Sale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a scanned bill be recorded as a sale (not only a purchase) so the shopkeeper can share a WhatsApp receipt after a scan, reusing the B1 `ShareReceiptButton`.

**Architecture:** The scan confirm flow gains a Purchase/Sale toggle. In Sale mode the vendor field is replaced by a customer picker (reusing `CustomerSheet`); the confirm route saves a `sale` (stock moves out via the existing `updateStock`, and a credit sale bumps the customer balance, mirroring `entry/quick`). After a sale confirms, the scan page shows the B1 `ShareReceiptButton`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (PostgREST + RLS), Tailwind. Depends on B1 (`components/share/ShareReceiptButton.tsx`).

**Spec:** `docs/superpowers/specs/2026-06-15-whatsapp-receipt-sharing-design.md` (Phase B2).

**Conventions (CLAUDE.md):** no em dashes; interactive elements use `.btn-lift` + pointer cursor; update file comment blocks; never `SELECT *`; scope every query to `store_id`. Do not run `git commit` during execution (the user commits manually on request); keep the commit steps for reference.

---

## File Structure

**Modified files**
- `app/api/scan/confirm/route.ts` - accept `type`/`customerId`/`paymentMethod`; save a sale (stock out + credit balance) or a purchase (unchanged default).
- `components/scan/ExtractionReview.tsx` - Purchase/Sale toggle, customer picker in Sale mode, payload fields, dynamic button label.
- `app/(dashboard)/scan/page.tsx` - pass the new fields through; after a sale, show the share button instead of redirecting.

No new files, no migration, no new pure logic worth isolating (the sale-vs-purchase stock direction mirrors `entry/quick` and reuses the tested `updateStock`; reversal semantics for `sale`/`payment` are already unit-tested in `lib/transactions/reverse.test.ts`).

---

## Task 1: Scan confirm route saves a sale or a purchase

**Files:**
- Modify: `app/api/scan/confirm/route.ts`

Today the route hardcodes `type: 'purchase'`, `payment_method: 'cash'`, vendor only, and stock-in. This task makes it honor a `type` and, for a sale, save the customer, move stock out, and bump a credit balance.

- [ ] **Step 1: Extend the payload interface**

In `app/api/scan/confirm/route.ts`, replace the `ConfirmPayload` interface with:

```typescript
interface ConfirmPayload {
  documentUploadId: string
  type?: 'purchase' | 'sale'
  vendorName?: string
  customerId?: string
  paymentMethod?: 'cash' | 'upi' | 'credit'
  date?: string
  totalAmount: number
  items: ConfirmItem[]
}
```

- [ ] **Step 2: Verify the customer (sale only) and build the transaction insert**

Replace the transaction-insert block (the `const { data: tx, error: txError } = await supabase.from('transactions').insert({ ... }).select('id').single()` call, currently lines 83-98) with:

```typescript
  const isSale = body.type === 'sale'

  // Sale only: verify the customer belongs to this store before attaching it.
  let verifiedCustomerId: string | null = null
  if (isSale && body.customerId) {
    const { data: c } = await supabase
      .from('customers')
      .select('id')
      .eq('id', body.customerId)
      .eq('store_id', store.id)
      .maybeSingle()
    verifiedCustomerId = c ? body.customerId : null
  }

  const paymentMethod = isSale ? (body.paymentMethod ?? 'cash') : 'cash'

  // Create transaction
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date: body.date ?? new Date().toISOString().split('T')[0],
      type: isSale ? 'sale' : 'purchase',
      total_amount: body.totalAmount,
      vendor_name: isSale ? null : (body.vendorName ?? null),
      customer_id: verifiedCustomerId,
      payment_method: paymentMethod,
      source: 'bill_scan',
      source_document_id: sourceDocumentId,
      tax_amount: 0,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
```

- [ ] **Step 3: Move stock in the right direction**

In the item loop, replace the `updateStock` call (currently lines 167-174) with:

```typescript
    // Sale moves stock out (-qty); purchase brings it in (+qty).
    await updateStock(supabase, {
      storeId: store.id,
      productId,
      delta: isSale ? -item.quantity : item.quantity,
      transactionId: tx.id,
      movementType: isSale ? 'sale' : 'purchase',
      unitPrice: item.unitPrice,
    })
```

- [ ] **Step 4: Bump a credit sale's customer balance**

Immediately after the item `for (...) { ... }` loop closes and before the "Mark document upload as confirmed" block, add:

```typescript
  // A credit sale increases what the customer owes (mirrors entry/quick).
  if (isSale && verifiedCustomerId && paymentMethod === 'credit') {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', verifiedCustomerId)
      .eq('store_id', store.id)
      .single()
    if (customer) {
      await supabase
        .from('customers')
        .update({ current_balance: Number(customer.current_balance) + Number(body.totalAmount) })
        .eq('id', verifiedCustomerId)
        .eq('store_id', store.id)
    }
  }
```

- [ ] **Step 5: Update the file comment block**

Add to `CHANGES THIS SESSION` at the top of `app/api/scan/confirm/route.ts`:

```
 *   - Slice B2: can save a scan as a sale (stock out + credit balance), not only a purchase
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/scan/confirm/route.ts
git commit -m "feat(scan): confirm a scanned bill as a sale or a purchase"
```

---

## Task 2: ExtractionReview Purchase/Sale toggle + customer picker

**Files:**
- Modify: `components/scan/ExtractionReview.tsx`

- [ ] **Step 1: Extend the onSave payload type + imports**

In `components/scan/ExtractionReview.tsx`, add the import after the `DuplicateWarning` import:

```tsx
import { CustomerSheet } from '@/components/entry/CustomerSheet'
```

In the `Props` interface, change the `onSave` payload type so it includes the new fields. Replace the `onSave: (payload: { ... }) => void` object type's leading fields:

```tsx
  onSave: (payload: {
    documentUploadId: string
    type: 'purchase' | 'sale'
    vendorName?: string
    customerId?: string
    paymentMethod?: 'cash' | 'upi' | 'credit'
    date?: string
    totalAmount: number
    items: Array<{
      productNameRaw: string
      matchedProductId?: string
      addAsNew: boolean
      quantity: number
      unitPrice: number
      totalPrice: number
      taxRate?: number
      correction?: { original: string; corrected: string }
    }>
  }) => void
```

- [ ] **Step 2: Add state**

After the existing `const [saving, setSaving] = useState(false)` line, add:

```tsx
  const [txType, setTxType] = useState<'purchase' | 'sale'>('purchase')
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'credit'>('cash')
  const [showCustomer, setShowCustomer] = useState(false)
```

- [ ] **Step 3: Add the toggle and swap vendor for customer in the header**

In the sticky header, replace the vendor/date grid block. The current block is:

```tsx
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Vendor</label>
            <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Unknown vendor"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm font-semibold text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Date</label>
            <input value={date} onChange={e => setDate(e.target.value)} placeholder="Not detected"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
        </div>
```

Replace it with:

```tsx
        <div className="mb-2 inline-flex rounded-lg bg-emerald-800/40 p-0.5">
          {(['purchase', 'sale'] as const).map(t => (
            <button key={t} onClick={() => setTxType(t)}
              className={`btn-lift rounded-md px-3 py-1 text-xs font-semibold ${txType === t ? 'bg-white text-emerald-800' : 'text-emerald-100'}`}>
              {t === 'purchase' ? 'Purchase' : 'Sale'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {txType === 'purchase' ? (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-emerald-200">Vendor</label>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Unknown vendor"
                className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm font-semibold text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase tracking-wide text-emerald-200">Customer</label>
              <button onClick={() => setShowCustomer(true)}
                className="btn-lift mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-left text-sm font-semibold text-white outline-none focus:border-emerald-300">
                {customerId ? '✓ Customer added' : '+ Add customer (optional)'}
              </button>
            </div>
          )}
          <div>
            <label className="text-[10px] uppercase tracking-wide text-emerald-200">Date</label>
            <input value={date} onChange={e => setDate(e.target.value)} placeholder="Not detected"
              className="mt-0.5 w-full rounded-md border border-emerald-500/60 bg-emerald-800/40 px-2 py-1.5 text-sm text-white placeholder-emerald-300 outline-none focus:border-emerald-300" />
          </div>
        </div>
```

- [ ] **Step 4: Pass the new fields in handleSave**

In `handleSave`, the payload object currently starts:

```tsx
    const payload = {
      documentUploadId,
      vendorName: vendorName.trim() || undefined,
      date: date.trim() || undefined,
      totalAmount: total,
      items: live.filter(i => i.editedQty > 0).map(it => {
```

Replace those leading fields (everything before `items:`) with:

```tsx
    const payload = {
      documentUploadId,
      type: txType,
      vendorName: txType === 'purchase' ? (vendorName.trim() || undefined) : undefined,
      customerId: txType === 'sale' ? customerId : undefined,
      paymentMethod: txType === 'sale' ? paymentMethod : undefined,
      date: date.trim() || undefined,
      totalAmount: total,
      items: live.filter(i => i.editedQty > 0).map(it => {
```

- [ ] **Step 5: Make the save button label dynamic**

In the footer, the save button text is currently:

```tsx
          {saving ? 'Saving...' : unresolved ? 'Resolve highlighted items to save' : `Save purchase · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
```

Replace `Save purchase` with the dynamic label:

```tsx
          {saving ? 'Saving...' : unresolved ? 'Resolve highlighted items to save' : `Save ${txType} · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
```

- [ ] **Step 6: Render the CustomerSheet**

Immediately before the component's final closing `</div>` (the one that closes the outermost `<div className="flex flex-col min-h-screen bg-gray-50">`), add:

```tsx
      <CustomerSheet
        open={showCustomer}
        onClose={() => setShowCustomer(false)}
        onSelect={(id, pm) => { setCustomerId(id); setPaymentMethod(pm); setShowCustomer(false) }}
      />
```

- [ ] **Step 7: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - Slice B2: Purchase/Sale toggle; in Sale mode pick a customer + payment method
```

- [ ] **Step 8: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add components/scan/ExtractionReview.tsx
git commit -m "feat(scan): Purchase/Sale toggle with customer picker"
```

---

## Task 3: Scan page passes the fields and offers the share after a sale

**Files:**
- Modify: `app/(dashboard)/scan/page.tsx`

- [ ] **Step 1: Imports + extended payload type**

In `app/(dashboard)/scan/page.tsx`, add imports after the existing imports:

```tsx
import { useEffect } from 'react'
import { ShareReceiptButton } from '@/components/share/ShareReceiptButton'
```

(Adjust the existing `import { useState } from 'react'` to `import { useState, useEffect } from 'react'` instead of adding a duplicate import if you prefer; either compiles, but do not import `useState` twice.)

Replace the `ConfirmPayload` interface with:

```tsx
interface ConfirmPayload {
  documentUploadId: string
  type: 'purchase' | 'sale'
  vendorName?: string
  customerId?: string
  paymentMethod?: 'cash' | 'upi' | 'credit'
  date?: string
  totalAmount: number
  items: Array<{
    productNameRaw: string
    matchedProductId?: string
    addAsNew: boolean
    quantity: number
    unitPrice: number
    totalPrice: number
    taxRate?: number
    correction?: { original: string; corrected: string }
  }>
}
```

- [ ] **Step 2: Add state + store-name fetch**

After `const [errorMessage, setErrorMessage] = useState('')`, add:

```tsx
  const [shopName, setShopName] = useState('')
  const [savedSale, setSavedSale] = useState<{ id: string; total: number } | null>(null)

  useEffect(() => {
    fetch('/api/stores').then(r => r.json()).then(d => setShopName(d.store?.name ?? '')).catch(() => {})
  }, [])
```

- [ ] **Step 3: Branch handleSave for a sale**

Replace the `handleSave` function body with:

```tsx
  async function handleSave(payload: ConfirmPayload) {
    const res = await fetch('/api/scan/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      if (payload.type === 'sale' && data?.transactionId) {
        setSavedSale({ id: data.transactionId, total: payload.totalAmount })
        return
      }
      router.push('/dashboard')
      router.refresh()
    } else {
      const data = await res.json()
      setErrorMessage(data.error ?? 'Failed to save. Please try again.')
      setState('error')
    }
  }
```

- [ ] **Step 4: Render the post-sale success screen**

Immediately after the `if (state === 'upload') { return <ScanUpload ... /> }` block (or anywhere among the early returns, as long as it is before the final `return null`), add a success branch that takes priority. Put this right after the `const router = useRouter()` early returns begin - specifically, add it as the FIRST early return inside the component body, before `if (state === 'upload')`:

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
            onClick={() => { router.push('/dashboard'); router.refresh() }}
            className="btn-lift w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    )
  }
```

- [ ] **Step 5: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - Slice B2: after a scanned SALE, offer a WhatsApp receipt share
```

- [ ] **Step 6: Verify types compile and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/scan/page.tsx
git commit -m "feat(scan): share a receipt after a scanned sale"
```

---

## Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass (no test changes in B2; nothing should regress).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds (`/scan` compiled).

- [ ] **Step 4: Manual reasoning checklist (report to the user)**

- Default is still Purchase: a scan with no toggle change saves exactly as before (vendor, stock in, cash).
- Sale mode: saves `type='sale'`, attaches the verified customer, moves stock OUT, and a credit sale increases `current_balance` by the total.
- A scanned sale with no customer is allowed (walk-in); the share falls back to clipboard copy (no phone).
- After a scanned sale, the B1 `ShareReceiptButton` builds the receipt from `GET /api/transactions/[id]` exactly like the manual-sale path.
- A scanned purchase still redirects to the dashboard with no share affordance.

---

## Self-Review (completed by plan author)

**Spec coverage (Phase B2):**
- Purchase/Sale toggle, customer picker + payment in Sale mode, dynamic button label -> Task 2.
- Confirm route accepts `type`/`customerId`/`paymentMethod`; sale = stock out + credit balance; purchase unchanged -> Task 1.
- Scan page passes the fields and shows the share after a sale (reusing B1) -> Task 3.
- Walk-in scanned sale (no customer) allowed; share falls back to copy -> handled by verifiedCustomerId being null + B1 button's clipboard fallback.

**Type consistency:** the `onSave` payload in `ExtractionReview` (Task 2), the `ConfirmPayload` in the scan page (Task 3), and the `ConfirmPayload` in the confirm route (Task 1) all carry the same new fields (`type`, `customerId`, `paymentMethod`, `vendorName?`). `ShareReceiptButton` props (`transactionId`, `shopName`, `variant`) match B1. `CustomerSheet.onSelect(id, pm)` matches its real signature.

**Placeholder scan:** none - every code step has full code.

**Note on tests:** B2 introduces no isolatable pure logic (the sale/purchase stock direction mirrors `entry/quick` and reuses the unit-tested `updateStock`; sale/payment reversal is already covered in `lib/transactions/reverse.test.ts`). Verification is tsc + full suite + build + manual reasoning.
