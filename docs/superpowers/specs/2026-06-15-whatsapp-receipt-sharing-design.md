# Slice B - WhatsApp Receipt / Bill Sharing - Design Spec

Date: 2026-06-15
Status: Approved (pending spec review)
Owner: Roy Harwani

## Problem

After making a sale (typed in manually or scanned), a shopkeeper has no fast way
to give the customer a record of it. Paper receipts are slow and most customers
would rather get the bill on WhatsApp. Slice A added a wa.me helper for reminders;
this slice reuses it to turn any sale into a one-tap WhatsApp receipt.

## Goal

Let the shopkeeper share a plain-text receipt of a sale on WhatsApp in one tap,
from the moment of sale and later from the customer ledger, with no WhatsApp
Business API and no cost (wa.me links), and a graceful fallback when there is no
phone number.

## Decisions (from brainstorm)

| Topic | Decision |
| --- | --- |
| Receipt format | Plain text message (no web page, no image). Reuses Slice A's wa.me text pattern. |
| Recipient | Phone present -> prefilled wa.me message the shopkeeper reviews and sends. No phone -> copy the receipt text to the clipboard with a "paste into WhatsApp" toast. |
| Detail level | Itemised everywhere. The receipt is always built by fetching the saved transaction with its items (single source of truth). |
| What can be shared | Sale transactions only. A receipt is goods-out to a customer; purchases, expenses, income, and payments are not shared. |
| Architecture | Every Share button builds the receipt from a new `GET /api/transactions/[id]` (items + customer phone/balance). Save handlers capture the returned `transactionId`. This removes any need to assemble receipt data in memory and keeps one code path. |
| Scan handling | Scans are currently purchases (vendor, not customer). To share after a scan, the scan flow gains a Purchase/Sale toggle so a scanned bill can be a sale. This is the larger, independent part and is built as Phase B2 after the core. |
| Build structure | One spec, two phases. Phase B1 (core: manual-sale save + ledger) ships first; Phase B2 (scan-as-sale) builds on it. Each phase is independently shippable. |
| Data model | No migration. No new tables or columns. One new GET route in B1; the scan confirm route is extended in B2. |

## Pure helper (testable, no DB) - Phase B1

`lib/share/receipt.ts`

```
interface ReceiptItem { name: string; quantity: number; lineTotal: number }

interface ReceiptInput {
  shopName: string
  date: string            // ISO timestamp or YYYY-MM-DD
  items: ReceiptItem[]    // may be empty
  total: number
  paymentMethod: string   // 'cash' | 'upi' | 'credit'
  balanceAfter?: number | null  // customer balance after this sale (credit only)
  customerName?: string | null
}

buildReceiptText(input: ReceiptInput): string
```

Formatting rules (deterministic, so unit tests are environment-stable):
- Date rendered as `DD Mon YYYY` using a fixed month array (not the host locale),
  e.g. `15 Jun 2026`. A malformed/empty date renders an empty date line.
- Amounts rendered with the rupee sign and Indian grouping via
  `Number(n).toLocaleString('en-IN')`, e.g. `₹1,200`.
- Layout:
  ```
  {shopName}
  {date}
  --------------------
  {qty} x {name} - ₹{lineTotal}      (one line per item; the whole block is omitted if no items)
  --------------------
  Total: ₹{total}
  {paymentLine}
  {balanceLine}                      (only when balanceAfter is a finite number)

  Dhanyavaad! - {shopName}
  ```
- `paymentLine`:
  - cash/upi -> `Paid: ₹{total} ({paymentMethod})`
  - credit  -> `Udhaar: ₹{total}`
- `balanceLine` (credit sale with a known customer balance) ->
  `Balance: ₹{balanceAfter}`.
- The helper never throws on missing optional fields; it omits those lines.

This helper carries the slice's logic risk and is the unit-tested core. The wa.me
URL building and phone normalization are already covered by Slice A
(`lib/collections/reminder.ts` `buildWhatsappUrl`) and are reused unchanged.

## Component - Phase B1

`components/share/ShareReceiptButton.tsx` (client)

Props:
- `transactionId: string` - the saved sale to build a receipt for.
- `shopName: string` - passed in by the host (hosts already fetch the store).
- `variant?: 'prominent' | 'compact'` - prominent button for the save screen,
  compact icon for ledger rows.
- `className?: string` (optional override).

Behaviour on click:
1. `GET /api/transactions/${transactionId}` -> `{ transaction, items, customer }`.
2. Map into `ReceiptInput` (shopName from prop; date/total/paymentMethod from the
   transaction; items mapped to `{ name, quantity, lineTotal }`; `customerName` and
   `balanceAfter` from the customer when present and the sale is on credit).
3. `const text = buildReceiptText(input)`.
4. `const url = buildWhatsappUrl(customer?.phone, text)` (Slice A helper).
5. If `url` -> `window.open(url, '_blank', 'noopener,noreferrer')`.
6. Else -> `navigator.clipboard.writeText(text)` then a toast
   "Receipt copied - paste it into WhatsApp." If clipboard is unavailable/denied,
   show the text in a small selectable box as a last resort.

