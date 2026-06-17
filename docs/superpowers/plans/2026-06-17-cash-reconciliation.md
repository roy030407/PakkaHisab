# Slice C - End-of-Day Cash Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-tap daily "Din ka hisab" close that shows expected cash (opening + cash in - cash out) versus the counted cash, flags the gap, shows a separate UPI tally, and saves the close so tomorrow's opening carries forward.

**Architecture:** A pure `computeCashPosition` helper (unit-tested) derives cashIn/cashOut/expected/upiTotal from a day's transactions. A new `cash_reconciliations` table (migration 007) persists each close. `GET/POST /api/reconciliation` compute the position server-side (POST never trusts client sums) and upsert one row per store per day. A dashboard card links to a `/reconcile` screen.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (PostgREST + RLS), Prisma (schema source of truth), Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-17-cash-reconciliation-design.md`

**Conventions (CLAUDE.md):** no em dashes; interactive elements use `.btn-lift`/`.card-lift` + pointer cursor; update file comment blocks; never `SELECT *`; scope every query to `store_id`. The `₹` rupee sign is allowed. Do not run `git commit` during execution (the user commits manually on request); keep commit steps for reference.

**Codebase facts (verified):** table ids are `text` with DB default `gen_random_uuid()::text`; money columns are `numeric(12,2)` (Prisma `Decimal @db.Decimal(12,2)`); RLS compares `owner_id = auth.uid()::text`; PostgREST inserts omit `id`/`updated_at`, so the migration must set DB defaults for them.

---

## File Structure

**New files**
- `lib/reports/cashReconciliation.ts` - `computeCashPosition` + `cashDifference` (pure).
- `lib/reports/cashReconciliation.test.ts` - vitest unit tests.
- `supabase/migrations/007_cash_reconciliations.sql` - table + RLS + defaults.
- `app/api/reconciliation/route.ts` - GET (compute) + POST (upsert close).
- `app/(dashboard)/reconcile/page.tsx` - the close-day screen.

**Modified files**
- `prisma/schema.prisma` - add `CashReconciliation` model + Store relation.
- `app/(dashboard)/dashboard/page.tsx` - add the "Din ka hisab" card.

---

## Task 1: `cashReconciliation` pure helper + tests

**Files:**
- Create: `lib/reports/cashReconciliation.ts`
- Test: `lib/reports/cashReconciliation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/reports/cashReconciliation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeCashPosition, cashDifference } from './cashReconciliation'

const tx = (type: string, paymentMethod: string | null, totalAmount: number) => ({ type, paymentMethod, totalAmount })

describe('computeCashPosition', () => {
  it('sums cash in across sale, income, and payment (cash method)', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [
        tx('sale', 'cash', 100),
        tx('income', 'cash', 50),
        tx('payment', 'cash', 30),
      ],
    })
    expect(r.cashIn).toBe(180)
    expect(r.cashOut).toBe(0)
    expect(r.expectedCash).toBe(180)
  })

  it('sums cash out across purchase and expense (cash method)', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [tx('purchase', 'cash', 70), tx('expense', 'cash', 20)],
    })
    expect(r.cashOut).toBe(90)
    expect(r.expectedCash).toBe(-90)
  })

  it('applies the opening float to expected cash', () => {
    const r = computeCashPosition({
      openingCash: 500,
      transactions: [tx('sale', 'cash', 100), tx('expense', 'cash', 40)],
    })
    expect(r.expectedCash).toBe(560)
  })

  it('excludes credit from cash and counts UPI only in the upi tally', () => {
    const r = computeCashPosition({
      openingCash: 0,
      transactions: [
        tx('sale', 'credit', 1000), // ignored for cash and upi
        tx('sale', 'upi', 200),     // upi tally only
        tx('payment', 'upi', 150),  // upi tally only
        tx('sale', 'cash', 80),     // cash in
      ],
    })
    expect(r.cashIn).toBe(80)
    expect(r.upiTotal).toBe(350)
    expect(r.expectedCash).toBe(80)
  })

  it('a UPI purchase does not reduce cash', () => {
    const r = computeCashPosition({
      openingCash: 100,
      transactions: [tx('purchase', 'upi', 60)],
    })
    expect(r.cashOut).toBe(0)
    expect(r.expectedCash).toBe(100)
  })

  it('an empty day leaves expected equal to opening', () => {
    const r = computeCashPosition({ openingCash: 250, transactions: [] })
    expect(r).toEqual({ cashIn: 0, cashOut: 0, expectedCash: 250, upiTotal: 0 })
  })
})

describe('cashDifference', () => {
  it('is zero when counted equals expected', () => {
    expect(cashDifference(500, 500)).toBe(0)
  })
  it('is negative when short', () => {
    expect(cashDifference(450, 500)).toBe(-50)
  })
  it('is positive when over', () => {
    expect(cashDifference(530, 500)).toBe(30)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/reports/cashReconciliation.test.ts`
