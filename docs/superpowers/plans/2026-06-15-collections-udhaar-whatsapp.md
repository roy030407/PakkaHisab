# Slice A - Collections (Udhaar + WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing customer balances into a collections workflow - record repayments, show a "who owes / how old" list, and send one-tap WhatsApp reminders via wa.me links - with no WhatsApp Business API and no cost.

**Architecture:** A repayment is a new `transactions.type = 'payment'` row (cash in, not revenue, no stock) that decrements `customers.current_balance`. Pure, unit-tested helpers carry the logic risk (template rendering, wa.me URL building, balance reversal, aging). A new `stores.reminder_template` column (migration 006) holds the editable reminder text. The Customers page gains an "Udhaar due" segmented tab; the dashboard card deep-links to it.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (PostgREST + RLS), Prisma (schema source of truth), Vitest for pure-logic unit tests, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-14-collections-udhaar-whatsapp-design.md`

**Conventions to honor (CLAUDE.md):** no em dashes anywhere; every interactive element gets `cursor: pointer` + a hover lift (`.btn-lift` / `.row-lift` / `.card-lift`); every touched file gets/updates the file comment block; never `SELECT *`; scope every query to `store_id`; never commit until the user says "commit".

---

## File Structure

**New files**
- `supabase/migrations/006_reminder_template.sql` - adds `stores.reminder_template`.
- `lib/collections/reminder.ts` - `DEFAULT_REMINDER_TEMPLATE`, `renderTemplate`, `buildWhatsappUrl` (pure).
- `lib/collections/reminder.test.ts` - vitest unit tests for the above.
- `lib/collections/aging.ts` - `customerAge` (pure).
- `lib/collections/aging.test.ts` - vitest unit tests.
- `lib/transactions/reverse.test.ts` - vitest unit tests for `balanceReversalAmount` / `inventoryReversals` (covers new `payment` case).
- `app/api/customers/[id]/payment/route.ts` - `POST` record a repayment.
- `components/customers/ReceivePaymentSheet.tsx` - bottom-sheet amount entry.
- `components/customers/RemindButton.tsx` - builds + opens the wa.me reminder.

**Modified files**
- `prisma/schema.prisma` - add `reminderTemplate` to `Store`.
- `types/index.ts` - add `'payment'` to `TransactionType`.
- `lib/transactions/reverse.ts` - `balanceReversalAmount` handles `payment` (negative reversal = re-add).
- `app/api/transactions/[id]/route.ts` - apply balance delta generically (`!== 0`, not `> 0`).
- `app/api/customers/route.ts` - GET also returns `oldest_credit_at` + `last_payment_at` per customer.
- `app/api/stores/route.ts` - GET returns `reminder_template`; add `PATCH` to save it.
- `app/(dashboard)/settings/page.tsx` - "WhatsApp reminder message" section.
- `app/(dashboard)/customers/page.tsx` - segmented `[ All | Udhaar due ]` tab + udhaar list + actions + `?tab=udhaar` support.
- `components/customers/CustomerLedger.tsx` - render `payment` rows green; add Receive payment + Remind actions.
- `app/(dashboard)/dashboard/page.tsx` - Udhaar card links to `/customers?tab=udhaar`.

---

## Task 1: Migration 006 + Prisma column for the reminder template

**Files:**
- Create: `supabase/migrations/006_reminder_template.sql`
- Modify: `prisma/schema.prisma:21-31` (the `Store` model)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/006_reminder_template.sql`:

```sql
-- FILE: supabase/migrations/006_reminder_template.sql
-- WHAT THIS DOES: Adds stores.reminder_template, the editable WhatsApp reminder
--   message used by Slice A (Collections). NULL means "use the seeded default"
--   (DEFAULT_REMINDER_TEMPLATE in lib/collections/reminder.ts). Placeholders the
--   UI fills: {name}, {amount}, {shop}.
--
-- CHANGES THIS SESSION:
--   - New column: stores.reminder_template TEXT NULL
--
-- HOW TO APPLY:
--   Paste this file into the Supabase SQL editor and run.
--   Safe to re-run (IF NOT EXISTS).

ALTER TABLE stores ADD COLUMN IF NOT EXISTS reminder_template TEXT;

-- Verify:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'stores' AND column_name = 'reminder_template';
```

- [ ] **Step 2: Update the Prisma schema**

In `prisma/schema.prisma`, inside the `Store` model, add the field after `isInterstate` (keep alignment with the surrounding fields):

```prisma
  isInterstate      Boolean  @default(false) @map("is_interstate")
  reminderTemplate  String?  @map("reminder_template")
  createdAt         DateTime @default(now()) @map("created_at")
```

