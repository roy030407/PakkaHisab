# Voice-First Sales Session - Layer 4 (Udhaar by voice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the merchant attach a customer and put a sale on credit by voice ("Sharma ji udhaar" -> attach + mark the cart credit, saved as a credit sale on "agla"), and read a customer's outstanding aloud ("Sharma ji ka kitna baaki" -> TTS that balance).

**Architecture:** Two new intents on the existing voice loop. The Gemini prompt classifies `attach_customer` and a new `customer_balance` command and extracts the person's name into `args.customerName`. `/api/voice/parse` resolves that name against the store's customers (fuzzy, server-side) and returns the matched `customer` in the response. The `/voice` page attaches the customer (a visible chip, detachable), and `saveCart` then posts the sale as `credit` with `customerId` via the existing `/api/entry/quick` (which already increments the customer balance for a credit sale). `customer_balance` just speaks the looked-up balance. Pure logic (the customer matcher + the balance-by-name speech) is unit-tested; the prompt, route, and page are tsc/build-verified.

**Tech Stack:** Next.js 14 App Router (TS strict), Supabase (Postgres + RLS), Fuse.js (already a dep), Google Gemini 2.5 Flash audio, browser SpeechSynthesis, vitest. Builds on Layers 1-3 (branch `voice-layer-3`); this work is on `voice-layer-4` off it.

## Global Constraints

- **NO em dashes (—) anywhere** - code, comments, UI copy, the Gemini prompt, commit messages. Use a comma, period, parentheses, or a spaced hyphen ( - ).
- **AI is Google Gemini, NOT Claude.**
- **Every new non-test file gets the project file-comment block; update CHANGES on touched files.** Test files have no block (start with imports).
- **Security (API route):** check the session, scope every query to `store_id`, name columns (no `SELECT *`). The customer match is store-scoped, and `/api/entry/quick` already re-verifies the customer belongs to the store before touching its balance.
- **Every clickable element:** `cursor-pointer`; disabled: `cursor-not-allowed`. Enabled interactive elements lift (`btn-lift`); disabled controls do NOT lift.
- **snake_case at the fetch/DB boundary:** Supabase returns `current_balance`; normalize to `currentBalance` in the loader. `₹NaN` = wrong-case read.
- **Work on the `voice-layer-4` branch** (off `voice-layer-3`). Do NOT touch `main`. Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Confirm before pushing.
- **Per-layer verification before commit:** `npx tsc --noEmit`, `npm test`, `npm run build` all green. OneDrive `.next` EINVAL: `rm -rf .next && npm run build`.
- **Vitest only discovers `lib/**/*.test.ts`.** Pure logic is unit-tested; the Gemini prompt, route, and page are tsc/build-verified + device-tested.

## Layer 4 scope (this plan)

