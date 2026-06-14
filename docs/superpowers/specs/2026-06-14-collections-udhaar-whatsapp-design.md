# Slice A - Collections (Udhaar + WhatsApp) - Design Spec

Date: 2026-06-14
Status: Approved (pending spec review)
Owner: Roy Harwani

## Problem

The app tracks how much each customer owes (customers.current_balance) but a
shopkeeper cannot (a) record a repayment, (b) see who owes and for how long, or
(c) nudge a customer to pay. Today current_balance only ever increases on a
credit sale; the only way it drops is deleting the original sale. This makes the
udhaar (credit) book a dead number instead of a collections tool.

## Goal

Turn the existing balances into a collections workflow: record repayments, show
a "who owes / how old" list, and send a one-tap WhatsApp reminder - with no
WhatsApp Business API and no cost (wa.me links).

## Decisions (from brainstorm)

| Topic | Decision |
| --- | --- |
| Repayment model | Running balance, Khatabook-style. A "Receive payment" action logs a payment entry and lowers the balance. Cash in, NOT revenue. |
| Aging | Show the age only (no threshold/overdue setting). Reminders can go to anyone with a balance. |
| Reminder text | Customizable template in Settings, with a seeded default. Pre-filled into WhatsApp; the shopkeeper reviews and sends (human check). |
| Placement | Inside the Customers page as an "Udhaar due" segmented tab (Option A). The dashboard "Udhaar due" card deep-links into it. |
| Phone / region | India (+91) assumed for wa.me. 10-digit numbers are prefixed with 91. |
| Negative balance | Allowed (a payment larger than the balance leaves an advance / jama). |

## Data model

### Repayment storage - new transaction type `payment`

A repayment is stored as a `transactions` row with a new `type = 'payment'`:
- `total_amount` = amount received, `customer_id` set, `payment_method`
  (cash/upi), `date`, optional `notes`, `source = 'manual_quick'`.
- No transaction_items, no stock movement.
- On save, `customers.current_balance -= amount` (may go negative).

`TransactionType` gains `'payment'` (types/index.ts). All revenue/stock code
already keys off `'sale'`/`'purchase'`, so `'payment'` is naturally excluded
from sales, profit, and inventory. Verify in: buildReport, dashboard snapshot,
entry routes (no change needed, just confirmed). The customer ledger already
lists all of a customer's transactions, so the payment shows automatically.

Deleting a payment (existing delete route) must reverse it: add `payment` to the
balance-reversal logic so deleting a payment ADDS the amount back to the balance.
(lib/transactions/reverse.ts: balanceReversalAmount handles type 'payment' by
returning a negative reversal, i.e. it re-adds to balance. Implementation detail
captured in the plan.)

### Reminder template - new column on `stores`

`stores.reminder_template TEXT NULL`. A seeded default is used when null:
`"Namaste {name} ji, {shop} par aapke ₹{amount} baaki hain. Kripya jab ho sake de dijiye. Dhanyavaad."`
Placeholders: `{name}`, `{amount}`, `{shop}`. Migration adds the column.

## Pure helpers (testable, no DB)

- `lib/collections/reminder.ts`
  - `renderTemplate(template, { name, amount, shop }): string` - placeholder fill.
  - `buildWhatsappUrl(phone, message): string | null` - normalizes the phone
    (strip non-digits; if 10 digits prefix `91`; if already 12 starting `91`
    keep) and returns `https://wa.me/<phone>?text=<encoded>`; returns null when
    there is no usable phone.
- `lib/collections/aging.ts`
  - `customerAge({ oldestCreditAt, lastPaymentAt, now }): { sinceDays, lastPaidDays|null }`
    - `sinceDays` = days since the oldest credit sale (while balance > 0).
    - `lastPaidDays` = days since the most recent payment, or null if never.

## API

- `POST /api/customers/[id]/payment` (NEW) - body `{ amount, paymentMethod?, date?, note? }`.
  Validates ownership + amount > 0 + date format; inserts the `payment`
  transaction; decrements `current_balance`; returns the new balance.
- `GET /api/customers` (MODIFY) - for the Udhaar tab, also return per-customer
  `oldestCreditAt` and `lastPaymentAt` so the list can show age without fetching
  each ledger. (Two grouped queries over transactions, scoped to store.)
- `PATCH /api/stores` (MODIFY or NEW field) - accept `reminderTemplate` so
  Settings can save it. (Confirm the stores route exists; if not, add a minimal
  PATCH.)

## UI

### Customers page (MODIFY) - `app/(dashboard)/customers/page.tsx`
- Segmented control: `[ All | Udhaar due · ₹<total> ]`. Default tab respects a
  `?tab=udhaar` query param (used by the dashboard deep-link).
- Udhaar tab: customers with `current_balance > 0`, sorted by balance desc.
  Each row: name, balance (amber), age line ("Balance since X din · last paid Y
  din ago"), and two actions: **＋ Receive payment** and **WhatsApp remind**.

### Receive payment sheet (NEW) - `components/customers/ReceivePaymentSheet.tsx`
- Bottom sheet. Amount field with quick chips **Full / Half / Custom**; optional
  date (default today) + note. Save -> POST payment -> refresh list/ledger.
  Helper text: "Cash in - not counted as a sale/profit."

### WhatsApp remind (NEW) - `components/customers/RemindButton.tsx`
- Builds the message from the store template + customer, opens
  `buildWhatsappUrl(...)` via `window.open`. If the customer has no phone, show
  an inline prompt to add a phone number first (links to edit customer).

### Customer ledger (MODIFY) - `components/customers/CustomerLedger.tsx`
- Render `payment` rows as green "Payment received +₹"; sales stay amber. Add the
  same **Receive payment** + **Remind** actions at the top of the ledger.

### Settings (MODIFY) - `app/(dashboard)/settings/page.tsx`
- New "WhatsApp reminder message" section: a textarea pre-filled with the current
  template (or the default), shows the available placeholders, Save via PATCH.

### Dashboard (MODIFY) - `app/(dashboard)/dashboard/page.tsx`
- The existing "Udhaar due" card links to `/customers?tab=udhaar`.

## Error handling / edge cases

- No phone -> reminder prompts to add one; never builds a broken wa.me link.
- amount <= 0 -> 400.
- Payment > balance -> allowed; balance goes negative (advance). UI shows the
  negative as "advance / jama" rather than an error.
- No template saved -> use the seeded default.
- Phone with country code already -> not double-prefixed.

## Testing

Unit tests (vitest) for the pure helpers, which carry the logic risk:
- `reminder.ts`: template rendering (all placeholders, missing values) and
  wa.me URL building (10-digit, already-91, junk/empty -> null, message encoded).
- `aging.ts`: sinceDays / lastPaidDays across has-paid / never-paid / today.

## Out of scope (other slices)

- Receipt / bill sharing on WhatsApp -> Slice B.
- End-of-day cash reconciliation (will consume `payment` rows) -> Slice C.
- Push notifications -> Slice D (deferred).
- Per-customer credit terms / overdue thresholds (we chose show-age-only).

## Open questions

None.