Expected: FAIL with "Failed to resolve import './cashReconciliation'".

- [ ] **Step 3: Write the implementation**

Create `lib/reports/cashReconciliation.ts`:

```typescript
/**
 * FILE: lib/reports/cashReconciliation.ts
 *
 * WHAT THIS DOES:
 *   Pure helpers for the end-of-day cash reconciliation ("Din ka hisab").
 *   computeCashPosition derives the physical-cash position (cash in, cash out,
 *   expected cash) and a separate UPI tally from a day's transactions.
 *   cashDifference compares the counted cash to the expected cash. No DB, no I/O,
 *   so the money logic is unit-tested in isolation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice C cash reconciliation)
 *
 * WHERE IT FITS:
 *   Used by app/api/reconciliation/route.ts (server-side recompute) and the
 *   /reconcile screen (live expected/difference).
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/reconciliation/route.ts, app/(dashboard)/reconcile/page.tsx
 */

export interface CashTxn {
  type: string
  paymentMethod: string | null
  totalAmount: number
}

export interface CashPosition {
  cashIn: number
  cashOut: number
  expectedCash: number
  upiTotal: number
}

const IN_TYPES = new Set(['sale', 'income', 'payment'])
const OUT_TYPES = new Set(['purchase', 'expense'])

export function computeCashPosition(input: {
  openingCash: number
  transactions: CashTxn[]
}): CashPosition {
  const opening = Number(input.openingCash) || 0
  let cashIn = 0
  let cashOut = 0
  let upiTotal = 0

  for (const t of input.transactions) {
    const amount = Number(t.totalAmount) || 0
    const isIn = IN_TYPES.has(t.type)
    const isOut = OUT_TYPES.has(t.type)
    if (t.paymentMethod === 'cash') {
      if (isIn) cashIn += amount
      else if (isOut) cashOut += amount
    } else if (t.paymentMethod === 'upi') {
      if (isIn) upiTotal += amount
    }
  }

  return { cashIn, cashOut, expectedCash: opening + cashIn - cashOut, upiTotal }
}

export function cashDifference(countedCash: number, expectedCash: number): number {
  return (Number(countedCash) || 0) - (Number(expectedCash) || 0)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/reports/cashReconciliation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/cashReconciliation.ts lib/reports/cashReconciliation.test.ts
git commit -m "feat(reports): cash reconciliation position + difference helpers"
```

---

## Task 2: Migration 007 + Prisma model

**Files:**
- Create: `supabase/migrations/007_cash_reconciliations.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/007_cash_reconciliations.sql`:

```sql
-- FILE: supabase/migrations/007_cash_reconciliations.sql
-- WHAT THIS DOES: Adds the cash_reconciliations table for Slice C (end-of-day
--   "Din ka hisab" cash close). One row per store per day; re-closing the same
--   day upserts. Stores snapshots of cash in/out, expected, UPI, and the counted
--   amount so each close is an immutable record. RLS scopes every row to the
--   owning store. DB-level defaults for id and updated_at are required because
--   inserts go through Supabase/PostgREST (which omit them).
--
-- CHANGES THIS SESSION:
--   - New table: cash_reconciliations (+ RLS policies + id/updated_at defaults)
--
-- HOW TO APPLY:
--   Paste this file into the Supabase SQL editor and run.
--   Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS cash_reconciliations (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  store_id      text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date          date NOT NULL,
  opening_cash  numeric(12,2) NOT NULL DEFAULT 0,
  cash_in       numeric(12,2) NOT NULL DEFAULT 0,
  cash_out      numeric(12,2) NOT NULL DEFAULT 0,
  expected_cash numeric(12,2) NOT NULL DEFAULT 0,
  counted_cash  numeric(12,2) NOT NULL DEFAULT 0,
  upi_total     numeric(12,2) NOT NULL DEFAULT 0,
  difference    numeric(12,2) NOT NULL DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cash_reconciliations_store_date_uniq UNIQUE (store_id, date)
);

ALTER TABLE cash_reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_reconciliations_owner_all" ON cash_reconciliations;
CREATE POLICY "cash_reconciliations_owner_all"
  ON cash_reconciliations FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()::text));

-- Verify:
-- SELECT cmd, policyname FROM pg_policies WHERE tablename = 'cash_reconciliations';
```