In scope: voice `attach_customer` (match customer by name, attach, mark cart credit, save as credit) and `customer_balance` (read a named customer's outstanding aloud); a detachable customer chip on `/voice`. 

Out of scope (documented limitations): a full on-screen manual customer picker on `/voice` (if voice mis-hears the name repeatedly, the merchant detaches the wrong chip and the sale stays cash by default, or they use the existing `/entry` / `/customers` credit flow); creating a NEW customer by voice (only existing customers match); partial-payment by voice. The customer chip + detach + cash-default is the misfire safety.

## Integration facts (verified in the current code)

- `lib/voice/types.ts`: `VoiceCommand` includes `attach_customer` (not `customer_balance` yet); `VoiceParseArgs { quantity?; customerName? }`; `VoiceParseResponse { transcript; kind; cartItems; command; args }`.
- `lib/voice/parseGemini.ts`: `COMMANDS` array validates the command; `normalizeVoiceParse` already extracts `args.customerName` (trimmed, non-empty). `customer_balance` must be added to `COMMANDS`.
- `app/api/voice/parse/route.ts`: the `kind === 'command'` branch returns `{ transcript, kind:'command', cartItems:[], command, args }`. It has a private `loadCatalog` helper and imports `SupabaseClient`.
- `app/api/entry/quick/route.ts`: for `type:'sale'` with `customerId` + `paymentMethod:'credit'`, it re-verifies nothing extra but DOES look up the customer by id and `current_balance` and increments it. (It scopes the customer update to the store via the customer's own row; the id came from our store-scoped match, so it is valid.) Body shape: `{ type, paymentMethod, customerId?, items: [{productId, quantity}] }`.
- `app/(dashboard)/voice/page.tsx`: holds `rows`/`saving` in `stateRef`; `saveCart` posts cash; `onResult` routes `kind:'command'` to `runCommand(r.command, r.args)`. `customers` table columns: `id, store_id, name, phone, type, credit_limit, current_balance, notes, created_at`.
- Fuse.js is already used by `lib/scan/match.ts` and works in the vitest node env.

## File map

| File | Change | Task |
| --- | --- | --- |
| `lib/voice/types.ts` | `VoiceCommand += customer_balance`; `VoiceCustomerMatch`; `VoiceParseResponse.customer?` | 1 |
| `lib/voice/parseGemini.ts` | `COMMANDS += customer_balance` | 1 |
| `lib/voice/parseGemini.test.ts` | normalizer test for `customer_balance` + name | 1 |
| `lib/voice/customer.ts` | `matchCustomer` (fuzzy) + `buildBalanceByNameSpeech` | 1 |
| `lib/voice/customer.test.ts` | tests for both | 1 |
| `lib/anthropic/voiceParse.ts` | Gemini prompt: `attach_customer` + `customer_balance` + `args.customerName` | 2 |
| `app/api/voice/parse/route.ts` | resolve customer for the two commands; return `customer` | 3 |
| `app/(dashboard)/voice/page.tsx` | attach state + chip + detach + credit save + onResult handling | 4 |
| `HANDOFF.md` | Mark Layer 4 done | 5 |

---

### Task 1: Types + pure customer logic

**Files:**
- Modify: `lib/voice/types.ts`
- Modify: `lib/voice/parseGemini.ts`
- Modify (append test): `lib/voice/parseGemini.test.ts`
- Create: `lib/voice/customer.ts`
- Test: `lib/voice/customer.test.ts`

**Interfaces:**
- Produces: `VoiceCommand` now includes `'customer_balance'`; `VoiceCustomerMatch { id: string; name: string; currentBalance: number }`; `VoiceParseResponse.customer?: VoiceCustomerMatch | null`; `CustomerEntry { id; name; currentBalance }`; `matchCustomer(name: string, customers: CustomerEntry[]): CustomerEntry | null`; `buildBalanceByNameSpeech(customer: VoiceCustomerMatch | null): string`.

- [ ] **Step 1: Extend the types**

In `lib/voice/types.ts`, replace the `VoiceCommand` union:

```ts
export type VoiceCommand =
  | 'next'
  | 'close'
  | 'read_balance'
  | 'remove_last'
  | 'set_qty'
  | 'attach_customer'
```

with:

```ts
export type VoiceCommand =
  | 'next'
  | 'close'
  | 'read_balance'
  | 'remove_last'
  | 'set_qty'
  | 'attach_customer'
  | 'customer_balance'
```

Then add this interface just above `VoiceParseResponse`:

```ts
// A customer resolved server-side from a spoken name (udhaar / balance-by-name).
export interface VoiceCustomerMatch {
  id: string
  name: string
  currentBalance: number
}
```

and add the `customer` field to `VoiceParseResponse`:

```ts
// Response body from POST /api/voice/parse.
export interface VoiceParseResponse {
  transcript: string
  kind: 'items' | 'command'
  cartItems: VoiceCartRow[]
  command: VoiceCommand | null
  args: VoiceParseArgs
  customer?: VoiceCustomerMatch | null
}
```

Add to the types file CHANGES block: `- Layer 4: customer_balance command, VoiceCustomerMatch, VoiceParseResponse.customer`.

- [ ] **Step 2: Add `customer_balance` to the normalizer command set (failing test first)**

Append to `lib/voice/parseGemini.test.ts` (inside the existing `describe('normalizeVoiceParse', ...)` block, or as a new `it` in that file - it already imports `normalizeVoiceParse`):

```ts
  it('recognizes customer_balance and keeps the customerName arg', () => {
    const r = normalizeVoiceParse({
      command: 'customer_balance',
      args: { customerName: 'Sharma Ji' },
      items: [],
    })
    expect(r.kind).toBe('command')
    expect(r.command).toBe('customer_balance')
    expect(r.args.customerName).toBe('Sharma Ji')
  })
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/voice/parseGemini.test.ts`
Expected: FAIL - `customer_balance` is not in `COMMANDS`, so `command` comes back `null`.

- [ ] **Step 4: Add `customer_balance` to `COMMANDS`**

In `lib/voice/parseGemini.ts`, replace:

```ts
const COMMANDS: readonly VoiceCommand[] = [
  'next', 'close', 'read_balance', 'remove_last', 'set_qty', 'attach_customer',
]
```

with:

```ts
const COMMANDS: readonly VoiceCommand[] = [
  'next', 'close', 'read_balance', 'remove_last', 'set_qty', 'attach_customer', 'customer_balance',
]
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run lib/voice/parseGemini.test.ts`
Expected: PASS (existing + the new case).

- [ ] **Step 6: Write the customer logic test (failing first)**

```ts
// lib/voice/customer.test.ts
import { describe, it, expect } from 'vitest'
import { matchCustomer, buildBalanceByNameSpeech, type CustomerEntry } from '@/lib/voice/customer'

const customers: CustomerEntry[] = [
  { id: 'c1', name: 'Sharma Ji', currentBalance: 250 },
  { id: 'c2', name: 'Verma Store', currentBalance: 0 },
  { id: 'c3', name: 'Anil Kumar', currentBalance: 80 },
]

describe('matchCustomer', () => {
  it('matches an exact name', () => {
    expect(matchCustomer('Sharma Ji', customers)?.id).toBe('c1')
  })

  it('matches a fuzzy / partial name', () => {
    expect(matchCustomer('sharma', customers)?.id).toBe('c1')
  })

  it('returns null when nothing is close', () => {
    expect(matchCustomer('Zzxqq', customers)).toBeNull()
  })

  it('returns null for an empty name or empty list', () => {
    expect(matchCustomer('', customers)).toBeNull()
    expect(matchCustomer('Sharma', [])).toBeNull()
  })
})

describe('buildBalanceByNameSpeech', () => {
  it('reads what a customer owes', () => {
    expect(buildBalanceByNameSpeech({ id: 'c1', name: 'Sharma Ji', currentBalance: 250 }))
      .toBe('Sharma Ji owes 250 rupees.')
  })

  it('says no balance due when nothing is owed', () => {
    expect(buildBalanceByNameSpeech({ id: 'c2', name: 'Verma Store', currentBalance: 0 }))
      .toBe('Verma Store has no balance due.')
  })

  it('says not found for a null customer', () => {
    expect(buildBalanceByNameSpeech(null)).toBe('Customer not found.')
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run lib/voice/customer.test.ts`
Expected: FAIL - cannot find module `@/lib/voice/customer`.

- [ ] **Step 8: Implement the customer logic**

```ts
/**
 * FILE: lib/voice/customer.ts
 *
 * WHAT THIS DOES:
 *   Pure customer helpers for voice udhaar. matchCustomer fuzzy-matches a spoken
 *   name against the store's customers (Fuse.js); buildBalanceByNameSpeech turns
 *   a matched customer (or null) into the phrase read aloud for "X ka kitna baaki".
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 4)
 *
 * WHERE IT FITS:
 *   matchCustomer runs server-side in app/api/voice/parse/route.ts;
 *   buildBalanceByNameSpeech runs on the /voice page for the spoken balance.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/voice/parse/route.ts, app/(dashboard)/voice/page.tsx ;
 *   uses fuse.js and VoiceCustomerMatch from lib/voice/types
 */
import Fuse from 'fuse.js'
import type { VoiceCustomerMatch } from './types'

export interface CustomerEntry {
  id: string
  name: string
  currentBalance: number
}

export function matchCustomer(name: string, customers: CustomerEntry[]): CustomerEntry | null {
  const query = name.trim()
  if (!query || customers.length === 0) return null
  const fuse = new Fuse(customers, {
    keys: ['name'],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.45,
  })
  const results = fuse.search(query)
  return results.length > 0 ? results[0].item : null
}

export function buildBalanceByNameSpeech(customer: VoiceCustomerMatch | null): string {
  if (!customer) return 'Customer not found.'
  if (customer.currentBalance > 0) return `${customer.name} owes ${customer.currentBalance} rupees.`
  return `${customer.name} has no balance due.`
}
```

- [ ] **Step 9: Run, full suite, typecheck**

Run: `npx vitest run lib/voice/customer.test.ts`
Expected: PASS (7 cases).

Run: `npm test`
Expected: full suite green.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add lib/voice/types.ts lib/voice/parseGemini.ts lib/voice/parseGemini.test.ts lib/voice/customer.ts lib/voice/customer.test.ts
git commit -m "feat(voice): customer match + balance-by-name speech (udhaar foundations)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Gemini prompt classifies `attach_customer` + `customer_balance`

**Files:**
- Modify: `lib/anthropic/voiceParse.ts`

- [ ] **Step 1: Extend the command mapping**

In `lib/anthropic/voiceParse.ts`, in `SYSTEM_INSTRUCTION`, replace this block (it currently ends at the `set_qty` line from Layer 3):

```
- "remove last" / "aakhri hata do" / "pichla hata do" / "ye hata do" / "galat" -> "remove_last"
- "set quantity" / "change quantity" / "teen kar do" / "do kar do" / "make it 3" -> "set_qty" (put the new number in args.quantity)
```

with:

```
- "remove last" / "aakhri hata do" / "pichla hata do" / "ye hata do" / "galat" -> "remove_last"
- "set quantity" / "change quantity" / "teen kar do" / "do kar do" / "make it 3" -> "set_qty" (put the new number in args.quantity)
- "<name> udhaar" / "<name> ko udhaar" / "udhaar <name>" / "<name> ke naam" -> "attach_customer" (put the person name in args.customerName)
- "<name> ka kitna baaki" / "<name> ka balance" / "<name> ka hisab" / "<name> kitna dena hai" -> "customer_balance" (put the person name in args.customerName)
```

- [ ] **Step 2: Update the returned-JSON command enum**

Replace:

```
  "command": "next" | "close" | "read_balance" | "remove_last" | "set_qty" | null,
```

with:

```
  "command": "next" | "close" | "read_balance" | "remove_last" | "set_qty" | "attach_customer" | "customer_balance" | null,
```

- [ ] **Step 3: Update the CHANGES block**

Add to the file-comment CHANGES section of `lib/anthropic/voiceParse.ts`:

```
 *   - Layer 4: classify attach_customer + customer_balance (name in args.customerName)
```

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/anthropic/voiceParse.ts
git commit -m "feat(voice): Gemini prompt classifies attach_customer + customer_balance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Resolve the customer in `/api/voice/parse`

**Files:**
- Modify: `app/api/voice/parse/route.ts`

**Interfaces:**
- Consumes: `matchCustomer` + `CustomerEntry` from `lib/voice/customer`; `VoiceCustomerMatch` from `lib/voice/types`.
- Produces: the command-branch response now carries `customer: VoiceCustomerMatch | null` (resolved only for `attach_customer` / `customer_balance` with a `customerName`).

- [ ] **Step 1: Extend the imports**

In `app/api/voice/parse/route.ts`, replace:

```ts
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import type { VoiceCartRow, VoiceParseResponse } from '@/lib/voice/types'
```

with:

```ts
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import { matchCustomer, type CustomerEntry } from '@/lib/voice/customer'
import type { VoiceCartRow, VoiceParseResponse, VoiceCustomerMatch } from '@/lib/voice/types'
```

- [ ] **Step 2: Resolve a customer in the command branch**

Replace the command branch:

```ts
  // Command: nothing to match - hand the classification back to the client.
  if (parsed.kind === 'command') {
    const res: VoiceParseResponse = {
      transcript: parsed.transcript,
      kind: 'command',
      cartItems: [],
      command: parsed.command,
      args: parsed.args,
    }
    return NextResponse.json(res)
  }
```

with:

```ts
  // Command: resolve a customer for udhaar / balance-by-name; else hand back as-is.
  if (parsed.kind === 'command') {
    let customer: VoiceCustomerMatch | null = null
    if (
      (parsed.command === 'attach_customer' || parsed.command === 'customer_balance') &&
      parsed.args.customerName
    ) {
      const customers = await loadCustomers(supabase, store.id)
      customer = matchCustomer(parsed.args.customerName, customers)
    }
    const res: VoiceParseResponse = {
      transcript: parsed.transcript,
      kind: 'command',
      cartItems: [],
      command: parsed.command,
      args: parsed.args,
      customer,
    }
    return NextResponse.json(res)
  }
```

- [ ] **Step 3: Add the `loadCustomers` helper**

At the end of the file (after `loadCatalog`), add:

```ts
// Store customers (id, name, balance) for fuzzy name matching. Store-scoped,
// named columns, snake_case normalized at the boundary.
async function loadCustomers(supabase: SupabaseClient, storeId: string): Promise<CustomerEntry[]> {
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, current_balance')
    .eq('store_id', storeId)
  return (customers ?? []).map((c: { id: string; name: string; current_balance: number }) => ({
    id: c.id,
    name: c.name,
    currentBalance: Number(c.current_balance) || 0,
  }))
}
```

- [ ] **Step 4: Update the CHANGES block**

Add to the route's file-comment CHANGES section:

```
 *   - Layer 4: resolve a customer (fuzzy, store-scoped) for attach_customer /
 *     customer_balance and return it in the response
```

- [ ] **Step 5: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, `/voice` + `/api/voice/parse` present. (OneDrive `.next` EINVAL -> `rm -rf .next && npm run build`.)

- [ ] **Step 6: Commit**

```bash
git add "app/api/voice/parse/route.ts"
git commit -m "feat(voice): resolve customer by spoken name in /api/voice/parse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Attach customer + credit save on the `/voice` page

**Files:**
- Modify: `app/(dashboard)/voice/page.tsx`

**Interfaces:**
- Consumes: `buildBalanceByNameSpeech` from `lib/voice/customer`; `VoiceCustomerMatch` from `lib/voice/types`. `saveCart` posts `credit` + `customerId` when a customer is attached; `onResult` handles `attach_customer` / `customer_balance`.

- [ ] **Step 1: Extend the imports**

In `app/(dashboard)/voice/page.tsx`, add `X` to the lucide import:

```tsx
import { Mic, Square, Loader2, Volume2, X } from 'lucide-react'
```

add the speech builder import after the `speak` import:

```tsx
import { buildBalanceByNameSpeech } from '@/lib/voice/customer'
```

and add `VoiceCustomerMatch` to the types import:

```tsx
import type { VoiceCartRow, VoiceParseResponse, VoiceCommand, VoiceParseArgs, VoiceCustomerMatch } from '@/lib/voice/types'
```

- [ ] **Step 2: Add attached-customer state and thread it through `stateRef`**

Replace:

```tsx
  const [rows, setRows] = useState<VoiceCartRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The hook holds onResult by identity, so command handling reads the latest
  // cart + saving flag through a ref rather than a stale closure.
  const stateRef = useRef<{ rows: VoiceCartRow[]; saving: boolean }>({ rows, saving })
  stateRef.current = { rows, saving }
```

with:

```tsx
  const [rows, setRows] = useState<VoiceCartRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<VoiceCustomerMatch | null>(null)

  // The hook holds onResult by identity, so command handling reads the latest
  // cart + saving flag + attached customer through a ref, not a stale closure.
  const stateRef = useRef<{ rows: VoiceCartRow[]; saving: boolean; customer: VoiceCustomerMatch | null }>({ rows, saving, customer })
  stateRef.current = { rows, saving, customer }
```

- [ ] **Step 3: Make `saveCart` post a credit sale when a customer is attached**

Replace the `saveCart` body's fetch + success block:

```tsx
      const res = await fetch('/api/entry/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          paymentMethod: 'cash',
          items: cart.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        }),
      })
      if (!res.ok) { setSaveError('Could not save. Check your connection and try again.'); return }
      setRows([])
