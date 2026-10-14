# Findings C: Transactions, inventory, customers, products, entry

Scope for session C: `/entry`, `/transactions`, `/inventory`, `/products`, `/customers`, `/ledger`, and their APIs; `lib/inventory/*`, `lib/transactions/reverse.ts`, `lib/collections/*`.
Core invariants to prove: every sale and purchase moves stock exactly once; void/edit reverses exactly; customer balance equals the sum of credit transactions minus payments; nothing crosses store boundaries.

## Finding C-01
- Area: Transaction atomicity (`app/api/entry/quick`, `app/api/entry/full`, `app/api/transactions/[id]`)
- Severity: P0 until proven otherwise (possible data corruption)
- Status: UNTESTED
- Evidence: Routes write `transactions`, `transaction_items`, `inventory`, `stock_movements`, `customers` through the Supabase client as separate calls (see `audit/logs/deps-by-file.tsv`). Supabase JS has no multi-statement transactions unless an RPC is used; `grep -rn "\.rpc(" app lib` found no RPC.
- Repro steps: Force a failure partway (for example an invalid `product_id` on the second line item, or kill the request) and check for orphan `transactions` rows, stock changed without a movement, or balance changed without a transaction. Fire two concurrent quick-entry requests for the same product and check final stock.
- Suggested fix (do not implement): Move multi-table writes into a Postgres function called via `rpc`, or add compensating logic and idempotency keys.
- Effort: L

## Finding C-02
- Area: Void and edit (`lib/transactions/reverse.ts`, `app/api/transactions/[id]`)
- Severity: P1 until proven otherwise
- Status: PARTIAL
- Evidence: `reverse.test.ts` covers the pure math. The route path (stock, movements, customer balance, `voided_at`) has no test. Migration 005 adds a stock_movements DELETE policy.
- Repro steps: Create a credit sale, void it, check stock, `stock_movements`, `customers.current_balance`. Void twice. Edit quantity up and down.
- Suggested fix (do not implement): n/a until tested.
- Effort: M

## Finding C-03
- Area: snake_case vs camelCase at the fetch boundary
- Severity: P2
- Status: UNTESTED
- Evidence: CLAUDE.md "SESSION LEARNINGS" documents recurring `NaN` bugs from reading camelCase on PostgREST snake_case responses.
- Repro steps: `grep -rn "\.sellingPrice\|\.currentBalance\|\.isPinned" app components`; load every list page with seeded data and look for NaN or undefined.
- Suggested fix (do not implement): One typed mapper per resource at the fetch boundary.
- Effort: M

## Finding C-04
- Area: Inventory intelligence (`lib/inventory/consumption.ts`, `suggestions.ts`)
- Severity: P2 until proven otherwise
- Status: UNTESTED
- Evidence: No tests for either module. Division by zero days, zero stock, and brand-new products are edge cases.
- Repro steps: Seed products with 0 days of history, 1 day, and negative stock; read `/api/inventory/suggest` output.
- Suggested fix (do not implement): n/a until tested.
- Effort: S

## Finding C-05
- Area: Customer credit and payments (`/api/customers/[id]/payment`, `lib/collections/*`)
- Severity: P1 until proven otherwise
- Status: UNTESTED
- Evidence: Aging and reminder logic tested; payment route not.
- Repro steps: Pay more than the balance, pay zero, pay negative, pay for another store's customer id.
- Suggested fix (do not implement): n/a until tested.
- Effort: S

## Finding C-06
- Area: Hover, cursor, and touch-target rules from CLAUDE.md
- Severity: P3
- Status: UNTESTED
- Evidence: Rules 2 and 3 in CLAUDE.md (cursor pointer, lift and shadow utilities).
- Repro steps: Grep for `onClick` on non-button elements without `btn-lift`, `row-lift`, or `card-lift`; check on a 360 px wide viewport.
- Suggested fix (do not implement): n/a until tested.
- Effort: S
