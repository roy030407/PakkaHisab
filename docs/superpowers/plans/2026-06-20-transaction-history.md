# Transaction History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Recent Transactions" section to the dashboard with tap-to-expand detail rows, soft-delete (void) with inventory/balance reversal, and filter voided rows out of all existing queries.

**Architecture:** Add a `voided_at` nullable timestamp column to transactions. New GET /api/transactions lists today's transactions. New PATCH /api/transactions/[id] voids a transaction (sets voided_at, reverses inventory + balance using existing pure helpers). A client-side RecentTransactions component renders on the server-fetched dashboard page. All existing transaction reads get `.is('voided_at', null)` added.

**Tech Stack:** Next.js 14 App Router, Supabase (PostgreSQL + RLS), Prisma migrations, TypeScript strict, Tailwind CSS, shadcn/ui, lucide-react icons.

## Global Constraints

- No em dashes anywhere. Use commas, periods, hyphens with spaces, or parentheses.
- Every clickable element: `cursor: pointer`. Disabled: `cursor: not-allowed`.
- Every interactive element has a visible hover state using the project's lift utilities (`btn-lift`, `row-lift`, `card-lift`).
- Every file must have the project file comment block (see CLAUDE.md).
- Never `SELECT *`. Always name columns.
- All DB writes via parameterised queries (Supabase client handles this).
- Normalize snake_case Supabase responses to camelCase at the fetch boundary.

---

### Task 1: Migration + Prisma schema - add voided_at column

**Files:**
- Create: `prisma/migrations/XXXXXX_add_voided_at_to_transactions/migration.sql`
- Modify: `prisma/schema.prisma:179-204` (Transaction model)

**Interfaces:**
- Produces: `voided_at` column on `transactions` table (nullable `TIMESTAMPTZ`, default `NULL`)

- [ ] **Step 1: Add voidedAt to the Prisma Transaction model**

In `prisma/schema.prisma`, inside the `Transaction` model (line 179), add `voidedAt` between `notes` and `createdAt`:

```prisma
  notes            String?
  voidedAt         DateTime? @map("voided_at") @db.Timestamptz
  createdAt        DateTime  @default(now()) @map("created_at")
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
npx prisma migrate dev --name add_voided_at_to_transactions
```

Expected: migration created, `prisma/migrations/XXXXXX_add_voided_at_to_transactions/migration.sql` containing:
```sql
ALTER TABLE "transactions" ADD COLUMN "voided_at" TIMESTAMPTZ;
```

- [ ] **Step 3: Verify the migration applied**

Run:
```bash
npx prisma migrate status
```

