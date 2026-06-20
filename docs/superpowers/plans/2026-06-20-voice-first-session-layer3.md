# Voice-First Sales Session - Layer 3 (Corrections) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two correction commands so a mis-parse mid-rush is fixable by voice: `remove_last / aakhri hata do` (drop the last cart row) and `set_qty / "teen kar do"` (set the last row's quantity to the spoken number).

**Architecture:** Mostly client-side, plus one server-side prompt change. The Gemini prompt (`lib/anthropic/voiceParse.ts`) gains the two new command mappings (and `set_qty` puts the number in `args.quantity`); `normalizeVoiceParse` + the route already pass `command` + `args` through unchanged. Two new pure cart ops (`removeLastRow`, `setLastRowQuantity`) and an extended `decideCommandAction` (now taking `args`, returning `removeLast` + `setQty`) carry the logic, all unit-tested. The `/voice` page applies them in `runCommand`. The per-row trash and +/- controls already in `VoiceCart` (from Layer 1) are the on-screen button equivalents, so no new UI is needed.

**Tech Stack:** Next.js 14 App Router (TS strict), Tailwind + shadcn/ui, Google Gemini 2.5 Flash audio, vitest. Builds on Layers 1 + 2 (branch `voice-layer-1`); this work is on branch `voice-layer-3` off it.

## Global Constraints

- **NO em dashes (—) anywhere** - code, comments, UI copy, the Gemini prompt string, commit messages. Use a comma, period, parentheses, or a spaced hyphen ( - ).
- **AI is Google Gemini, NOT Claude.** The prompt change is to the Gemini system instruction in `lib/anthropic/voiceParse.ts`.
- **Every new non-test file gets the project file-comment block; update CHANGES on touched files.** Test files follow the existing convention (no block - start with imports).
- **Every clickable element:** `cursor-pointer`; disabled: `cursor-not-allowed`. Enabled interactive elements lift (`btn-lift`); disabled controls do NOT lift. (No new buttons in this layer.)
- **Work on the `voice-layer-3` branch** (off `voice-layer-1`). Do NOT touch `main`. Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Confirm before pushing.
- **Per-layer verification before commit:** `npx tsc --noEmit`, `npm test`, `npm run build` all green. OneDrive `.next` EINVAL: `rm -rf .next && npm run build`.
- **Vitest only discovers `lib/**/*.test.ts`.** Pure logic is unit-tested; the Gemini prompt (NL instruction) and the page wiring are tsc/build-verified + device-tested.

## Layer 3 scope (this plan)