- [ ] **Step 2: Add the Prisma model**

In `prisma/schema.prisma`, add this model (place it after the `FixedCost` model, before the TRANSACTIONS section comment):

```prisma
model CashReconciliation {
  id           String   @id @default(uuid())
  storeId      String   @map("store_id")
  date         DateTime @db.Date
  openingCash  Decimal  @default(0) @db.Decimal(12, 2) @map("opening_cash")
  cashIn       Decimal  @default(0) @db.Decimal(12, 2) @map("cash_in")
  cashOut      Decimal  @default(0) @db.Decimal(12, 2) @map("cash_out")
  expectedCash Decimal  @default(0) @db.Decimal(12, 2) @map("expected_cash")
  countedCash  Decimal  @default(0) @db.Decimal(12, 2) @map("counted_cash")
  upiTotal     Decimal  @default(0) @db.Decimal(12, 2) @map("upi_total")
  difference   Decimal  @default(0) @db.Decimal(12, 2) @map("difference")
  note         String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at")

  store Store @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@unique([storeId, date])
  @@map("cash_reconciliations")
}
```

- [ ] **Step 3: Add the Store relation**

In the `Store` model's relation list (the block that already lists `transactions Transaction[]`, `fixedCosts FixedCost[]`, etc.), add:

```prisma
  cashReconciliations  CashReconciliation[]
```

- [ ] **Step 4: Validate the Prisma schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_cash_reconciliations.sql prisma/schema.prisma
git commit -m "feat(db): cash_reconciliations table (migration 007)"
```

> **Reminder to surface to the user:** migration 007 must be run manually in the Supabase SQL editor before the reconciliation API works.

---

## Task 3: `GET`/`POST /api/reconciliation`

**Files:**
- Create: `app/api/reconciliation/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/reconciliation/route.ts`:

```typescript
/**
 * FILE: app/api/reconciliation/route.ts
 *
 * WHAT THIS DOES:
 *   GET  - computes the day's cash position (opening carried forward from the
 *          last close, cash in/out, expected, UPI tally) and returns any saved
 *          close for that date.
 *   POST - recomputes the position server-side from the day's transactions
 *          (never trusts client sums) and upserts one cash_reconciliations row
 *          per store per day.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice C cash reconciliation)
 *
 * WHERE IT FITS:
 *   Called by the /reconcile screen.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reconcile/page.tsx, lib/reports/cashReconciliation
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { computeCashPosition, cashDifference, type CashTxn } from '@/lib/reports/cashReconciliation'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function dayTransactions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  storeId: string,
  date: string
): Promise<CashTxn[]> {
  const { data } = await supabase
    .from('transactions')
    .select('type, payment_method, total_amount')
    .eq('store_id', storeId)
    .eq('date', date)
  return (data ?? []).map(t => ({
    type: t.type,
    paymentMethod: t.payment_method,
    totalAmount: Number(t.total_amount),
  }))
}

async function carriedOpening(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  storeId: string,
  date: string
): Promise<number> {
  const { data } = await supabase
    .from('cash_reconciliations')
    .select('counted_cash')
    .eq('store_id', storeId)
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? Number(data.counted_cash) : 0
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const url = new URL(request.url)
  const rawDate = url.searchParams.get('date')
  const date = rawDate && DATE_RE.test(rawDate) ? rawDate : new Date().toISOString().split('T')[0]

  const { data: saved } = await supabase
    .from('cash_reconciliations')
    .select('id, date, opening_cash, cash_in, cash_out, expected_cash, counted_cash, upi_total, difference, note')
    .eq('store_id', store.id)
    .eq('date', date)
    .maybeSingle()

  const opening = saved ? Number(saved.opening_cash) : await carriedOpening(supabase, store.id, date)
  const position = computeCashPosition({ openingCash: opening, transactions: await dayTransactions(supabase, store.id, date) })

  return NextResponse.json({
    date,
    openingCash: opening,
    cashIn: position.cashIn,
    cashOut: position.cashOut,
    expectedCash: position.expectedCash,
    upiTotal: position.upiTotal,
    saved: saved ?? null,
  })
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  let body: { date?: unknown; openingCash?: unknown; countedCash?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const date = typeof body.date === 'string' && DATE_RE.test(body.date)
    ? body.date
    : new Date().toISOString().split('T')[0]

  const openingCash = Number(body.openingCash)
  const countedCash = Number(body.countedCash)
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    return NextResponse.json({ error: 'Enter a valid opening cash amount.' }, { status: 400 })
  }
  if (!Number.isFinite(countedCash) || countedCash < 0) {
    return NextResponse.json({ error: 'Enter a valid counted cash amount.' }, { status: 400 })
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

  // Recompute from transactions; never trust client-sent sums.
  const position = computeCashPosition({ openingCash, transactions: await dayTransactions(supabase, store.id, date) })
  const difference = cashDifference(countedCash, position.expectedCash)

  const { data: saved, error } = await supabase
    .from('cash_reconciliations')
    .upsert(
      {
        store_id: store.id,
        date,
        opening_cash: openingCash,
        cash_in: position.cashIn,
        cash_out: position.cashOut,
        expected_cash: position.expectedCash,
        counted_cash: countedCash,
        upi_total: position.upiTotal,
        difference,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,date' }
    )
    .select('id, date, opening_cash, cash_in, cash_out, expected_cash, counted_cash, upi_total, difference, note')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save the day close' }, { status: 500 })
  return NextResponse.json({ saved })
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/reconciliation/route.ts
git commit -m "feat(api): reconciliation GET position + POST day close"
```

---

## Task 4: `/reconcile` screen

**Files:**
- Create: `app/(dashboard)/reconcile/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/(dashboard)/reconcile/page.tsx`:

```tsx
/**
 * FILE: app/(dashboard)/reconcile/page.tsx
 *
 * WHAT THIS DOES:
 *   The end-of-day "Din ka hisab" close. Shows opening cash (carried forward,
 *   editable), cash in/out today, expected cash in the drawer, a counted-cash
 *   input, the live difference (tally / short / extra), and a separate UPI tally.
 *   Saving posts the close (server recomputes) and shows the confirmation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice C cash reconciliation)
 *
 * WHERE IT FITS:
 *   Route /reconcile. Reached from the dashboard "Din ka hisab" card.
 *
 * CALLED BY / IMPORTS FROM:
 *   dashboard "Din ka hisab" card ; GET/POST /api/reconciliation
 */