Expected: all migrations applied, no pending.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add voided_at column to transactions for soft delete"
```

---

### Task 2: GET /api/transactions - list endpoint

**Files:**
- Create: `app/api/transactions/route.ts`

**Interfaces:**
- Produces: `GET /api/transactions?date=YYYY-MM-DD&includeVoided=true&limit=20` returns `{ transactions: TransactionListItem[] }`

Each `TransactionListItem`:
```typescript
{
  id: string
  date: string
  type: string
  totalAmount: number
  paymentMethod: string | null
  source: string
  customerName: string | null
  itemCount: number
  itemSummary: string
  createdAt: string
  voidedAt: string | null
}
```

- [ ] **Step 1: Create the route file**

Create `app/api/transactions/route.ts`:

```typescript
/**
 * FILE: app/api/transactions/route.ts
 *
 * WHAT THIS DOES:
 *   GET - lists transactions for the authenticated store, newest first.
 *   Supports date filter (default: today IST), includeVoided flag, and limit.
 *   Returns each transaction with item count and a short item summary string.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (transaction history feature)
 *
 * WHERE IT FITS:
 *   Called by components/dashboard/RecentTransactions.tsx on the dashboard.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/dashboard/RecentTransactions.tsx
 */
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ transactions: [] })

  const url = new URL(request.url)
  const date = url.searchParams.get('date') || todayIST()
  const includeVoided = url.searchParams.get('includeVoided') !== 'false'
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50)

  let query = supabase
    .from('transactions')
    .select('id, date, type, total_amount, payment_method, source, customer_id, vendor_name, created_at, voided_at')
    .eq('store_id', store.id)
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!includeVoided) {
    query = query.is('voided_at', null)
  }

  const { data: txRows } = await query
  if (!txRows || txRows.length === 0) return NextResponse.json({ transactions: [] })

  const txIds = txRows.map(t => t.id)

  // Batch-load items and customer names
  const [itemsResult, customerIds] = await Promise.all([
    supabase
      .from('transaction_items')
      .select('transaction_id, product_name_raw')
      .in('transaction_id', txIds),
    Promise.resolve(
      [...new Set(txRows.filter(t => t.customer_id).map(t => t.customer_id!))]
    ),
  ])

  let customerMap: Record<string, string> = {}
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)
    for (const c of customers ?? []) customerMap[c.id] = c.name
  }

  // Group items by transaction
  const itemsByTx: Record<string, string[]> = {}
  for (const item of itemsResult.data ?? []) {
    const list = itemsByTx[item.transaction_id] ?? []
    list.push(item.product_name_raw || 'Item')
    itemsByTx[item.transaction_id] = list
  }

  const transactions = txRows.map(tx => {
    const names = itemsByTx[tx.id] ?? []
    const itemCount = names.length
    let itemSummary = ''
    if (itemCount === 0) {
      itemSummary = tx.type === 'expense' ? 'Expense' : tx.type === 'income' ? 'Income' : ''
    } else if (itemCount <= 2) {
      itemSummary = names.join(', ')
    } else {
      itemSummary = `${names[0]}, ${names[1]}, +${itemCount - 2} more`
    }

    return {
      id: tx.id,
      date: tx.date,
      type: tx.type,
      totalAmount: Number(tx.total_amount) || 0,
      paymentMethod: tx.payment_method,
      source: tx.source,
      customerName: tx.customer_id ? (customerMap[tx.customer_id] ?? null) : null,
      itemCount,
      itemSummary,
      createdAt: tx.created_at,
      voidedAt: tx.voided_at,
    }
  })

  return NextResponse.json({ transactions })
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server, hit `GET /api/transactions` in the browser (while logged in). Expect a JSON response with `{ transactions: [...] }` (may be empty if no transactions today).

- [ ] **Step 4: Commit**

```bash
git add app/api/transactions/route.ts
git commit -m "feat(api): GET /api/transactions - list with item summary and voided support"
```

---

### Task 3: PATCH /api/transactions/[id] - void endpoint

**Files:**
- Modify: `app/api/transactions/[id]/route.ts` (add PATCH handler)

**Interfaces:**
- Consumes: `inventoryReversals` and `balanceReversalAmount` from `lib/transactions/reverse.ts` (same as existing DELETE)
- Produces: `PATCH /api/transactions/:id` with body `{ "action": "void" }` returns `{ voided: true }`

- [ ] **Step 1: Add the PATCH handler to the existing route file**