- [ ] **Step 3: Verify Prisma schema is valid**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid"

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_reminder_template.sql prisma/schema.prisma
git commit -m "feat(db): add stores.reminder_template (migration 006)"
```

> **Reminder to surface to the user:** migration 006 must be run manually in the Supabase SQL editor (migrations are applied by hand in this project). The feature degrades gracefully if not run (template falls back to default) but `PATCH /api/stores` saving the template needs the column.

---

## Task 2: Add `payment` to the transaction type and reverse it on delete (pure logic + tests)

**Files:**
- Modify: `types/index.ts:148`
- Modify: `lib/transactions/reverse.ts:47-57`
- Test: `lib/transactions/reverse.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `lib/transactions/reverse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { balanceReversalAmount, inventoryReversals } from './reverse'

describe('balanceReversalAmount', () => {
  it('deleting a credit sale subtracts the amount from the balance (positive reversal)', () => {
    expect(
      balanceReversalAmount({ type: 'sale', paymentMethod: 'credit', customerId: 'c1', totalAmount: 500 })
    ).toBe(500)
  })

  it('a cash sale never touches the balance', () => {
    expect(
      balanceReversalAmount({ type: 'sale', paymentMethod: 'cash', customerId: 'c1', totalAmount: 500 })
    ).toBe(0)
  })

  it('deleting a payment re-adds the amount to the balance (negative reversal)', () => {
    expect(
      balanceReversalAmount({ type: 'payment', paymentMethod: 'cash', customerId: 'c1', totalAmount: 300 })
    ).toBe(-300)
  })

  it('a payment with no customer is a no-op', () => {
    expect(
      balanceReversalAmount({ type: 'payment', paymentMethod: 'cash', customerId: null, totalAmount: 300 })
    ).toBe(0)
  })

  it('an expense never touches the balance', () => {
    expect(
      balanceReversalAmount({ type: 'expense', paymentMethod: 'cash', customerId: 'c1', totalAmount: 300 })
    ).toBe(0)
  })
})

describe('inventoryReversals', () => {
  it('payment moves no stock', () => {
    expect(inventoryReversals('payment', [{ productId: 'p1', quantity: 2 }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/transactions/reverse.test.ts`
Expected: FAIL - the `payment` cases fail (current code returns 0 for payments, and `'payment'` is not yet a valid `TransactionType` so `tsc` would also complain).

- [ ] **Step 3: Add `'payment'` to `TransactionType`**

In `types/index.ts`, line 148, change:

```typescript
export type TransactionType = "sale" | "purchase" | "expense" | "income";
```

to:

```typescript
export type TransactionType = "sale" | "purchase" | "expense" | "income" | "payment";
```

- [ ] **Step 4: Update `balanceReversalAmount` to handle `payment`**

In `lib/transactions/reverse.ts`, replace the `balanceReversalAmount` function body (lines 47-57) with:

```typescript
export function balanceReversalAmount(tx: {
  type: TransactionType
  paymentMethod: string
  customerId: string | null
  totalAmount: number
}): number {
  if (!tx.customerId) return 0
  // A credit sale increased the balance, so deleting it subtracts (positive reversal).
  if (tx.type === 'sale' && tx.paymentMethod === 'credit') {
    return Number(tx.totalAmount) || 0
  }
  // A payment decreased the balance, so deleting it re-adds (negative reversal).
  if (tx.type === 'payment') {
    return -(Number(tx.totalAmount) || 0)
  }
  return 0
}
```

Also update the function's doc comment (lines 43-46) to:

```typescript
/**
 * Deleting a transaction may need to undo its effect on the customer balance.
 * A credit sale increased the balance, so we subtract (positive reversal). A
 * payment decreased the balance, so we re-add (negative reversal). Everything
 * else leaves the balance untouched. The caller applies: balance -= reversal.
 */
```

And update the `CHANGES THIS SESSION` block at the top of the file to add:

```
 *   - balanceReversalAmount now reverses 'payment' rows (re-adds to balance)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run lib/transactions/reverse.test.ts`
Expected: PASS (all cases green)

- [ ] **Step 6: Commit**

```bash
git add types/index.ts lib/transactions/reverse.ts lib/transactions/reverse.test.ts
git commit -m "feat: add 'payment' transaction type and reverse it on delete"
```

---

## Task 3: `reminder.ts` pure helpers (template render + wa.me URL) with tests

**Files:**
- Create: `lib/collections/reminder.ts`
- Test: `lib/collections/reminder.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/collections/reminder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate, buildWhatsappUrl, DEFAULT_REMINDER_TEMPLATE } from './reminder'

describe('renderTemplate', () => {
  it('fills all three placeholders', () => {
    const out = renderTemplate('Namaste {name} ji, {shop} par {amount} baaki.', {
      name: 'Ramesh',
      amount: '1,200',
      shop: 'Sharma Stores',
    })
    expect(out).toBe('Namaste Ramesh ji, Sharma Stores par 1,200 baaki.')
  })

  it('replaces every occurrence of a placeholder', () => {
    expect(renderTemplate('{name} {name}', { name: 'A', amount: '0', shop: 'S' })).toBe('A A')
  })

  it('treats a missing value as an empty string', () => {
    expect(renderTemplate('Hi {name}{amount}', { name: 'A', shop: 'S' })).toBe('Hi A')
  })

  it('renders the seeded default without leftover braces', () => {
    const out = renderTemplate(DEFAULT_REMINDER_TEMPLATE, { name: 'Ravi', amount: '500', shop: 'My Shop' })
    expect(out).toContain('Ravi')
    expect(out).toContain('500')
    expect(out).toContain('My Shop')
    expect(out).not.toMatch(/\{(name|amount|shop)\}/)
  })
})

describe('buildWhatsappUrl', () => {
  it('prefixes a 10-digit number with 91 and encodes the message', () => {
    expect(buildWhatsappUrl('9876543210', 'Hi there')).toBe('https://wa.me/919876543210?text=Hi%20there')
  })

  it('keeps a number that already has the 91 country code', () => {
    expect(buildWhatsappUrl('919876543210', 'x')).toBe('https://wa.me/919876543210?text=x')
  })

  it('strips spaces, dashes and a +91 prefix before normalizing', () => {
    expect(buildWhatsappUrl('+91 98765-43210', 'x')).toBe('https://wa.me/919876543210?text=x')
  })

  it('returns null for empty / junk phones', () => {
    expect(buildWhatsappUrl('', 'x')).toBeNull()
    expect(buildWhatsappUrl(null, 'x')).toBeNull()
    expect(buildWhatsappUrl('abc', 'x')).toBeNull()
    expect(buildWhatsappUrl('12345', 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/collections/reminder.test.ts`