'use client'
import { useState, useEffect } from 'react'

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

interface Position {
  date: string
  openingCash: number
  cashIn: number
  cashOut: number
  expectedCash: number
  upiTotal: number
  saved: { counted_cash: number; note: string | null } | null
}

export default function ReconcilePage() {
  const [pos, setPos] = useState<Position | null>(null)
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reconciliation')
      .then(r => r.json())
      .then((d: Position) => {
        setPos(d)
        setOpening(String(d.openingCash ?? 0))
        if (d.saved) {
          setCounted(String(d.saved.counted_cash))
          setNote(d.saved.note ?? '')
        }
        setLoading(false)
      })
      .catch(() => { setError('Could not load the day. Please try again.'); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-700" />
      </div>
    )
  }
  if (!pos) {
    return <div className="px-4 py-16 text-center text-sm text-gray-500">{error ?? 'Something went wrong.'}</div>
  }

  const openingNum = Number(opening) || 0
  const expected = openingNum + pos.cashIn - pos.cashOut
  const countedNum = Number(counted) || 0
  const diff = countedNum - expected
  const hasCount = counted.trim() !== ''

  async function save() {
    if (!hasCount) { setError('Enter the counted cash.'); return }
    setSaving(true)
    setError(null)
    setSavedMsg(false)
    const res = await fetch('/api/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: pos.date, openingCash: openingNum, countedCash: countedNum, note: note.trim() || undefined }),
    })
    if (res.ok) {
      setSavedMsg(true)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to save.')
    }
    setSaving(false)
  }

  const diffTone = diff === 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-600' : 'text-amber-600'
  const diffLabel = diff === 0 ? 'Tally - sahi hai' : diff < 0 ? `Short by ${inr(Math.abs(diff))}` : `Extra ${inr(diff)}`

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white px-4 py-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">Din ka hisab</h1>
        <p className="text-xs text-gray-400 mt-0.5">Close the day. Count the cash drawer and check it against the books.</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">Opening cash (start of day)</label>
          <input
            type="number" inputMode="decimal" min="0" value={opening}
            onChange={e => setOpening(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cash in today</span>
            <span className="font-medium text-emerald-700 tabular-nums">+{inr(pos.cashIn)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cash out today</span>
            <span className="font-medium text-gray-900 tabular-nums">-{inr(pos.cashOut)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="font-medium text-gray-900">Expected in drawer</span>
            <span className="font-bold text-gray-900 tabular-nums">{inr(expected)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">Counted cash (what is actually in the drawer)</label>
          <input
            type="number" inputMode="decimal" min="0" value={counted}
            onChange={e => { setCounted(e.target.value); setSavedMsg(false) }}
            placeholder="0"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          {hasCount && (
            <p className={`text-sm font-semibold ${diffTone}`}>{diffLabel}</p>
          )}
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (optional) - e.g. gave ₹200 to delivery boy"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 flex justify-between text-sm">
          <span className="text-gray-500">UPI received today (not in drawer)</span>
          <span className="font-medium text-gray-900 tabular-nums">{inr(pos.upiTotal)}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {savedMsg && <p className="text-sm font-medium text-emerald-700">Saved. Tomorrow opens with {inr(countedNum)}.</p>}

        <button
          onClick={save} disabled={saving || !hasCount}
          className="btn-lift w-full rounded-xl bg-emerald-700 py-3.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {saving ? 'Saving...' : pos.saved ? 'Update close' : 'Close the day'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; `/reconcile` compiled.

- [ ] **Step 3: Commit**

```bash
git add app/(dashboard)/reconcile/page.tsx
git commit -m "feat(reconcile): Din ka hisab close-the-day screen"
```

---

## Task 5: Dashboard "Din ka hisab" card

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

The dashboard already imports `Link` from `next/link` and renders an `<AttentionCard ... />` in the main column. Add a card link right after it.

- [ ] **Step 1: Add the card after AttentionCard**

In `app/(dashboard)/dashboard/page.tsx`, find:

```tsx
          {/* Consolidated alerts */}
          <AttentionCard lowStockCount={lowStockCount} expiryCount={expiryCount} />
        </div>
```

Replace it with:

```tsx
          {/* Consolidated alerts */}
          <AttentionCard lowStockCount={lowStockCount} expiryCount={expiryCount} />

          {/* Din ka hisab */}
          <Link href="/reconcile"
            className="card-lift flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Din ka hisab</p>
              <p className="text-xs text-gray-400">Close the day - count the cash drawer</p>
            </div>
            <span className="text-emerald-700">&rarr;</span>
          </Link>
        </div>
```

- [ ] **Step 2: Update the file comment block**

Add a `CHANGES THIS SESSION` line to the top of `app/(dashboard)/dashboard/page.tsx` (matching the file's existing comment style):

```
 *   - Slice C: "Din ka hisab" card links to the cash reconciliation screen
```

- [ ] **Step 3: Verify types compile and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): Din ka hisab card links to reconciliation"
```

---

## Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including `lib/reports/cashReconciliation.test.ts`.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with `/reconcile` and `/dashboard` compiled.

- [ ] **Step 4: Manual reasoning checklist (report to the user)**

- Expected cash = opening + cash in (sale/income/payment, cash) - cash out (purchase/expense, cash). Slice A cash `payment` rows count as cash in (roadmap requirement).
- UPI money-in is a separate tally and never enters the drawer math; credit is excluded entirely.
- POST recomputes server-side from transactions; client sums are not trusted.
- Re-closing the same day upserts the single `(store_id, date)` row; opening carries forward from the last close's counted amount.
- Difference: 0 = tally (green), short = red, over = amber; informational, never blocks.

- [ ] **Step 5: Remind the user**

State clearly: "Migration 007 (`supabase/migrations/007_cash_reconciliations.sql`) must be run manually in the Supabase SQL editor before the reconciliation screen can load or save."

---

## Self-Review (completed by plan author)

**Spec coverage:**
- `computeCashPosition` + `cashDifference` with the in/out type sets and UPI tally -> Task 1.
- `cash_reconciliations` table + RLS + Prisma model (migration 007) -> Task 2.
- `GET` (carry-forward opening, computed position, saved row) + `POST` (server recompute, upsert) -> Task 3.
- `/reconcile` screen (opening editable, expected live, counted, difference tone, UPI line, re-close) -> Task 4.
- Dashboard card -> Task 5.

**Type consistency:** `CashTxn`/`CashPosition` defined in Task 1 are imported by Task 3; the GET response shape (`openingCash`, `cashIn`, `cashOut`, `expectedCash`, `upiTotal`, `saved`) is exactly what the Task 4 `Position` interface consumes; the POST body (`date`, `openingCash`, `countedCash`, `note`) matches what the screen sends; column names in the SQL (Task 2), the route selects (Task 3), and the screen's `saved.counted_cash`/`saved.note` reads all align.

**Placeholder scan:** none - every code step has full code.
