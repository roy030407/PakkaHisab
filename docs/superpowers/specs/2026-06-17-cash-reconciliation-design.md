# Slice C - End-of-Day Cash Reconciliation ("Din ka hisab") - Design Spec

Date: 2026-06-17
Status: Approved (pending spec review)
Owner: Roy Harwani

## Problem

A shopkeeper has no fast way to check, at close, whether the cash in the drawer
matches what the day's transactions say it should be. Mistakes, unrecorded
spends, and theft go unnoticed. The app already records sales, purchases,
expenses, and (Slice A) customer repayments, so it can compute the expected cash
and compare it to a physical count.

## Goal

A one-tap daily "Din ka hisab" close: show expected cash in the drawer (opening
float + cash in - cash out) versus the actual cash counted, flag the gap, show a
separate UPI tally, and save the close so tomorrow's opening carries forward.

## Decisions (from brainstorm)

| Topic | Decision |
| --- | --- |
| What is reconciled | The physical cash drawer only. UPI is shown as a separate informational tally, not counted. Credit moves no cash and is excluded. |
| Opening cash | Carries forward: today's opening defaults to the last saved close's counted amount (editable). |
| History | Each close is persisted (one row per store per day; re-close upserts). New table, migration 007. |
| Placement | A "Din ka hisab" card on the dashboard opens a dedicated /reconcile screen. |
| Money-in types | sale, income, payment (Slice A repayments). |
| Money-out types | purchase, expense. |
| Integrity | The POST recomputes the position server-side from transactions; client-sent sums are never trusted. |

## Pure helper (testable, no DB)

`lib/reports/cashReconciliation.ts`

```
type CashTxn = { type: string; paymentMethod: string | null; totalAmount: number }

interface CashPosition {
  cashIn: number        // cash money-in (sale/income/payment, method = cash)
  cashOut: number       // cash money-out (purchase/expense, method = cash)
  expectedCash: number  // openingCash + cashIn - cashOut
  upiTotal: number      // money-in with method = upi (informational)
}

computeCashPosition(input: { openingCash: number; transactions: CashTxn[] }): CashPosition

cashDifference(countedCash: number, expectedCash: number): number  // counted - expected
```

Rules:
- `IN_TYPES = ['sale', 'income', 'payment']`, `OUT_TYPES = ['purchase', 'expense']`.
- `cashIn` = sum of `totalAmount` for rows where `type in IN_TYPES` and `paymentMethod === 'cash'`.
- `cashOut` = sum for rows where `type in OUT_TYPES` and `paymentMethod === 'cash'`.
- `expectedCash` = `openingCash + cashIn - cashOut`.
- `upiTotal` = sum for rows where `type in IN_TYPES` and `paymentMethod === 'upi'`.
- `credit` rows and any other payment method are ignored for cash and UPI.
- All sums coerce with `Number(...) || 0`; `openingCash` defaults to 0 if not finite.
- `cashDifference` = `countedCash - expectedCash` (negative = short, positive = over).

This helper carries the slice's logic risk and is the unit-tested core.

## Data model - new table `cash_reconciliations` (migration 007)

```
cash_reconciliations
  id            uuid pk default
  store_id      uuid/text fk -> stores
  date          date            -- the business day being closed
  opening_cash  numeric default 0
  cash_in       numeric default 0   -- snapshot at close
  cash_out      numeric default 0   -- snapshot at close
  expected_cash numeric default 0   -- snapshot at close
  counted_cash  numeric default 0
  upi_total     numeric default 0   -- snapshot at close
  difference    numeric default 0   -- counted_cash - expected_cash
  note          text null
  created_at    timestamptz default now()
  updated_at    timestamptz default now()

  UNIQUE (store_id, date)
```

- Snapshots (cash_in/out, expected, upi) are stored so the close is an immutable
  record even if transactions are later edited.