Expected: FAIL with "Failed to resolve import './reminder'"

- [ ] **Step 3: Write the implementation**

Create `lib/collections/reminder.ts`:

```typescript
/**
 * FILE: lib/collections/reminder.ts
 *
 * WHAT THIS DOES:
 *   Pure helpers for WhatsApp udhaar reminders. renderTemplate fills the
 *   {name}/{amount}/{shop} placeholders; buildWhatsappUrl normalizes an Indian
 *   phone (+91) and builds a wa.me deep link. Kept DB-free so the messaging
 *   logic is unit-tested in isolation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Used by components/customers/RemindButton.tsx and the Settings template
 *   editor. DEFAULT_REMINDER_TEMPLATE is the fallback when a store has not
 *   customized stores.reminder_template.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/customers/RemindButton.tsx, app/(dashboard)/settings/page.tsx
 */

export const DEFAULT_REMINDER_TEMPLATE =
  'Namaste {name} ji, {shop} par aapke ₹{amount} baaki hain. Kripya jab ho sake de dijiye. Dhanyavaad.'

export interface ReminderVars {
  name?: string
  amount?: string | number
  shop?: string
}

/**
 * Replace {name}, {amount}, {shop} with the supplied values. A missing value
 * becomes an empty string so the message never shows a raw placeholder.
 */
export function renderTemplate(template: string, vars: ReminderVars): string {
  const map: Record<string, string> = {
    name: vars.name != null ? String(vars.name) : '',
    amount: vars.amount != null ? String(vars.amount) : '',
    shop: vars.shop != null ? String(vars.shop) : '',
  }
  return template.replace(/\{(name|amount|shop)\}/g, (_, key: string) => map[key] ?? '')
}

/**
 * Normalize an Indian phone and build a wa.me link. Rules:
 *   - strip everything that is not a digit
 *   - 10 digits  -> prefix 91
 *   - 12 digits starting with 91 -> keep as is
 *   - anything else (empty, junk, wrong length) -> null
 * Returns null when there is no usable phone so callers never open a broken link.
 */
export function buildWhatsappUrl(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  let normalized: string | null = null
  if (digits.length === 10) normalized = `91${digits}`
  else if (digits.length === 12 && digits.startsWith('91')) normalized = digits
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/collections/reminder.test.ts`
Expected: PASS (all cases green)

- [ ] **Step 5: Commit**

```bash
git add lib/collections/reminder.ts lib/collections/reminder.test.ts
git commit -m "feat(collections): reminder template + wa.me URL helpers"
```

---

## Task 4: `aging.ts` pure helper (customer age) with tests

**Files:**
- Create: `lib/collections/aging.ts`
- Test: `lib/collections/aging.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/collections/aging.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { customerAge } from './aging'

const now = new Date('2026-06-15T10:00:00Z')

describe('customerAge', () => {
  it('computes sinceDays from the oldest credit sale and lastPaidDays from the last payment', () => {
    const out = customerAge({
      oldestCreditAt: '2026-06-05T10:00:00Z', // 10 days ago
      lastPaymentAt: '2026-06-13T10:00:00Z',  // 2 days ago
      now,
    })
    expect(out.sinceDays).toBe(10)
    expect(out.lastPaidDays).toBe(2)
  })

  it('returns lastPaidDays = null when the customer has never paid', () => {
    const out = customerAge({ oldestCreditAt: '2026-06-08T10:00:00Z', lastPaymentAt: null, now })
    expect(out.sinceDays).toBe(7)
    expect(out.lastPaidDays).toBeNull()
  })

  it('returns 0 days for a balance opened today and a payment made today', () => {
    const out = customerAge({
      oldestCreditAt: '2026-06-15T01:00:00Z',
      lastPaymentAt: '2026-06-15T09:00:00Z',
      now,
    })
    expect(out.sinceDays).toBe(0)
    expect(out.lastPaidDays).toBe(0)
  })

  it('returns sinceDays = 0 when there is no recorded credit sale', () => {
    const out = customerAge({ oldestCreditAt: null, lastPaymentAt: null, now })
    expect(out.sinceDays).toBe(0)
    expect(out.lastPaidDays).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/collections/aging.test.ts`
Expected: FAIL with "Failed to resolve import './aging'"

- [ ] **Step 3: Write the implementation**

Create `lib/collections/aging.ts`:

```typescript
/**
 * FILE: lib/collections/aging.ts
 *
 * WHAT THIS DOES:
 *   Pure helper that turns two timestamps (oldest open credit sale, most recent
 *   payment) into a human "how old is this udhaar" pair of day counts. No DB,
 *   no threshold/overdue logic - we only show the age (per the Slice A spec).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Used by the Customers "Udhaar due" tab to render the age line. The API
 *   (app/api/customers/route.ts) supplies oldestCreditAt and lastPaymentAt.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx
 */

type DateInput = string | Date | null | undefined

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysBetween(from: DateInput, now: Date): number | null {
  if (!from) return null
  const t = from instanceof Date ? from.getTime() : new Date(from).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_DAY))
}

export interface CustomerAge {
  /** Days since the oldest open credit sale. 0 when none recorded. */
  sinceDays: number
  /** Days since the most recent payment, or null if never paid. */
  lastPaidDays: number | null
}

export function customerAge(input: {
  oldestCreditAt: DateInput
  lastPaymentAt: DateInput
  now?: Date
}): CustomerAge {
  const now = input.now ?? new Date()
  return {
    sinceDays: daysBetween(input.oldestCreditAt, now) ?? 0,
    lastPaidDays: daysBetween(input.lastPaymentAt, now),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/collections/aging.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/collections/aging.ts lib/collections/aging.test.ts
git commit -m "feat(collections): customer udhaar aging helper"
```