In scope: `remove_last` and `set_qty` (set the last row's quantity). Deferred to Layer 4: udhaar by voice (`attach_customer` + credit) and balance-by-name. `decideCommandAction` returns a no-op for `attach_customer` and `null`, so an early utterance is harmless.

## Integration facts (verified in the current code)

- `lib/voice/types.ts` already exports `VoiceCommand` (includes `remove_last`, `set_qty`), `VoiceParseArgs { quantity?; customerName? }`, `VoiceParseResponse { ..., command, args }`.
- `lib/voice/parseGemini.ts` `normalizeVoiceParse` already validates `remove_last` / `set_qty` against the command set and extracts `args.quantity` (positive numbers only). No change needed.
- `app/api/voice/parse/route.ts` already returns `{ kind:'command', command, args }` for any classified command. No change needed.
- `lib/voice/command.ts` `decideCommandAction(command, cartCount)` returns `{ save, closeSession, speakTotal }` and no-ops `remove_last`/`set_qty` today. `lib/voice/cart.ts` exports `setRowQuantity(cart, productId, quantity)` (removes the row at `quantity <= 0`).
- `app/(dashboard)/voice/page.tsx` `runCommand(command)` dispatches `speak`/`saveCart`/`stop`; `onResult` calls `runCommand(r.command)` (does not pass `args` yet).
- `components/voice/VoiceCart.tsx` already renders a per-row trash (when qty 1) / minus / plus, which serve as the button equivalents for remove-last and set-qty.

## File map

| File | Change | Task |
| --- | --- | --- |
| `lib/voice/cart.ts` | Add `removeLastRow`, `setLastRowQuantity` | 1 |
| `lib/voice/cart.test.ts` | Tests for the two new ops | 1 |
| `lib/voice/command.ts` | Extend `CommandAction` + `decideCommandAction(args)` | 1 |
| `lib/voice/command.test.ts` | Updated + new assertions (5-field action) | 1 |
| `lib/anthropic/voiceParse.ts` | Gemini prompt: classify `remove_last` + `set_qty` | 2 |
| `app/(dashboard)/voice/page.tsx` | `runCommand` applies corrections + passes `args` | 3 |
| `HANDOFF.md` | Mark Layer 3 done, set Layer 4 next | 4 |

---

### Task 1: Pure corrections logic (cart ops + command decider)

**Files:**
- Modify: `lib/voice/cart.ts`
- Modify (append tests): `lib/voice/cart.test.ts`
- Replace: `lib/voice/command.ts`
- Replace: `lib/voice/command.test.ts`

**Interfaces:**
- Produces: `removeLastRow(cart: VoiceCartRow[]): VoiceCartRow[]`; `setLastRowQuantity(cart: VoiceCartRow[], quantity: number): VoiceCartRow[]`; extended `CommandAction { save; closeSession; speakTotal; removeLast: boolean; setQty: number | null }`; `decideCommandAction(command: VoiceCommand | null, cartCount: number, args?: VoiceParseArgs): CommandAction`.

This task changes the existing `CommandAction` shape (adds `removeLast` + `setQty`), so the Layer 2 `command.test.ts` assertions are updated here (replaced) - that is expected, not a regression.

- [ ] **Step 1: Add the two cart ops (failing test first)**

Append these two `describe` blocks to the end of `lib/voice/cart.test.ts`, and add `removeLastRow, setLastRowQuantity` to the existing import from `@/lib/voice/cart` at the top of that file. (The file already defines a `row(productId, quantity, unitPrice)` helper - reuse it.)

```ts
describe('removeLastRow', () => {
  it('drops the last row', () => {
    const next = removeLastRow([row('a', 1, 10), row('b', 2, 20)])
    expect(next.map((r) => r.productId)).toEqual(['a'])
  })

  it('is empty-safe and does not mutate the input', () => {
    expect(removeLastRow([])).toEqual([])
    const cart = [row('a', 1, 10)]
    removeLastRow(cart)
    expect(cart).toHaveLength(1)
  })
})

describe('setLastRowQuantity', () => {
  it('sets the quantity of the last row only', () => {
    const next = setLastRowQuantity([row('a', 1, 10), row('b', 2, 20)], 5)
    expect(next.find((r) => r.productId === 'b')!.quantity).toBe(5)
    expect(next.find((r) => r.productId === 'a')!.quantity).toBe(1)
  })

  it('removes the last row when the quantity is zero or below', () => {
    const next = setLastRowQuantity([row('a', 1, 10), row('b', 2, 20)], 0)
    expect(next.map((r) => r.productId)).toEqual(['a'])
  })

  it('is a no-op on an empty cart', () => {
    expect(setLastRowQuantity([], 3)).toEqual([])
  })
})
```

- [ ] **Step 2: Run cart tests to verify they fail**

Run: `npx vitest run lib/voice/cart.test.ts`
Expected: FAIL - `removeLastRow` / `setLastRowQuantity` are not exported.

- [ ] **Step 3: Implement the two cart ops**

Append to `lib/voice/cart.ts` (after `cartTotal`), and add `- Layer 3: removeLastRow + setLastRowQuantity (voice corrections)` to its CHANGES block:

```ts
// Drop the most recently added row (voice: "aakhri hata do"). Empty-safe.
export function removeLastRow(cart: VoiceCartRow[]): VoiceCartRow[] {
  return cart.slice(0, -1)
}

// Set the last row's quantity (voice: "teen kar do"). Reuses setRowQuantity, so
// a quantity of 0 or below removes that row. No-op on an empty cart.
export function setLastRowQuantity(cart: VoiceCartRow[], quantity: number): VoiceCartRow[] {
  if (cart.length === 0) return cart
  const last = cart[cart.length - 1]
  return setRowQuantity(cart, last.productId, quantity)
}
```

- [ ] **Step 4: Run cart tests to verify they pass**

Run: `npx vitest run lib/voice/cart.test.ts`
Expected: PASS (existing cart tests + 5 new).

- [ ] **Step 5: Replace `command.test.ts` with the 5-field version (failing first)**

Replace the entire contents of `lib/voice/command.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { decideCommandAction, buildBalanceSpeech } from '@/lib/voice/command'

const NOOP = { save: false, closeSession: false, speakTotal: false, removeLast: false, setQty: null }

describe('decideCommandAction', () => {
  it('next saves and keeps the session when the cart has items', () => {
    expect(decideCommandAction('next', 3)).toEqual({ ...NOOP, save: true })
  })

  it('next is a no-op when the cart is empty', () => {
    expect(decideCommandAction('next', 0)).toEqual(NOOP)
  })

  it('close saves and ends the session when the cart has items', () => {
    expect(decideCommandAction('close', 2)).toEqual({ ...NOOP, save: true, closeSession: true })
  })

  it('close still ends the session with an empty cart but does not save', () => {
    expect(decideCommandAction('close', 0)).toEqual({ ...NOOP, closeSession: true })
  })

  it('read_balance only speaks the total', () => {
    expect(decideCommandAction('read_balance', 5)).toEqual({ ...NOOP, speakTotal: true })
  })

  it('remove_last drops the last row when the cart has items', () => {
    expect(decideCommandAction('remove_last', 3)).toEqual({ ...NOOP, removeLast: true })
  })

  it('remove_last is a no-op on an empty cart', () => {
    expect(decideCommandAction('remove_last', 0)).toEqual(NOOP)
  })

  it('set_qty carries the spoken quantity from args', () => {
    expect(decideCommandAction('set_qty', 3, { quantity: 5 })).toEqual({ ...NOOP, setQty: 5 })
  })

  it('set_qty is a no-op when no valid quantity was heard', () => {
    expect(decideCommandAction('set_qty', 3, {})).toEqual(NOOP)
    expect(decideCommandAction('set_qty', 3, { quantity: 0 })).toEqual(NOOP)
    expect(decideCommandAction('set_qty', 3)).toEqual(NOOP)
  })

  it('is a no-op for attach_customer and null', () => {
    expect(decideCommandAction('attach_customer', 5)).toEqual(NOOP)
    expect(decideCommandAction(null, 5)).toEqual(NOOP)
  })
})

describe('buildBalanceSpeech', () => {
  it('reads a positive total in rupees', () => {
    expect(buildBalanceSpeech(250)).toBe('Total 250 rupees.')
  })

  it('says the cart is empty for a zero or negative total', () => {
    expect(buildBalanceSpeech(0)).toBe('Cart is empty.')
    expect(buildBalanceSpeech(-5)).toBe('Cart is empty.')
  })
})
```

- [ ] **Step 6: Run command tests to verify they fail**

Run: `npx vitest run lib/voice/command.test.ts`
Expected: FAIL - current `CommandAction` lacks `removeLast`/`setQty` and `decideCommandAction` ignores `args`.

- [ ] **Step 7: Replace `command.ts` with the extended version**

Replace the entire contents of `lib/voice/command.ts` with:

```ts
/**
 * FILE: lib/voice/command.ts
 *
 * WHAT THIS DOES:
 *   Pure command logic for the voice session. Maps a recognized voice command,
 *   the current cart size, and any parsed args to a CommandAction: save / close /
 *   speak the total, plus the Layer 3 corrections (remove the last row, set the
 *   last row's quantity). Also builds the spoken-total string. No side effects.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 2)
 *   - Layer 3: CommandAction gains removeLast + setQty; decideCommandAction takes
 *     args and handles remove_last / set_qty
 *
 * WHERE IT FITS:
 *   Used by app/(dashboard)/voice/page.tsx to execute a parsed command.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; imports VoiceCommand + VoiceParseArgs from lib/voice/types
 */
import type { VoiceCommand, VoiceParseArgs } from './types'

export interface CommandAction {
  save: boolean
  closeSession: boolean
  speakTotal: boolean
  removeLast: boolean
  setQty: number | null
}

const NOOP: CommandAction = {
  save: false,
  closeSession: false,
  speakTotal: false,
  removeLast: false,
  setQty: null,
}

export function decideCommandAction(
  command: VoiceCommand | null,
  cartCount: number,
  args: VoiceParseArgs = {},
): CommandAction {
  switch (command) {
    case 'next':
      return { ...NOOP, save: cartCount > 0 }
    case 'close':
      return { ...NOOP, save: cartCount > 0, closeSession: true }
    case 'read_balance':
      return { ...NOOP, speakTotal: true }
    case 'remove_last':
      return { ...NOOP, removeLast: cartCount > 0 }
    case 'set_qty': {
      const q = args.quantity
      return { ...NOOP, setQty: typeof q === 'number' && q > 0 ? q : null }
    }
    default:
      // attach_customer (Layer 4) and null: no-op.
      return { ...NOOP }
  }
}

export function buildBalanceSpeech(total: number): string {
  if (total <= 0) return 'Cart is empty.'
  return `Total ${total} rupees.`
}
```

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx vitest run lib/voice/command.test.ts lib/voice/cart.test.ts`
Expected: PASS (all command + cart tests).

Run: `npm test`
Expected: full suite green (no regressions elsewhere).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add lib/voice/cart.ts lib/voice/cart.test.ts lib/voice/command.ts lib/voice/command.test.ts
git commit -m "feat(voice): pure corrections logic (remove-last, set-last-qty, decider args)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Gemini prompt classifies `remove_last` + `set_qty`

**Files:**
- Modify: `lib/anthropic/voiceParse.ts`

**Interfaces:**
- No signature change. The model now emits `remove_last` / `set_qty` (with `set_qty`'s number in `args.quantity`). `normalizeVoiceParse` already validates both. Verified by `tsc` (the prompt itself is exercised in the device pass).

- [ ] **Step 1: Extend the command mapping**

In `lib/anthropic/voiceParse.ts`, in the `SYSTEM_INSTRUCTION` string, replace this block:

```
Map command phrases to one of these (else it is items):
- "next" / "agla" / "agla customer" / "iska ho gaya" -> "next"
- "close" / "khatam" / "bas" / "ho gaya" / "band karo" -> "close"
- "balance" / "hisab" / "total" / "kitna hua" / "kitne ka" -> "read_balance"
```

with:

```
Map command phrases to one of these (else it is items):
- "next" / "agla" / "agla customer" / "iska ho gaya" -> "next"
- "close" / "khatam" / "bas" / "ho gaya" / "band karo" -> "close"
- "balance" / "hisab" / "total" / "kitna hua" / "kitne ka" -> "read_balance"
- "remove last" / "aakhri hata do" / "pichla hata do" / "ye hata do" / "galat" -> "remove_last"
- "set quantity" / "change quantity" / "teen kar do" / "do kar do" / "make it 3" -> "set_qty" (put the new number in args.quantity)
```

- [ ] **Step 2: Update the returned-JSON command enum**

In the same string, replace:

```
  "command": "next" | "close" | "read_balance" | null,
```

with:

```
  "command": "next" | "close" | "read_balance" | "remove_last" | "set_qty" | null,
```

- [ ] **Step 3: Update the CHANGES block**

Add to the file-comment CHANGES section of `lib/anthropic/voiceParse.ts`:

```
 *   - Layer 3: classify remove_last + set_qty (set_qty number in args.quantity)
```

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/anthropic/voiceParse.ts
git commit -m "feat(voice): Gemini prompt classifies remove_last + set_qty

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Apply corrections in the `/voice` page

**Files:**
- Modify: `app/(dashboard)/voice/page.tsx`

**Interfaces:**
- Consumes: `removeLastRow`, `setLastRowQuantity` from `lib/voice/cart`; the extended `decideCommandAction`; `VoiceParseArgs` from `lib/voice/types`. `runCommand` now takes `(command, args)` and `onResult` passes `r.args`.

- [ ] **Step 1: Extend the imports**

In `app/(dashboard)/voice/page.tsx`, replace the cart import line:

```tsx
import { addRowsToCart, setRowQuantity, cartTotal } from '@/lib/voice/cart'
```

with:

```tsx
import { addRowsToCart, setRowQuantity, cartTotal, removeLastRow, setLastRowQuantity } from '@/lib/voice/cart'
```

and replace the types import line:

```tsx
import type { VoiceCartRow, VoiceParseResponse, VoiceCommand } from '@/lib/voice/types'
```

with:

```tsx
import type { VoiceCartRow, VoiceParseResponse, VoiceCommand, VoiceParseArgs } from '@/lib/voice/types'
```

- [ ] **Step 2: Apply corrections in `runCommand` and pass `args` from `onResult`**

Replace the `runCommand` definition:

```tsx
  const runCommand = useCallback((command: VoiceCommand) => {
    const cart = stateRef.current.rows
    const action = decideCommandAction(command, cart.length)
    if (action.speakTotal) speak(buildBalanceSpeech(cartTotal(cart)))
    if (action.save) void saveCart()
    if (action.closeSession) stopRef.current()
  }, [saveCart])
```

with:

```tsx
  const runCommand = useCallback((command: VoiceCommand, args: VoiceParseArgs) => {
    const cart = stateRef.current.rows
    const action = decideCommandAction(command, cart.length, args)
    if (action.speakTotal) speak(buildBalanceSpeech(cartTotal(cart)))
    if (action.removeLast) setRows((prev) => removeLastRow(prev))
    if (action.setQty !== null) {
      const qty = action.setQty
      setRows((prev) => setLastRowQuantity(prev, qty))
    }
    if (action.save) void saveCart()
    if (action.closeSession) stopRef.current()
  }, [saveCart])
```

and replace the command dispatch line inside `onResult`:

```tsx
    if (r.kind === 'command' && r.command) runCommand(r.command)
```

with:

```tsx
    if (r.kind === 'command' && r.command) runCommand(r.command, r.args)
```

- [ ] **Step 3: Update the CHANGES block**

Add to the page's file-comment CHANGES section:

```
 *   - Layer 3: voice corrections (remove_last drops the last row, set_qty sets
 *     the last row's quantity); runCommand now receives args
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, `/voice` route present. (OneDrive `.next` EINVAL -> `rm -rf .next && npm run build`.)

- [ ] **Step 5: Run the unit suite (no regressions)**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/voice/page.tsx"
git commit -m "feat(voice): apply remove-last / set-qty corrections in the voice page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Layer 3 verification + handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Full automated verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; all vitest tests pass (Layer 1+2 suite + the new cart/command tests); build succeeds with `/voice` present.

- [ ] **Step 2: Real-device manual pass (corrections)**

On a mid-range Android, on the `voice-layer-3` preview deployment, in a voice session with items in the cart:

1. Say "aakhri hata do" (or "remove last"). Confirm the last cart row disappears.
2. Say "galat" right after a mis-heard item. Confirm it drops the last row.
3. Say "teen kar do" (or "make it 3"). Confirm the last row's quantity becomes 3.
4. Say "set quantity zero" (or tap the row trash). Confirm the last row is removed.
5. Confirm the per-row trash / +/- buttons still work as the manual equivalents.
6. Edge: say "aakhri hata do" with an empty cart - confirm no crash, nothing happens.
7. Confirm corrections do not trigger a save (only "agla"/"khatam" save).

- [ ] **Step 3: Update HANDOFF.md**

In `HANDOFF.md`: under "Built & live", note Layer 3 corrections shipped on `voice-layer-3`. In NEXT, set the next build to "Voice Layer 4: udhaar by voice + balance-by-name" and keep the device-test + merge reminders (now `voice-layer-3` carries Layers 1-3). Commit:

```bash
git add HANDOFF.md
git commit -m "docs: handoff - Voice Layer 3 (corrections) shipped, Layer 4 next

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- **`remove last / aakhri hata do` (drop the last cart row):** Task 1 `removeLastRow` + decider `removeLast` (no-op on empty) + Task 2 prompt mapping + Task 3 page apply. Covered.
- **`set qty / "teen kar do" / change to 3` (set the last row's quantity):** Task 1 `setLastRowQuantity` (reuses `setRowQuantity`, so qty<=0 removes) + decider `setQty` from `args.quantity` + Task 2 prompt mapping (number into `args.quantity`) + Task 3 page apply. Covered.
- **Every voice command has a button equivalent:** the per-row trash + +/- in `VoiceCart` (Layer 1) cover remove-last and set-qty; noted, no new UI. Covered.
- **Corrections do not blind-save:** decider's `removeLast`/`setQty` never set `save`/`closeSession`; the visible cart updates in place. Covered.
- **No-op safety for empty cart / missing quantity:** `removeLast: cartCount > 0`; `setQty` null unless a positive `args.quantity`; cart ops empty-safe. Covered.
- **Deferred (Layer 4) untouched:** `attach_customer` + `null` -> no-op. Covered.
- **Testing per spec (unit-test pure logic; tsc/build; device):** Task 1 vitest TDD; Task 2 tsc (prompt is NL, validated on device); Task 3 tsc/build; Task 4 device pass. Covered.
- **Type consistency:** `CommandAction` 5-field shape identical across `command.ts` and `command.test.ts`; `decideCommandAction(command, cartCount, args?)` matches its call in `runCommand`; `removeLastRow` / `setLastRowQuantity` signatures match their page calls; `VoiceParseArgs` reused from types; `runCommand(command, args)` matches `onResult`'s `r.args`. Verified.

No placeholder steps; every code step shows complete code; every command lists expected output.