- RLS: store-scoped (`store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())`),
  policies for SELECT/INSERT/UPDATE/DELETE. Migration also adds the table to the
  Prisma schema (`CashReconciliation` model).

## API

`GET /api/reconciliation?date=YYYY-MM-DD` (date optional, defaults to today)
- Auth + store scope.
- Computes the position for the day from that day's transactions
  (`computeCashPosition`).
- `openingCash`: the `counted_cash` of the most recent saved reconciliation with
  `date < target` for this store, else 0.
- Returns `{ date, openingCash, cashIn, cashOut, expectedCash, upiTotal,
  saved }` where `saved` is the existing `cash_reconciliations` row for that date
  (or null) so the screen can prefill counted/note and show it was already closed.

`POST /api/reconciliation`
- Body `{ date?, openingCash, countedCash, note? }`.
- Validates: `openingCash` and `countedCash` are finite numbers >= 0; `date` (if
  given) is YYYY-MM-DD, else today.
- Recomputes `cashIn/cashOut/expectedCash/upiTotal` server-side from the day's
  transactions (does NOT trust any client-sent sums), using the posted
  `openingCash`.
- Upserts the `cash_reconciliations` row on `(store_id, date)` with the snapshot
  values, `counted_cash`, `difference = countedCash - expectedCash`, and `note`.
- Returns the saved row.

Queries name columns explicitly (no SELECT *) and are scoped to `store_id`.

## UI

### Dashboard (MODIFY) - `app/(dashboard)/dashboard/page.tsx`
Add a "Din ka hisab" card (close the day) that links to `/reconcile`. Plain-language
subtitle, hover lift, pointer cursor.

### Reconcile screen (NEW) - `app/(dashboard)/reconcile/page.tsx`
- On load, GET `/api/reconciliation`. Show:
  - Opening cash (prefilled from carry-forward, editable amount input).
  - Cash in today, Cash out today (read-only, from the API).
  - Expected cash in drawer (computed = opening + in - out, updates live if
    opening is edited).
  - Counted cash (amount input the shopkeeper types after counting the drawer).
  - Difference (live = counted - expected): 0 = green "Tally / Sahi hai", negative
    = red "Short by Rs X", positive = amber "Extra Rs X".
  - UPI received today (separate, informational line).
  - Optional note (e.g. "gave Rs 200 to delivery boy").
  - Save / "Close the day" button -> POST, then show the saved confirmation.
- If the day is already closed (`saved` present), prefill counted/note from it and
  label the action "Update close".
- Loading and empty states are helpful (never blank); errors are plain language.

### Components
Keep the screen focused. A small read-only summary row and the two amount inputs
can live inline in the page; extract a `components/reports/CashTallyRow` only if it
reduces duplication. No `+/-` steppers (counted cash is a single typed amount, not
a quantity).

## Error handling / edge cases

- No transactions today -> cashIn/cashOut = 0, expected = opening.
- No prior close ever -> opening defaults to 0.
- Re-close the same day -> upsert (one row per store per day).
- Counted < expected -> short (red); counted > expected -> over (amber); equal ->
  tally (green). No threshold, no blocking; the gap is informational.
- Negative inputs rejected (400). Non-numeric rejected (400).
- Day boundary: the business day is the `date` value (store-local calendar day);
  default is the server's current date in `YYYY-MM-DD`.

## Testing

Unit tests (vitest) for `lib/reports/cashReconciliation.ts`:
- `computeCashPosition`: cash in across sale/income/payment; cash out across
  purchase/expense; credit excluded; UPI tally separate; mixed-method day; empty
  day (expected = opening); opening float applied.
- `cashDifference`: short, over, exact tally.

## Out of scope (future)

- Multiple drawers / registers / shifts.
- Bank or UPI reconciliation against statements.
- Denomination breakdown (counting by note value).
- Linking a flagged gap to an auto-created "cash adjustment" expense.

## Open questions

None.