---

## Task 5: Apply the balance reversal generically on delete

**Files:**
- Modify: `app/api/transactions/[id]/route.ts:83-104`

This makes deleting a `payment` re-add to the balance. `balanceReversalAmount` already returns a negative number for payments (Task 2); the route currently only applies the delta when `> 0`, so we widen it to `!== 0` and apply `balance -= delta`.

- [ ] **Step 1: Update the balance-reversal block**

In `app/api/transactions/[id]/route.ts`, replace lines 83-104 (the "Reverse a credit sale's effect" block) with:

```typescript
  // Undo this transaction's effect on the customer balance. A credit sale gave a
  // positive reversal (subtract); a payment gives a negative reversal (re-add).
  const balanceDelta = balanceReversalAmount({
    type: tx.type as TransactionType,
    paymentMethod: tx.payment_method,
    customerId: tx.customer_id,
    totalAmount: Number(tx.total_amount),
  })
  if (balanceDelta !== 0 && tx.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('current_balance')
      .eq('id', tx.customer_id)
      .eq('store_id', store.id)
      .maybeSingle()
    if (customer) {
      await supabase
        .from('customers')
        .update({ current_balance: Number(customer.current_balance) - balanceDelta })
        .eq('id', tx.customer_id)
        .eq('store_id', store.id)
    }
  }
```

- [ ] **Step 2: Update the file comment block**

Add to `CHANGES THIS SESSION` at the top of the file:

```
 *   - Reverse 'payment' rows on delete (re-adds the amount to the balance)
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/api/transactions/[id]/route.ts
git commit -m "feat: deleting a payment restores the customer balance"
```

---

## Task 6: `POST /api/customers/[id]/payment` - record a repayment

**Files:**
- Create: `app/api/customers/[id]/payment/route.ts`

Mirrors the transaction insert shape used in `app/api/entry/quick/route.ts` (store_id, user_id, date `YYYY-MM-DD`, type, total_amount, payment_method, source, tax_amount, notes, customer_id). No items, no stock movement. Decrements the balance (may go negative = advance).

- [ ] **Step 1: Write the route**

Create `app/api/customers/[id]/payment/route.ts`:

```typescript
/**
 * FILE: app/api/customers/[id]/payment/route.ts
 *
 * WHAT THIS DOES:
 *   POST - records a customer repayment as a transactions row with
 *   type = 'payment' (cash in, NOT revenue, no stock), then decrements the
 *   customer's current_balance by the amount (may go negative = advance/jama).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Called by ReceivePaymentSheet from the Customers udhaar tab and the ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/customers/ReceivePaymentSheet.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
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

  let body: { amount?: unknown; paymentMethod?: unknown; date?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Enter an amount greater than zero.' }, { status: 400 })
  }

  // Optional date: must be YYYY-MM-DD if provided; default to today.
  let date = new Date().toISOString().split('T')[0]
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    const d = String(body.date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(d).getTime())) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
    }
    date = d
  }

  const paymentMethod = body.paymentMethod === 'upi' ? 'upi' : 'cash'
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  // Ownership check + current balance.
  const { data: customer } = await supabase
    .from('customers')
    .select('id, current_balance')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const { error: txError } = await supabase
    .from('transactions')
    .insert({
      store_id: store.id,
      user_id: user.id,
      date,
      type: 'payment',
      total_amount: amount,
      customer_id: customer.id,
      payment_method: paymentMethod,
      source: 'manual_quick',
      tax_amount: 0,
      notes: note,
    })
  if (txError) return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })

  const newBalance = Number(customer.current_balance) - amount
  const { error: balError } = await supabase
    .from('customers')
    .update({ current_balance: newBalance })
    .eq('id', customer.id)
    .eq('store_id', store.id)
  if (balError) return NextResponse.json({ error: 'Payment saved but balance update failed' }, { status: 500 })

  return NextResponse.json({ newBalance }, { status: 201 })
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/api/customers/[id]/payment/route.ts
git commit -m "feat(api): record a customer repayment (payment transaction)"
```

---

## Task 7: `GET /api/customers` returns per-customer aging timestamps

**Files:**
- Modify: `app/api/customers/route.ts:20-35` (the `GET` handler)

Adds `oldest_credit_at` (earliest credit sale) and `last_payment_at` (most recent payment) per customer, via two grouped queries scoped to the store. The Udhaar tab uses these to show age without opening each ledger.

- [ ] **Step 1: Replace the GET handler**

In `app/api/customers/route.ts`, replace the `GET` function (lines 20-35) with:

```typescript
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

  // Oldest credit sale per customer (ascending so the first seen per id is oldest).
  const { data: creditSales } = await supabase
    .from('transactions')
    .select('customer_id, created_at')
    .eq('store_id', store.id)
    .eq('type', 'sale')
    .eq('payment_method', 'credit')
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: true })

  const oldestCreditAt = new Map<string, string>()
  for (const row of creditSales ?? []) {
    if (row.customer_id && !oldestCreditAt.has(row.customer_id)) {
      oldestCreditAt.set(row.customer_id, row.created_at)
    }
  }

  // Most recent payment per customer (descending so the first seen per id is latest).
  const { data: payments } = await supabase
    .from('transactions')
    .select('customer_id, created_at')
    .eq('store_id', store.id)
    .eq('type', 'payment')
    .not('customer_id', 'is', null)
    .order('created_at', { ascending: false })

  const lastPaymentAt = new Map<string, string>()
  for (const row of payments ?? []) {
    if (row.customer_id && !lastPaymentAt.has(row.customer_id)) {
      lastPaymentAt.set(row.customer_id, row.created_at)
    }
  }

  const enriched = (customers ?? []).map(c => ({
    ...c,
    oldest_credit_at: oldestCreditAt.get(c.id) ?? null,
    last_payment_at: lastPaymentAt.get(c.id) ?? null,
  }))

  return NextResponse.json({ customers: enriched })
}
```

- [ ] **Step 2: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - GET also returns oldest_credit_at + last_payment_at per customer (udhaar aging)
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/api/customers/route.ts
git commit -m "feat(api): customers GET returns udhaar aging timestamps"
```

---

## Task 8: `GET`/`PATCH /api/stores` for the reminder template

**Files:**
- Modify: `app/api/stores/route.ts:36-49` (GET select) and add a `PATCH` handler

- [ ] **Step 1: Add `reminder_template` to the GET select**

In `app/api/stores/route.ts`, change the GET `.select(...)` (lines 37-40) to include the new column:

```typescript
  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, name, type, owner_name, city, gst_number, preferred_language, is_interstate, reminder_template, created_at"
    )
    .eq("owner_id", user.id)
    .maybeSingle();
```

- [ ] **Step 2: Add a PATCH handler**

Append to `app/api/stores/route.ts` (after the `POST` function):

```typescript
export async function PATCH(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reminderTemplate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (body.reminderTemplate !== undefined) {
    // Empty string resets to the seeded default (stored as NULL).
    const t = typeof body.reminderTemplate === "string" ? body.reminderTemplate.trim() : "";
    allowed.reminder_template = t === "" ? null : t;
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("stores")
    .update(allowed)
    .eq("owner_id", user.id)
    .select("id, reminder_template")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to update store" }, { status: 500 });
  }

  return NextResponse.json({ store: data });
}
```

- [ ] **Step 3: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - GET returns reminder_template; PATCH saves it (Slice A WhatsApp reminders)
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/api/stores/route.ts
git commit -m "feat(api): stores GET/PATCH for the WhatsApp reminder template"
```

---

## Task 9: Settings - "WhatsApp reminder message" section

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`

Add a self-contained `ReminderTemplateSection` component (matching the file's existing `TemplateLoader`/`ImportWizard` pattern) and render it in the page. It loads the current template via `GET /api/stores`, shows the seeded default as the placeholder, and saves via `PATCH /api/stores`.

- [ ] **Step 1: Import the default template**

At the top of `app/(dashboard)/settings/page.tsx`, after the existing imports, add:

```typescript
import { DEFAULT_REMINDER_TEMPLATE } from "@/lib/collections/reminder";
```

- [ ] **Step 2: Render the section in the page**

In the returned JSX of `SettingsPage`, add `<ReminderTemplateSection />` right after `<ImportWizard />` and before the Account section:

```tsx
      {/* Import Wizard */}
      <ImportWizard />

      {/* WhatsApp reminder message */}
      <ReminderTemplateSection />

      {/* Account */}
```

- [ ] **Step 3: Add the component**

Append to `app/(dashboard)/settings/page.tsx`:

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP REMINDER TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

function ReminderTemplateSection() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => {
        setValue(d.store?.reminder_template ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderTemplate: value }),
    });
    if (res.ok) {
      setSaved(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to save.");
    }
    setSaving(false);
  }

  return (
    <section>
      <PageHeader
        title="WhatsApp Reminder Message"
        subtitle="The message pre-filled when you remind a customer about udhaar. You review it before sending."
      />
      {loading ? (
        <LoadingState message="Loading message..." />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            rows={4}
            placeholder={DEFAULT_REMINDER_TEMPLATE}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <p className="text-xs text-gray-400">
            Placeholders:{" "}
            <code className="rounded bg-gray-100 px-1">{"{name}"}</code>{" "}
            <code className="rounded bg-gray-100 px-1">{"{amount}"}</code>{" "}
            <code className="rounded bg-gray-100 px-1">{"{shop}"}</code>. Leave blank to use the default.
          </p>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save message"}
            </Button>
            {saved && <span className="text-sm text-emerald-700 font-medium">Saved.</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Verify it builds and types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): edit the WhatsApp reminder message"
```

---

## Task 10: `ReceivePaymentSheet` component

**Files:**
- Create: `components/customers/ReceivePaymentSheet.tsx`

A bottom sheet with an amount field, Full/Half/Custom quick chips, optional date (default today) and note, and a "Cash in - not counted as a sale/profit." helper. On save it POSTs to `/api/customers/[id]/payment` and calls `onSaved(newBalance)`.

- [ ] **Step 1: Write the component**

Create `components/customers/ReceivePaymentSheet.tsx`:

```tsx
/**
 * FILE: components/customers/ReceivePaymentSheet.tsx
 *
 * WHAT THIS DOES:
 *   Bottom-sheet form to record a customer repayment. Full/Half/Custom amount
 *   chips, optional date (default today) and note. POSTs to
 *   /api/customers/[id]/payment and reports the new balance to the parent.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Opened from the Customers udhaar tab and the customer ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx, components/customers/CustomerLedger.tsx
 */
'use client'
import { useState } from 'react'

interface Props {
  customerId: string
  customerName: string
  currentBalance: number
  onClose: () => void
  onSaved: (newBalance: number) => void
}

export function ReceivePaymentSheet({ customerId, customerName, currentBalance, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setChip(kind: 'full' | 'half') {
    const base = Math.max(0, currentBalance)
    setAmount(String(kind === 'full' ? base : Math.round(base / 2)))
  }

  async function save() {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/customers/${customerId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: n, date, note: note.trim() || undefined }),
    })
    if (res.ok) {
      const d = await res.json()
      onSaved(Number(d.newBalance))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to record payment.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-gray-900">Receive payment</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          From {customerName} &middot; balance &#8377;{Math.max(0, currentBalance).toLocaleString('en-IN')}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setChip('full')}
            className="btn-lift flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-800"
          >
            Full
          </button>
          <button
            onClick={() => setChip('half')}
            className="btn-lift flex-1 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-sm font-medium text-emerald-800"
          >
            Half
          </button>
        </div>

        <label className="mt-4 block text-xs font-medium text-gray-600">Amount (&#8377;)</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. UPI"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-400">Cash in - not counted as a sale/profit.</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-lift flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-lift flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/customers/ReceivePaymentSheet.tsx
git commit -m "feat(customers): receive-payment bottom sheet"
```

---

## Task 11: `RemindButton` component

**Files:**
- Create: `components/customers/RemindButton.tsx`

Builds the message from the store template (or `DEFAULT_REMINDER_TEMPLATE`) + customer, then opens the wa.me link in a new tab. If the customer has no usable phone, it shows an inline prompt instead of opening a broken link.

- [ ] **Step 1: Write the component**

Create `components/customers/RemindButton.tsx`:

```tsx
/**
 * FILE: components/customers/RemindButton.tsx
 *
 * WHAT THIS DOES:
 *   One-tap WhatsApp udhaar reminder. Renders the store's reminder template with
 *   the customer's name/balance/shop, builds a wa.me link, and opens it for the
 *   shopkeeper to review and send. With no usable phone, it prompts to add one
 *   instead of opening a broken link.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Used in the Customers udhaar tab and the customer ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx, components/customers/CustomerLedger.tsx
 *   lib/collections/reminder.ts
 */
'use client'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { renderTemplate, buildWhatsappUrl, DEFAULT_REMINDER_TEMPLATE } from '@/lib/collections/reminder'

interface Props {
  customerName: string
  phone?: string | null
  balance: number
  shopName: string
  template?: string | null
  onNeedPhone?: () => void
  className?: string
}

export function RemindButton({ customerName, phone, balance, shopName, template, onNeedPhone, className }: Props) {
  const [noPhone, setNoPhone] = useState(false)

  function remind() {
    const message = renderTemplate(template?.trim() || DEFAULT_REMINDER_TEMPLATE, {
      name: customerName,
      amount: Math.max(0, balance).toLocaleString('en-IN'),
      shop: shopName,
    })
    const url = buildWhatsappUrl(phone, message)
    if (!url) {
      setNoPhone(true)
      onNeedPhone?.()
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={remind}
        className={
          className ??
          'btn-lift inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50'
        }
      >
        <MessageCircle size={14} />
        Remind
      </button>
      {noPhone && (
        <span className="mt-1 text-xs text-amber-600">Add a phone number to send a reminder.</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/customers/RemindButton.tsx
git commit -m "feat(customers): one-tap WhatsApp reminder button"
```

---

## Task 12: Customers page - "Udhaar due" segmented tab + actions

**Files:**
- Modify: `app/(dashboard)/customers/page.tsx`

Add a segmented control `[ All | Udhaar due - Rs<total> ]`, default-selecting the udhaar tab when `?tab=udhaar` is present. The udhaar tab lists customers with `currentBalance > 0` sorted by balance desc, each row showing name, amber balance, an age line from `customerAge`, and `Receive payment` + `Remind` actions. Fetches the store (name + template) once for the reminder.

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `app/(dashboard)/customers/page.tsx` with:

```tsx
/**
 * FILE: app/(dashboard)/customers/page.tsx
 *
 * WHAT THIS DOES:
 *   Customer hub with two tabs: All (searchable list) and Udhaar due (who owes,
 *   how old, with Receive payment + WhatsApp remind actions). Tapping a customer
 *   opens their ledger. The Udhaar tab is auto-selected via ?tab=udhaar.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *   - Slice A: Udhaar due tab (aging + receive payment + WhatsApp remind)
 *
 * WHERE IT FITS:
 *   Route /customers. Reached from BottomNav and the dashboard Udhaar card.
 *
 * CALLED BY / IMPORTS FROM:
 *   BottomNav, dashboard Udhaar card, ReceivePaymentSheet, RemindButton,
 *   lib/collections/aging
 */
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Users } from 'lucide-react'
import { CreditBadge } from '@/components/customers/CreditBadge'
import { CustomerLedger } from '@/components/customers/CustomerLedger'
import { ReceivePaymentSheet } from '@/components/customers/ReceivePaymentSheet'
import { RemindButton } from '@/components/customers/RemindButton'
import { ListPageSkeleton } from '@/components/shared/PageSkeleton'
import { customerAge } from '@/lib/collections/aging'

interface CustomerRow {
  id: string
  name: string
  phone?: string | null
  currentBalance: number
  creditLimit: number
  oldest_credit_at: string | null
  last_payment_at: string | null
}

function ageLine(c: CustomerRow): string {
  const { sinceDays, lastPaidDays } = customerAge({
    oldestCreditAt: c.oldest_credit_at,
    lastPaymentAt: c.last_payment_at,
  })
  const since = `Balance since ${sinceDays} din`
  const paid = lastPaidDays === null ? 'never paid' : `last paid ${lastPaidDays} din ago`
  return `${since} · ${paid}`
}

export default function CustomersPage() {
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'udhaar'>(searchParams.get('tab') === 'udhaar' ? 'udhaar' : 'all')
  const [shop, setShop] = useState<{ name: string; reminderTemplate: string | null }>({ name: '', reminderTemplate: null })
  const [payFor, setPayFor] = useState<CustomerRow | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    return fetch('/api/customers')
      .then(r => r.json())
      .then(d => {
        const rows: CustomerRow[] = (d.customers ?? []).map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          phone: (c.phone as string) ?? null,
          currentBalance: Number(c.current_balance ?? 0),
          creditLimit: Number(c.credit_limit ?? 0),
          oldest_credit_at: (c.oldest_credit_at as string) ?? null,
          last_payment_at: (c.last_payment_at as string) ?? null,
        }))
        setCustomers(rows)
        setLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(d => setShop({ name: d.store?.name ?? '', reminderTemplate: d.store?.reminder_template ?? null }))
      .catch(() => {})
  }, [])

  if (selected) {
    return <CustomerLedger customerId={selected} onBack={() => { setSelected(null); load() }} />
  }

  const udhaar = customers
    .filter(c => c.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance)
  const udhaarTotal = udhaar.reduce((s, c) => s + c.currentBalance, 0)

  const allFiltered = customers.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query)
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900 mb-3">Customers</h1>

        {/* Segmented tabs */}
        <div className="mb-3 flex rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setTab('all')}
            className={`btn-lift flex-1 rounded-md py-1.5 font-medium ${tab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            All
          </button>
          <button
            onClick={() => setTab('udhaar')}
            className={`btn-lift flex-1 rounded-md py-1.5 font-medium ${tab === 'udhaar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Udhaar due &middot; &#8377;{udhaarTotal.toLocaleString('en-IN')}
          </button>
        </div>

        {tab === 'all' && (
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        )}
      </div>

      <div className="flex-1 px-4 py-3">
        {loading ? (
          <ListPageSkeleton rows={5} />
        ) : tab === 'all' ? (
          allFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Users size={22} className="text-emerald-700" />
              </div>
              <p className="text-sm font-medium text-gray-900">No customers yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                Customers are added when you record a sale - they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {allFiltered.map(c => (
                <button key={c.id} onClick={() => setSelected(c.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50 row-lift relative">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
                    {(c.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                  </div>
                  <CreditBadge balance={c.currentBalance} />
                </button>
              ))}
            </div>
          )
        ) : udhaar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Users size={22} className="text-emerald-700" />
            </div>
            <p className="text-sm font-medium text-gray-900">No udhaar pending</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
              When a customer buys on credit, their balance shows here so you can follow up.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {udhaar.map(c => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <button onClick={() => setSelected(c.id)} className="w-full text-left row-lift">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm font-semibold tabular-nums text-amber-600">
                      &#8377;{c.currentBalance.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">{ageLine(c)}</p>
                </button>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPayFor(c)}
                    className="btn-lift inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    + Receive payment
                  </button>
                  <RemindButton
                    customerName={c.name}
                    phone={c.phone}
                    balance={c.currentBalance}
                    shopName={shop.name}
                    template={shop.reminderTemplate}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {payFor && (
        <ReceivePaymentSheet
          customerId={payFor.id}
          customerName={payFor.name}
          currentBalance={payFor.currentBalance}
          onClose={() => setPayFor(null)}
          onSaved={() => { setPayFor(null); load() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

> Note: `useSearchParams` requires the page to be within a Suspense boundary at build time in Next 14. This page is already a client component under the dashboard layout; if `npm run build` reports a "useSearchParams should be wrapped in a suspense boundary" error for `/customers`, wrap the default export's returned tree by splitting the component into an inner `CustomersInner` and exporting `export default function CustomersPage() { return <Suspense fallback={<ListPageSkeleton rows={5} />}><CustomersInner /></Suspense> }` (import `Suspense` from `react`). Apply this only if the build complains.

- [ ] **Step 3: Run the build to confirm the route compiles**

Run: `npm run build`
Expected: build succeeds; `/customers` listed. If it fails only on the `useSearchParams` Suspense rule, apply the note above, then re-run.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/customers/page.tsx
git commit -m "feat(customers): Udhaar due tab with payment + WhatsApp remind"
```

---

## Task 13: Customer ledger - green payment rows + actions

**Files:**
- Modify: `components/customers/CustomerLedger.tsx`

Render `payment` rows as green "Payment received +Rs"; sales stay amber/neutral as today. Add `Receive payment` + `Remind` actions in the header. Fetch the store (name + template) for the reminder.

- [ ] **Step 1: Update imports and types**

In `components/customers/CustomerLedger.tsx`, update the imports (after line 23) and the `CustomerDetail` interface:

```tsx
import { Trash2 } from 'lucide-react'
import { CreditBadge } from './CreditBadge'
import { ReceivePaymentSheet } from './ReceivePaymentSheet'
import { RemindButton } from './RemindButton'
```

(The `Tx` interface already has the `type` field used below; no change needed there.)

- [ ] **Step 2: Add store + sheet state and a payment open flag**

Inside `CustomerLedger`, after the existing `useState` declarations (around line 37), add:

```tsx
  const [shop, setShop] = useState<{ name: string; reminderTemplate: string | null }>({ name: '', reminderTemplate: null })
  const [showPay, setShowPay] = useState(false)
```

And after the existing `useEffect(() => { load() }, [load])` (line 49), add:

```tsx
  useEffect(() => {
    fetch('/api/stores')
      .then(r => r.json())
      .then(d => setShop({ name: d.store?.name ?? '', reminderTemplate: d.store?.reminder_template ?? null }))
      .catch(() => {})
  }, [])
```

- [ ] **Step 3: Add the header actions**

In the header block, replace the `<div className="flex items-center justify-between">...</div>` (lines 88-94) with:

```tsx
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{customer.name}</h2>
            {customer.phone && <p className="text-sm text-gray-400">{customer.phone}</p>}
          </div>
          <CreditBadge balance={customer.current_balance} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setShowPay(true)}
            className="btn-lift inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            + Receive payment
          </button>
          <RemindButton
            customerName={customer.name}
            phone={customer.phone}
            balance={Number(customer.current_balance)}
            shopName={shop.name}
            template={shop.reminderTemplate}
          />
        </div>
```

- [ ] **Step 4: Render payment rows green**

Replace the amount paragraph in each transaction row (lines 113-115) with:

```tsx
                <p className={`text-sm font-semibold tabular-nums ${tx.type === 'payment' ? 'text-emerald-700' : tx.type === 'sale' ? 'text-green-700' : 'text-gray-900'}`}>
                  {tx.type === 'payment'
                    ? `Payment received +₹${Number(tx.total_amount).toLocaleString('en-IN')}`
                    : `${tx.type === 'sale' ? '+' : '-'}₹${Number(tx.total_amount).toLocaleString('en-IN')}`}
                </p>
```

- [ ] **Step 5: Render the payment sheet**

Just before the closing `</div>` of the component (right before the `<dialog>` element at line 129), add:

```tsx
      {showPay && (
        <ReceivePaymentSheet
          customerId={customerId}
          customerName={customer.name}
          currentBalance={Number(customer.current_balance)}
          onClose={() => setShowPay(false)}
          onSaved={() => { setShowPay(false); load() }}
        />
      )}
```

- [ ] **Step 6: Update the file comment block**

Add to `CHANGES THIS SESSION`:

```
 *   - Slice A: payment rows render green; Receive payment + WhatsApp remind actions
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add components/customers/CustomerLedger.tsx
git commit -m "feat(ledger): green payment rows + receive/remind actions"
```

---

## Task 14: Dashboard - deep-link the Udhaar card to the tab

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx:216`

- [ ] **Step 1: Update the link target**

In `app/(dashboard)/dashboard/page.tsx`, change the Udhaar card link (line 216):

```tsx
            <Link href="/customers" className="contents">
```

to:

```tsx
            <Link href="/customers?tab=udhaar" className="contents">
```

- [ ] **Step 2: Verify types compile and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): Udhaar card deep-links to the udhaar tab"
```

---

## Task 15: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including `lib/collections/reminder.test.ts`, `lib/collections/aging.test.ts`, `lib/transactions/reverse.test.ts`.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with `/customers`, `/settings`, `/dashboard` compiled.

- [ ] **Step 4: Manual smoke checklist (report results to the user)**

Confirm by reasoning over the diff (no DB writes in this step):
- A credit sale raises a customer balance; recording a payment lowers it; deleting that payment row restores it (Task 2 + Task 5 + Task 6).
- Payment excluded from sales/profit/inventory because all revenue and stock code keys off `'sale'`/`'purchase'` (verified: `lib/transactions/reverse.ts`, `app/api/entry/quick/route.ts`, dashboard snapshot select uses `type` filters).
- Reminder falls back to `DEFAULT_REMINDER_TEMPLATE` when `reminder_template` is null.
- No usable phone -> RemindButton shows the inline prompt, never opens a broken link.

- [ ] **Step 5: Remind the user**

State clearly: "Migration 006 (`supabase/migrations/006_reminder_template.sql`) must be run manually in the Supabase SQL editor before the Settings template save and the reminder customization work end to end. The spec commit (00da47c) and this work are local only - say 'push' to publish."

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Repayment as `type='payment'` (cash in, not revenue, no stock), decrements balance, may go negative -> Tasks 2, 6.
- Deleting a payment re-adds to balance -> Tasks 2, 5.
- `stores.reminder_template` + seeded romanized-Hindi default, editable in Settings -> Tasks 1, 3, 8, 9.
- Aging shows age only, negative balance allowed -> Tasks 4, 12.
- Pure helpers `renderTemplate`, `buildWhatsappUrl`, `customerAge` with unit tests -> Tasks 3, 4.
- `POST /api/customers/[id]/payment` -> Task 6.
- `GET /api/customers` returns `oldest_credit_at` + `last_payment_at` -> Task 7.
- `PATCH /api/stores` for `reminderTemplate` -> Task 8.
- Customers "Udhaar due" segmented tab, `?tab=udhaar` deep-link -> Tasks 12, 14.
- ReceivePaymentSheet (Full/Half/Custom, date, note, "cash in" helper) -> Task 10.
- RemindButton (+91 normalization, no-phone prompt, review before send via wa.me) -> Task 11.
- CustomerLedger payment rows green + actions -> Task 13.

**Type consistency:** `CustomerRow` (page) carries `oldest_credit_at`/`last_payment_at` matching the API field names; `customerAge` input keys (`oldestCreditAt`, `lastPaymentAt`, `now`) are consistent across `aging.ts` and both call sites; `balanceReversalAmount` signature unchanged (route call site already matches); `RemindButton`/`ReceivePaymentSheet` prop names match both call sites (page + ledger).

**Placeholder scan:** none - every code step contains full code.