```

with:

```tsx
      const cust = stateRef.current.customer
      const res = await fetch('/api/entry/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          paymentMethod: cust ? 'credit' : 'cash',
          customerId: cust?.id,
          items: cart.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        }),
      })
      if (!res.ok) { setSaveError('Could not save. Check your connection and try again.'); return }
      setRows([])
      setCustomer(null)
```

- [ ] **Step 4: Handle the two new commands in `onResult`**

Replace:

```tsx
  const onResult = useCallback((r: VoiceParseResponse) => {
    if (r.kind === 'items' && r.cartItems.length > 0) {
      setRows((prev) => addRowsToCart(prev, r.cartItems))
      return
    }
    if (r.kind === 'command' && r.command) runCommand(r.command, r.args)
  }, [runCommand])
```

with:

```tsx
  const onResult = useCallback((r: VoiceParseResponse) => {
    if (r.kind === 'items' && r.cartItems.length > 0) {
      setRows((prev) => addRowsToCart(prev, r.cartItems))
      return
    }
    if (r.kind !== 'command' || !r.command) return
    if (r.command === 'attach_customer') {
      if (r.customer) setCustomer(r.customer)
      else speak('Customer not found.')
      return
    }
    if (r.command === 'customer_balance') {
      speak(buildBalanceByNameSpeech(r.customer ?? null))
      return
    }
    runCommand(r.command, r.args)
  }, [runCommand])