Add this function to `app/api/transactions/[id]/route.ts` after the existing `GET` handler:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (body.action !== 'void') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: tx } = await supabase
    .from('transactions')
    .select('id, type, total_amount, customer_id, payment_method, voided_at')
    .eq('id', params.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  if (tx.voided_at) return NextResponse.json({ error: 'Already voided' }, { status: 409 })

  // Reverse inventory
  const { data: lineItems } = await supabase
    .from('transaction_items')
    .select('product_id, quantity')
    .eq('transaction_id', tx.id)

  const reversals = inventoryReversals(
    tx.type as TransactionType,
    (lineItems ?? []).map(li => ({ productId: li.product_id, quantity: Number(li.quantity) }))
  )
  for (const r of reversals) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, current_stock')
      .eq('store_id', store.id)
      .eq('product_id', r.productId)
      .maybeSingle()
    if (inv) {
      await supabase
        .from('inventory')
        .update({
          current_stock: Number(inv.current_stock) + r.delta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id)
    }
  }

  // Reverse customer balance
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

  // Set voided_at (soft delete)
  const { error: voidError } = await supabase
    .from('transactions')
    .update({ voided_at: new Date().toISOString() })
    .eq('id', tx.id)
    .eq('store_id', store.id)

  if (voidError) return NextResponse.json({ error: 'Failed to void transaction' }, { status: 500 })

  return NextResponse.json({ voided: true })
}
```

Also update the file comment block's CHANGES THIS SESSION:
```
 *   - Void endpoint (PATCH): soft-deletes via voided_at, reverses inventory + balance
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/transactions/[id]/route.ts
git commit -m "feat(api): PATCH /api/transactions/[id] - void with inventory + balance reversal"
```

---

### Task 4: Add voided_at filter to all existing transaction queries

**Files to modify** (add `.is('voided_at', null)` to each transaction SELECT query):

- `app/(dashboard)/dashboard/page.tsx:64` - stat card aggregation
- `app/api/dashboard/route.ts:40`
- `app/api/reconciliation/route.ts:33` - `dayTransactions` helper
- `lib/reports/buildReport.ts:46` - report data
- `app/api/transactions/last/route.ts:29`
- `app/api/customers/route.ts:37,54` - customer transaction counts
- `app/api/customers/[id]/route.ts:41` - customer ledger
- `app/api/inventory/route.ts:140`
- `lib/anthropic/advisor.ts:52` - AI chat context
- `lib/scan/resolve.ts:39` - scan frequency lookup
- `app/api/scan/route.ts:155` - duplicate detection
- `app/api/voice/parse/route.ts:171` - voice frequency lookup

**Interfaces:**
- Consumes: `voided_at` column from Task 1
- Produces: all reads exclude voided transactions

- [ ] **Step 1: Add the filter to each file**

For every file listed above, find the `.from('transactions')` query chain and add `.is('voided_at', null)` right after the `.eq('store_id', ...)` filter. The pattern:

Before:
```typescript
.from('transactions')
.select('...')
.eq('store_id', storeId)
.gte('date', ...)
```

After:
```typescript
.from('transactions')
.select('...')
.eq('store_id', storeId)
.is('voided_at', null)
.gte('date', ...)
```

Apply this to all 12 files listed above.

For `app/api/scan/route.ts:155`, the duplicate detection query should ALSO exclude voided transactions (a voided duplicate is not a real duplicate).

For `app/api/transactions/[id]/route.ts`, do NOT add the filter to the existing DELETE or GET handlers (they need to see all transactions including voided ones - the GET is used for receipt sharing and the DELETE hard-deletes).

- [ ] **Step 2: Verify all files compile**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run existing tests to check for regressions**

Run:
```bash
npx vitest run
```

Expected: all tests pass (the pure logic tests do not hit the database, so the new column does not affect them).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: exclude voided transactions from all read queries"
```

---

### Task 5: RecentTransactions client component + dashboard integration

**Files:**
- Create: `components/dashboard/RecentTransactions.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx` (add server fetch + render the component)

**Interfaces:**
- Consumes: `GET /api/transactions` from Task 2, `PATCH /api/transactions/[id]` from Task 3
- Produces: `<RecentTransactions />` component rendered on the dashboard

- [ ] **Step 1: Create the RecentTransactions component**

Create `components/dashboard/RecentTransactions.tsx`:

```typescript
/**
 * FILE: components/dashboard/RecentTransactions.tsx
 *
 * WHAT THIS DOES:
 *   Client component that renders a list of today's transactions on the
 *   dashboard. Each row is tappable to expand and show line items. A "Void"
 *   button on the expanded view soft-deletes the transaction and reverses
 *   inventory + balance via PATCH /api/transactions/[id].
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (transaction history feature)
 *
 * WHERE IT FITS:
 *   Rendered inside app/(dashboard)/dashboard/page.tsx, below the stat cards.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Ban } from 'lucide-react'

interface TransactionRow {
  id: string
  date: string
  type: string
  totalAmount: number
  paymentMethod: string | null
  source: string
  customerName: string | null
  itemCount: number
  itemSummary: string
  createdAt: string
  voidedAt: string | null
}

interface LineItem {
  product_name_raw: string
  quantity: number
  unit_price: number
  total_price: number
}

const TYPE_STYLES: Record<string, string> = {
  sale: 'bg-emerald-100 text-emerald-800',
  purchase: 'bg-blue-100 text-blue-800',
  expense: 'bg-amber-100 text-amber-800',
  income: 'bg-violet-100 text-violet-800',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

export function RecentTransactions() {
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/transactions')
      .then(r => r.json())
      .then(d => setRows(d.transactions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setLineItems([])
      setConfirmVoidId(null)
      return
    }
    setExpandedId(id)
    setConfirmVoidId(null)
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/transactions/${id}`)
      if (res.ok) {
        const data = await res.json()
        setLineItems(data.items ?? [])
      }
    } catch { /* ignore */ }
    setLoadingItems(false)
  }, [expandedId])

  const voidTransaction = useCallback(async (id: string) => {
    setVoidingId(id)
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      })
      if (res.ok) {
        setRows(prev => prev.map(r =>
          r.id === id ? { ...r, voidedAt: new Date().toISOString() } : r
        ))
        setExpandedId(null)
        setConfirmVoidId(null)
      }
    } catch { /* ignore */ }
    setVoidingId(null)
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-400">
        Loading transactions...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No transactions today. Start selling!
      </div>
    )
  }

  // Active first, voided at the bottom
  const sorted = [...rows].sort((a, b) => {
    if (a.voidedAt && !b.voidedAt) return 1
    if (!a.voidedAt && b.voidedAt) return -1
    return 0
  })

  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold text-gray-700 px-1">Today&apos;s transactions</h2>
      <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
        {sorted.map(tx => {
          const isVoided = !!tx.voidedAt
          const isExpanded = expandedId === tx.id
          const isConfirming = confirmVoidId === tx.id

          return (
            <div key={tx.id}>
              <button
                type="button"
                onClick={() => toggleExpand(tx.id)}
                className={`row-lift w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer ${
                  isVoided ? 'opacity-50' : ''
                }`}
              >
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  isVoided ? 'bg-gray-100 text-gray-500' : (TYPE_STYLES[tx.type] ?? 'bg-gray-100 text-gray-600')
                }`}>
                  {isVoided ? 'Voided' : tx.type}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${isVoided ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {tx.itemSummary || tx.type}
                  </p>
                  <p className="text-xs text-gray-400">
                    {tx.paymentMethod ?? ''}{tx.customerName ? ` - ${tx.customerName}` : ''}
                  </p>
                </div>

                <span className={`shrink-0 text-sm font-semibold tabular-nums ${
                  isVoided ? 'line-through text-gray-400' : 'text-gray-900'
                }`}>
                  &#8377;{tx.totalAmount}
                </span>

                <span className="shrink-0 text-xs text-gray-400 w-16 text-right">
                  {formatTime(tx.createdAt)}
                </span>

                <span className="shrink-0 text-gray-300">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-0 space-y-2">
                  {loadingItems ? (
                    <p className="text-xs text-gray-400 pl-2">Loading items...</p>
                  ) : lineItems.length > 0 ? (
                    <div className="rounded-lg bg-gray-50 divide-y divide-gray-100">
                      {lineItems.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                          <span className="text-gray-700">
                            {Number(item.quantity)} x {item.product_name_raw || 'Item'}
                          </span>
                          <span className="font-medium tabular-nums text-gray-700">
                            &#8377;{Number(item.total_price)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 pl-2">No line items</p>
                  )}

                  {!isVoided && (
                    <div className="flex justify-end">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-rose-600">Stock will be restored. Void?</span>
                          <button
                            type="button"
                            onClick={() => voidTransaction(tx.id)}
                            disabled={voidingId === tx.id}
                            className="btn-lift rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                          >
                            {voidingId === tx.id ? 'Voiding...' : 'Yes, void'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmVoidId(null)}
                            className="btn-lift rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmVoidId(tx.id)}
                          className="btn-lift inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 cursor-pointer"
                        >
                          <Ban size={12} /> Void
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the component to the dashboard page**

In `app/(dashboard)/dashboard/page.tsx`:

Add the import at the top:
```typescript
import { RecentTransactions } from "@/components/dashboard/RecentTransactions"
```

Place `<RecentTransactions />` inside the left column `<div className="space-y-4">`, after the `AttentionCard` and before the "Scan your khata" link:

```tsx
          {/* Consolidated alerts */}
          <AttentionCard lowStockCount={lowStockCount} expiryCount={expiryCount} />

          {/* Recent transactions */}
          <RecentTransactions />

          {/* Scan your khata */}
```

Update the file comment block CHANGES THIS SESSION:
```
 *   - Added RecentTransactions section (transaction history feature)
```

- [ ] **Step 3: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test in the browser**

Open `http://localhost:3000/dashboard`. Verify:
1. "Today's transactions" section appears below alerts
2. If transactions exist, rows show with type pill, item summary, amount, time
3. Tapping a row expands it to show line items
4. "Void" button appears on expanded rows
5. Void confirmation flow works (confirm dialog, then struck-through at bottom)
6. Empty state shows when no transactions today
7. All hover states work (row-lift on rows, btn-lift on buttons)

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RecentTransactions.tsx app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): recent transactions section with expand + void"
```
