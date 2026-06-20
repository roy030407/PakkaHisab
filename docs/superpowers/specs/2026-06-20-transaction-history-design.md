# Transaction History - Design Spec

## Problem

After a merchant saves a sale (via scan, voice, or manual entry), the transaction
disappears into the database with no way to review, verify, or void it from the
dashboard. Mistakes require database-level fixes.

## Solution

A "Recent Transactions" section on the dashboard showing today's activity. Each
row is tappable to expand and see line items. Voiding a transaction soft-deletes
it (sets `voided_at`) and reverses all side effects (inventory, customer balance).

## Decisions

- **Void, not edit.** Correcting a transaction = void it + re-enter. This is the
  standard pattern in Indian accounting (Tally, khata books). Editing individual
  items on a saved transaction requires recalculating stock movements, tax, and
  totals, which is error-prone.
- **Soft delete via `voided_at`.** The transaction row stays in the database with
  a timestamp. All queries exclude voided rows by default. Voided rows appear
  struck-through at the bottom of the recent list for audit trail.
- **Dashboard section, not a separate page.** The merchant's daily workflow is
  dashboard-centric. A full /transactions page is a future addition if needed.

## Schema Change

Add one column to the `transactions` table:

```sql
ALTER TABLE transactions ADD COLUMN voided_at TIMESTAMPTZ DEFAULT NULL;
```

All existing transaction queries (reports, dashboard stats, reconciliation) must
add `AND voided_at IS NULL` to exclude voided rows.

## API

### GET /api/transactions (new)

List transactions for the store, newest first.

Query params:
- `date` (optional, default: today in IST, format: YYYY-MM-DD)
- `type` (optional, filter: sale | purchase | expense | income)
- `includeVoided` (optional, default: true for the dashboard view)
- `limit` (optional, default: 20)

Response: array of transactions with nested item count and customer name.

```json
{
  "transactions": [
    {
      "id": "uuid",
      "date": "2026-06-20",
      "type": "sale",
      "totalAmount": 450,
      "paymentMethod": "cash",
      "source": "manual_quick",
      "customerName": null,
      "itemCount": 3,
      "itemSummary": "Doodh, Parle-G, +1 more",
      "createdAt": "2026-06-20T10:30:00Z",
      "voidedAt": null
    }
  ]
}
```

### PATCH /api/transactions/[id] (new)

Void a transaction. Sets `voided_at` to now, reverses inventory and customer
balance using the existing `inventoryReversals` and `balanceReversalAmount` logic
from `lib/transactions/reverse.ts`.

Request body: `{ "action": "void" }`

Response: `{ "voided": true }`

The existing DELETE endpoint stays unchanged for backward compatibility
(CustomerLedger uses it).

## Dashboard UI

### RecentTransactions component

Position: below the stat cards, above the quick-action buttons.

**Collapsed row:**
```
[Sale pill]  Doodh, Parle-G, +1 more     Rs.450   10:30 AM
             cash                                  [chevron]
```

**Expanded row (tap to toggle):**
```
[Sale pill]  Doodh, Parle-G, +1 more     Rs.450   10:30 AM
             cash                                  [chevron-up]
  2 x Doodh                               Rs.100
  3 x Parle-G                             Rs.30
  1 x Bread                               Rs.40
                                    [Void button]
```

**Voided row (struck-through, at the bottom):**
```
[Voided badge]  ~~Doodh, Parle-G~~     ~~Rs.450~~   10:30 AM
```

### Type pills
- Sale: emerald background
- Purchase: blue background
- Expense: amber background
- Income: violet background
- Voided: gray background with "Voided" text

### Void flow
1. Tap "Void" button on expanded row
2. Confirm dialog: "Void this Rs.450 sale? Stock will be restored."
3. On confirm: PATCH /api/transactions/[id] with { action: "void" }
4. Row animates to struck-through and moves to the bottom
5. Toast: "Transaction voided. Stock restored."

### Empty state
"No transactions today. Start selling!"

## Queries to Update

These existing queries need `voided_at IS NULL` added:
- Dashboard stat aggregation (dashboard/page.tsx server fetch)
- Reports route (api/reports/route.ts)
- Reconciliation route (api/reconciliation/route.ts)
- AI chat context builder
- AI insight generator
- Weekly/monthly cron reports

## Files to Create/Modify

**New:**
- `app/api/transactions/route.ts` (GET - list transactions)
- `app/api/transactions/[id]/route.ts` (add PATCH for void)
- `components/dashboard/RecentTransactions.tsx` (client component)
- `prisma/migrations/XXX_add_voided_at/migration.sql`

**Modify:**
- `app/(dashboard)/dashboard/page.tsx` (add server fetch + render component)
- `prisma/schema.prisma` (add voidedAt field)
- Existing query files (add voided_at IS NULL filter)