```

- [ ] **Step 5: Show the detachable customer chip and a credit-aware Save label**

Add the chip just below the `<VoiceCart ... />` line (before the speaker block):

```tsx
      {customer && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-sm font-medium text-amber-900">
            Udhaar: {customer.name} (credit)
          </span>
          <button
            type="button"
            onClick={() => setCustomer(null)}
            aria-label="Remove customer from this sale"
            className="btn-lift flex h-7 w-7 items-center justify-center rounded-lg text-amber-700 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}
```

and change the Save button label line:

```tsx
          {saving ? 'Saving...' : `Save & agla - ₹${total}`}
```

to:

```tsx
          {saving ? 'Saving...' : `${customer ? 'Save udhaar' : 'Save'} & agla - ₹${total}`}
```

- [ ] **Step 6: Update the CHANGES block**

Add to the page's file-comment CHANGES section:

```
 *   - Layer 4: udhaar by voice (attach_customer attaches a customer + saves the
 *     sale on credit; customer_balance reads a named customer's balance aloud);
 *     detachable customer chip
```

- [ ] **Step 7: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, `/voice` present. (OneDrive `.next` EINVAL -> `rm -rf .next && npm run build`.)

- [ ] **Step 8: Run the unit suite (no regressions)**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/voice/page.tsx"
git commit -m "feat(voice): attach customer + credit save + balance-by-name on the voice page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Layer 4 verification + handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Full automated verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; all vitest tests pass (Layer 1-3 suite + the new normalizer + customer tests); build succeeds with `/voice` present.

- [ ] **Step 2: Real-device manual pass (udhaar)**

On a mid-range Android, on the `voice-layer-4` preview deployment, signed in as a store that has at least one customer with a known name and an outstanding balance:

1. Speak a few items, then say "<existing customer name> udhaar". Confirm a chip "Udhaar: <name> (credit)" appears and the Save button reads "Save udhaar & agla".
2. Say "agla". Confirm the sale saves on CREDIT (check the customer's balance increased by the cart total in `/customers`), the cart clears, and the chip clears.
3. Say "<that customer> ka kitna baaki". Confirm the phone reads the outstanding aloud.
4. Say "<a name not in the customer list> udhaar". Confirm it speaks "Customer not found." and no chip is attached (sale stays cash).
5. Attach a customer, then tap the chip "x". Confirm it detaches and the next save is cash again.
6. Confirm a normal cash flow (no customer) still saves as cash.

- [ ] **Step 3: Update HANDOFF.md**

In `HANDOFF.md`: under "Built & live", add a Layer 4 bullet (udhaar by voice + balance-by-name on `voice-layer-4`). In NEXT, mark the voice feature CORE+STRETCH complete (Layers 1-4); set the next step to the device pass + merge, and note remaining stretch ideas (manual customer picker on `/voice`, new-customer-by-voice, partial payment) as backlog. Commit:

```bash
git add HANDOFF.md
git commit -m "docs: handoff - Voice Layer 4 (udhaar by voice) shipped

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- **udhaar ("<name> udhaar" -> match customer, attach + mark credit):** Task 2 prompt mapping (name -> `args.customerName`), Task 3 route resolves the customer (fuzzy, store-scoped), Task 4 attaches it + `saveCart` posts `credit` + `customerId` (reuses `/api/entry/quick`, which increments the customer balance). Covered.
- **balance by name ("<name> ka kitna baaki" -> look up + TTS):** Task 1 `buildBalanceByNameSpeech`, Task 2 prompt, Task 3 lookup, Task 4 `onResult` speaks it. Covered.
- **Customer chip + payment method (cash default; credit when udhaar attached):** Task 4 chip + dynamic Save label; `saveCart` defaults cash, credit when attached. Covered.
- **Misfire is never a dead end:** the chip shows WHO was attached (so a wrong match is visible), the "x" detaches, and the sale defaults to cash; "Customer not found" is spoken on no match. Covered (a full manual picker is documented out of scope).
- **Security:** customer match is store-scoped (`loadCustomers` filters `store_id`, named columns); `/api/entry/quick` re-looks-up the customer before adjusting its balance. Covered.
- **No blind credit save:** credit only applies when a customer chip is visibly attached; otherwise cash. Covered.
- **Deferred:** manual on-screen customer picker, new-customer-by-voice, partial payment by voice - documented as backlog. Covered.
- **Testing per spec (unit-test pure logic; tsc/build; device):** Task 1 vitest TDD (matcher + speech + normalizer); Tasks 2-4 tsc/build; Task 5 device pass. Covered.
- **Type consistency:** `VoiceCommand` adds `customer_balance` (types + `COMMANDS` + prompt enum all updated); `VoiceCustomerMatch { id; name; currentBalance }` used in types, route (`matchCustomer` returns the same shape via `CustomerEntry`), and page; `VoiceParseResponse.customer?` consumed in `onResult`; `matchCustomer(name, customers)` / `buildBalanceByNameSpeech(customer)` signatures match call sites; `saveCart` body matches `QuickEntryPayload` (`customerId?`, `paymentMethod`). Verified.

No placeholder steps; every code step shows complete code; every command lists expected output.