The button shows a brief loading state while fetching and a plain-language error
toast if the fetch fails (it does not open WhatsApp on failure).

## API - Phase B1

`GET /api/transactions/[id]` (NEW handler on the existing
`app/api/transactions/[id]/route.ts`, which currently only has DELETE)

- Auth + store scope (same pattern as the existing DELETE).
- Returns:
  - `transaction`: `id, date, type, total_amount, payment_method, customer_id, vendor_name`
  - `items`: from `transaction_items` -> `product_name_raw, quantity, unit_price, total_price`
  - `customer`: when `customer_id` is set -> `name, phone, current_balance` (else null)
- Never SELECT *; columns named explicitly; scoped to the owner's store.
- Returns 404 if the transaction is not in the owner's store.

## UI wiring - Phase B1

### QuickEntry (`components/entry/QuickEntry.tsx`)
`handleSave` currently discards the response. Capture `transactionId` from the
`{ transactionId }` response. After a `sale` saves, show a brief success state
(total + a prominent ShareReceiptButton and a "Done" button) instead of dismissing
immediately; "Done" calls the existing `onSaved()`. Expense/income keep the current
immediate behaviour (no share).

### FullEntryForm (`components/entry/FullEntryForm.tsx`)
Same: capture `transactionId` from the `/api/entry/full` response, and show the
post-save share affordance for `sale` saves only. The form already fetches the
store list for products; the store name is fetched on mount for `shopName`.

### CustomerLedger (`components/customers/CustomerLedger.tsx`)
Add a compact ShareReceiptButton on `sale` rows (next to the existing delete
control), passing that row's `transactionId`. The ledger already fetches the store
name (Slice A) for `shopName`.

## Shop name sourcing

Hosts pass `shopName` to ShareReceiptButton. The ledger already fetches `/api/stores`
(Slice A). QuickEntry/FullEntry fetch `/api/stores` on mount for the store name. The
customer phone and balance come from the `GET /api/transactions/[id]` response, not
from the host.

## Phase B2 - Scan as a sale (built after B1)

Goal: let a scanned bill be recorded as a sale so the existing ShareReceiptButton
can be offered on the scan success.

### ExtractionReview (`components/scan/ExtractionReview.tsx`)
- Add a `[ Purchase | Sale ]` toggle (default Purchase, preserving today's behaviour).
- When Sale: replace the vendor field with a customer picker (reuse `CustomerSheet`)
  and a payment method selector (cash / upi / credit); the save button label and the
  helper copy update to "sale".
- `onSave` payload gains `type` ('purchase' | 'sale'), `customerId`, and
  `paymentMethod`.

### Scan page (`app/(dashboard)/scan/page.tsx`)
- Pass the new `type`, `customerId`, and `paymentMethod` through to the confirm call.
- After a successful confirm of a `sale`, show the ShareReceiptButton (reusing the
  returned `transactionId`).

### Scan confirm route (`app/api/scan/confirm/route.ts`)
- Accept `type` ('purchase' | 'sale', default 'purchase'), `customerId`, and
  `paymentMethod`.
- For a sale: stock moves OUT (today it only moves stock in for purchases), and a
  credit sale increments the customer balance - mirroring the logic already in
  `app/api/entry/quick/route.ts`. Keep the existing purchase path unchanged.
- Continue to return `{ transactionId }`.

### Testing (B2)
The sale-vs-purchase stock direction and the credit-balance update are the logic
risk. Where this logic is shared with `entry/quick`, prefer reusing the existing
helpers (`lib/inventory/updateStock`, the balance update pattern) rather than
duplicating. Add focused tests for any new pure logic introduced.

## Error handling / edge cases

- No phone (no customer, or customer without a number) -> copy to clipboard; never
  build a broken wa.me link.
- Clipboard unavailable/denied -> show the receipt text in a selectable box.
- Sale with no line items (rare) -> receipt omits the item block, still shows total.
- `GET /api/transactions/[id]` fails -> plain-language error toast; do not open WhatsApp.
- Non-sale transactions -> no share affordance is shown.
- B2: a scanned sale with no customer -> allowed (walk-in); share falls back to copy.

## Testing summary

- B1 unit tests (vitest) for `buildReceiptText`: itemised cash sale, credit sale
  (Udhaar + Balance lines), single item, empty items, amount/date formatting,
  optional fields omitted cleanly.
- The wa.me building / phone normalization is already tested in
  `lib/collections/reminder.test.ts` and is not re-tested here.
- B2 tests as described above.

## Out of scope (future)

- Payment receipts ("you paid ₹X, balance ₹Y") - natural follow-up, reuses the same
  helper and button.
- Web-link receipts or image receipts.
- Sharing purchase bills / supplier copies.
- End-of-day cash reconciliation -> Slice C.

## Open questions

None.
