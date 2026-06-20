# Voice-First Sales Session - Layer 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the core hands-free sales loop: a `/voice` screen where the merchant taps the mic once, speaks items in Hinglish, each pause-segmented phrase is parsed by Gemini audio + matched to the catalog server-side, lands in a live cart, and is saved as a cash sale.

**Architecture:** One new client screen (`/voice`) drives a browser audio loop: MediaRecorder captures a segment, a pure VAD helper ends the segment on ~1s of silence, the clip is POSTed to a new `/api/voice/parse` route. The route calls Gemini audio (one JSON: transcript + kind + items/command), matches items to the store catalog via the existing pure `matchItem`, creates active products for misses, and returns cart rows. The client merges them into a live cart and saves via the existing `POST /api/entry/quick`. All branching logic (Gemini-JSON normalization, match->row mapping, cart math, VAD decision) lives in pure, unit-tested `lib/voice/*` modules; the browser/network shells are verified by `tsc`/`build` + a real-device manual pass (as the spec specifies).

**Tech Stack:** Next.js 14 App Router (TS strict), Tailwind + shadcn/ui, Supabase (Postgres + RLS), Google Gemini 2.5 Flash audio (`@google/genai`, `lib/anthropic/client.ts`), vitest, Web Audio API + MediaRecorder, browser SpeechSynthesis (Layer 2).

## Global Constraints

Copied verbatim from `CLAUDE.md` / `HANDOFF.md`. Every task implicitly includes these.

- **NO em dashes (—) anywhere** - in code, comments, UI copy, prompts, or commit messages. Use a comma, period, parentheses, or a spaced hyphen ( - ).
- **AI is Google Gemini, NOT Claude**, despite the `lib/anthropic/` folder name. Use `getGeminiClient` + `DEFAULT_GEMINI_MODEL` from `lib/anthropic/client.ts`.
- **Every new file gets the project file-comment block** (FILE / WHAT THIS DOES / CHANGES THIS SESSION / WHERE IT FITS / CALLED BY / IMPORTS FROM). Update CHANGES on touched files.
- **Every clickable element:** `cursor: pointer`; disabled: `cursor: not-allowed`. **Every interactive element:** a visible hover lift via `.btn-lift` (buttons/nav/links) or `.row-lift` (list rows) or `.card-lift` (cards) from `app/globals.css`.
- **snake_case vs camelCase trap:** Supabase/PostgREST returns snake_case (`selling_price`, `current_balance`). Normalize at the fetch boundary. `₹NaN` = wrong-case read.
- **Work directly on `main`.** Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Confirm before pushing.
- **Per-layer verification before commit:** `npx tsc --noEmit`, `npm test`, `npm run build` all green. (OneDrive `.next` EINVAL: `rm -rf .next && npm run build` if the build flakes.)
- **Vitest only discovers `lib/**/*.test.ts`** (see `vitest.config.ts`, `environment: 'node'`). All unit tests in this plan live under `lib/voice/`.

## Layer 1 scope (this plan)

In scope: `/voice` screen, mic capture, VAD auto-segment, `POST /api/voice/parse` (Gemini audio -> catalog-matched items), live cart with +/- and tap-to-edit, on-screen **Save (cash)** button, navigation entry, honest mic-denied / offline / error states.

Deferred to later layers (do NOT build here): voice commands `next` / `close` / `read_balance` TTS (Layer 2); `remove_last` / `set_qty` corrections (Layer 3); udhaar-by-voice + balance-by-name (Layer 4). The parse route still *classifies* a `command` kind and returns it; the Layer 1 screen just surfaces the transcript for a command and takes no action (Layer 2 wires the handlers). Saving in Layer 1 is the on-screen button only.

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `lib/voice/types.ts` | Shared voice types (parse result, cart row, API response) | 1 |
| `lib/voice/parseGemini.ts` | Pure: normalize raw Gemini JSON -> `VoiceParseResult` | 1 |
| `lib/voice/parseGemini.test.ts` | Unit tests for the normalizer | 1 |
| `lib/voice/buildCartRow.ts` | Pure: `MatchResult` + spoken item -> `PendingCartRow` | 2 |
| `lib/voice/buildCartRow.test.ts` | Unit tests for the mapper | 2 |
| `lib/voice/cart.ts` | Pure: merge rows, set qty, cart total | 3 |
| `lib/voice/cart.test.ts` | Unit tests for cart math | 3 |
| `lib/voice/vad.ts` | Pure: RMS + silence-based segment finalization + tunable constants | 4 |
| `lib/voice/vad.test.ts` | Unit tests for the VAD state machine | 4 |
| `lib/anthropic/voiceParse.ts` | Gemini audio call -> `VoiceParseResult` | 5 |
| `app/api/voice/parse/route.ts` | Auth, rate limit, decode audio, parse, match, create-new, respond | 6 |
| `hooks/useVoiceSession.ts` | Browser shell: getUserMedia + MediaRecorder + VAD loop + POST | 7 |
| `components/voice/VoiceCart.tsx` | Live cart UI (rows, +/-, total) | 8 |
| `app/(dashboard)/voice/page.tsx` | The `/voice` screen: mic button, transcript, cart, Save | 8 |
| `components/voice/VoiceFab.tsx` | Mobile floating mic shortcut to `/voice` | 9 |
| `components/shared/Sidebar.tsx` | Add desktop `/voice` nav item | 9 |
| `app/(dashboard)/layout.tsx` | Mount `VoiceFab` | 9 |

---

### Task 1: Voice types + Gemini-JSON normalizer

**Files:**
- Create: `lib/voice/types.ts`
- Create: `lib/voice/parseGemini.ts`
- Test: `lib/voice/parseGemini.test.ts`

**Interfaces:**
- Produces: `VoiceCommand`, `VoiceParseItem { name; quantity; unit? }`, `VoiceParseArgs { quantity?; customerName? }`, `VoiceParseResult { transcript; kind; items; command; args }`, `VoiceCartRow { productId; name; quantity; unitPrice; addedAsNew }`, `VoiceParseResponse { transcript; kind; cartItems; command; args }`. `normalizeVoiceParse(raw: unknown): VoiceParseResult`.

- [ ] **Step 1: Create the types file**

```ts
/**
 * FILE: lib/voice/types.ts
 *
 * WHAT THIS DOES:
 *   Shared types for the voice-first sales session: the engine-level parse
 *   result (pre catalog match), the live cart row (post match), and the
 *   /api/voice/parse response shape.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Imported by lib/voice/*, lib/anthropic/voiceParse.ts,
 *   app/api/voice/parse/route.ts, hooks/useVoiceSession.ts, and the /voice page.
 *
 * CALLED BY / IMPORTS FROM:
 *   No imports. Pure type module.
 */

export type VoiceCommand =
  | 'next'
  | 'close'
  | 'read_balance'
  | 'remove_last'
  | 'set_qty'
  | 'attach_customer'

export interface VoiceParseItem {
  name: string
  quantity: number
  unit?: string
}

export interface VoiceParseArgs {
  quantity?: number
  customerName?: string
}

// Engine-level result straight from Gemini, before any catalog matching.
export interface VoiceParseResult {
  transcript: string
  kind: 'items' | 'command'
  items: VoiceParseItem[]
  command: VoiceCommand | null
  args: VoiceParseArgs
}

// A row in the live cart. Always carries a productId (add-as-new rows get one
// created server-side at parse time) so Save can reuse /api/entry/quick.
export interface VoiceCartRow {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  addedAsNew: boolean
}

// Response body from POST /api/voice/parse.
export interface VoiceParseResponse {
  transcript: string
  kind: 'items' | 'command'
  cartItems: VoiceCartRow[]
  command: VoiceCommand | null
  args: VoiceParseArgs
}
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/voice/parseGemini.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeVoiceParse } from '@/lib/voice/parseGemini'

describe('normalizeVoiceParse', () => {
  it('coerces a well-formed items payload', () => {
    const r = normalizeVoiceParse({
      transcript: '5 Parle-G, ek doodh',
      kind: 'items',
      items: [
        { name: 'Parle-G', quantity: 5, unit: null },
        { name: 'Milk', quantity: 1, unit: 'litre' },
      ],
      command: null,
      args: {},
    })
    expect(r.kind).toBe('items')
    expect(r.items).toHaveLength(2)
    expect(r.items[1]).toEqual({ name: 'Milk', quantity: 1, unit: 'litre' })
    expect(r.command).toBeNull()
  })

  it('defaults a missing or non-positive quantity to 1 and drops nameless items', () => {
    const r = normalizeVoiceParse({
      items: [
        { name: 'Bread' },
        { name: '  ', quantity: 3 },
        { name: 'Eggs', quantity: 0 },
        { name: 'Sugar', quantity: -2 },
      ],
    })
    expect(r.items.map(i => i.name)).toEqual(['Bread', 'Eggs', 'Sugar'])
    expect(r.items.map(i => i.quantity)).toEqual([1, 1, 1])
  })

  it('recognizes a known command and infers kind when kind is absent', () => {
    const r = normalizeVoiceParse({ transcript: 'agla', command: 'NEXT', items: [] })
    expect(r.kind).toBe('command')
    expect(r.command).toBe('next')
  })

  it('rejects an unknown command string', () => {
    const r = normalizeVoiceParse({ command: 'do_a_backflip', items: [{ name: 'Rice', quantity: 2 }] })
    expect(r.command).toBeNull()
    expect(r.kind).toBe('items')
  })

  it('never throws on garbage and returns safe defaults', () => {
    const r = normalizeVoiceParse(null)
    expect(r).toEqual({ transcript: '', kind: 'items', items: [], command: null, args: {} })
  })

  it('extracts numeric args.quantity and trimmed customerName', () => {
    const r = normalizeVoiceParse({ command: 'set_qty', args: { quantity: 3, customerName: '  Sharma ji  ' } })
    expect(r.args).toEqual({ quantity: 3, customerName: 'Sharma ji' })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/voice/parseGemini.test.ts`
Expected: FAIL - cannot find module `@/lib/voice/parseGemini`.

- [ ] **Step 4: Write the implementation**

```ts
/**
 * FILE: lib/voice/parseGemini.ts
 *
 * WHAT THIS DOES:
 *   Pure normalizer. Turns the raw (untrusted) JSON Gemini returns for a spoken
 *   phrase into a typed VoiceParseResult: coerces item shapes, defaults bad
 *   quantities to 1, validates the command against the known set, and infers
 *   kind when absent. Never throws.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Called by lib/anthropic/voiceParse.ts after JSON.parse of the model output.
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/anthropic/voiceParse.ts ; imports types from lib/voice/types.ts
 */
import type {
  VoiceParseResult,
  VoiceParseItem,
  VoiceParseArgs,
  VoiceCommand,
} from './types'

const COMMANDS: readonly VoiceCommand[] = [
  'next', 'close', 'read_balance', 'remove_last', 'set_qty', 'attach_customer',
]

export function normalizeVoiceParse(raw: unknown): VoiceParseResult {
  const o = (raw ?? {}) as Record<string, unknown>

  const transcript = typeof o.transcript === 'string' ? o.transcript : ''

  const rawCommand = typeof o.command === 'string' ? o.command.trim().toLowerCase() : ''
  const command = (COMMANDS as readonly string[]).includes(rawCommand)
    ? (rawCommand as VoiceCommand)
    : null

  const rawItems = Array.isArray(o.items) ? o.items : []
  const items: VoiceParseItem[] = rawItems
    .map((it): VoiceParseItem | null => {
      const r = (it ?? {}) as Record<string, unknown>
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      if (!name) return null
      const q = Number(r.quantity)
      const quantity = Number.isFinite(q) && q > 0 ? q : 1
      const unitRaw = typeof r.unit === 'string' ? r.unit.trim() : ''
      return unitRaw ? { name, quantity, unit: unitRaw } : { name, quantity }
    })
    .filter((x): x is VoiceParseItem => x !== null)

  const rawArgs = (o.args ?? {}) as Record<string, unknown>
  const args: VoiceParseArgs = {}
  const aq = Number(rawArgs.quantity)
  if (Number.isFinite(aq) && aq > 0) args.quantity = aq
  if (typeof rawArgs.customerName === 'string' && rawArgs.customerName.trim()) {
    args.customerName = rawArgs.customerName.trim()
  }

  let kind: 'items' | 'command'
  if (o.kind === 'command') kind = 'command'
  else if (o.kind === 'items') kind = 'items'
  else kind = command ? 'command' : 'items'

  return { transcript, kind, items, command, args }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/voice/parseGemini.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/voice/types.ts lib/voice/parseGemini.ts lib/voice/parseGemini.test.ts
git commit -m "feat(voice): types + pure Gemini-JSON normalizer for voice parse

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Match -> pending-cart-row mapper

**Files:**
- Create: `lib/voice/buildCartRow.ts`
- Test: `lib/voice/buildCartRow.test.ts`

**Interfaces:**
- Consumes: `MatchResult` from `lib/scan/match` (`{ matchState; matchedProductId?; matchedProductName?; candidates: MatchCandidate[] }`, where `MatchCandidate = { productId; name; unitPrice; sizeToken }`), `VoiceParseItem` from `lib/voice/types`.
- Produces: `PendingCartRow { productId: string | null; name: string; quantity: number; unitPrice: number; addAsNew: boolean }`, `buildPendingRow(spoken: VoiceParseItem, match: MatchResult): PendingCartRow`.

Decision encoded here (hands-free CORE): a strong `matched` uses the matched product. A `suggest` or `variant_choice` takes the **top candidate** (best guess - avoids polluting the catalog when a near match exists). Only a true `unmatched` (no candidates) becomes add-as-new (`productId: null`), which the route then creates as an active product so it matches next time.

- [ ] **Step 1: Write the failing test**

```ts
// lib/voice/buildCartRow.test.ts
import { describe, it, expect } from 'vitest'
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import type { MatchResult } from '@/lib/scan/match'

describe('buildPendingRow', () => {
  it('uses the matched product id and its catalog price', () => {
    const match: MatchResult = {
      matchState: 'matched',
      matchedProductId: 'p1',
      matchedProductName: 'Parle-G 70g',
      candidates: [
        { productId: 'p1', name: 'Parle-G 70g', unitPrice: 10, sizeToken: '70g' },
        { productId: 'p2', name: 'Parle-G 140g', unitPrice: 20, sizeToken: '140g' },
      ],
    }
    const row = buildPendingRow({ name: 'Parle-G', quantity: 5 }, match)
    expect(row).toEqual({ productId: 'p1', name: 'Parle-G 70g', quantity: 5, unitPrice: 10, addAsNew: false })
  })

  it('falls back to the top candidate for a suggest match', () => {
    const match: MatchResult = {
      matchState: 'suggest',
      candidates: [
        { productId: 'm1', name: 'Amul Milk 500ml', unitPrice: 27, sizeToken: '500ml' },
        { productId: 'm2', name: 'Mother Dairy Milk 500ml', unitPrice: 26, sizeToken: '500ml' },
      ],
    }
    const row = buildPendingRow({ name: 'doodh', quantity: 1 }, match)
    expect(row.productId).toBe('m1')
    expect(row.unitPrice).toBe(27)
    expect(row.addAsNew).toBe(false)
  })

  it('falls back to the top candidate for a variant_choice match', () => {
    const match: MatchResult = {
      matchState: 'variant_choice',
      candidates: [
        { productId: 'a1', name: 'Atta 1kg', unitPrice: 50, sizeToken: '1kg' },
        { productId: 'a5', name: 'Atta 5kg', unitPrice: 230, sizeToken: '5kg' },
      ],
    }
    const row = buildPendingRow({ name: 'atta', quantity: 2 }, match)
    expect(row.productId).toBe('a1')
    expect(row.addAsNew).toBe(false)
  })

  it('marks a true unmatched item as add-as-new with the spoken name and price 0', () => {
    const match: MatchResult = { matchState: 'unmatched', candidates: [] }
    const row = buildPendingRow({ name: 'Imported Toffee', quantity: 3 }, match)
    expect(row).toEqual({ productId: null, name: 'Imported Toffee', quantity: 3, unitPrice: 0, addAsNew: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/voice/buildCartRow.test.ts`
Expected: FAIL - cannot find module `@/lib/voice/buildCartRow`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * FILE: lib/voice/buildCartRow.ts
 *
 * WHAT THIS DOES:
 *   Pure mapper. Given a spoken item and the catalog matcher's result, decides
 *   the cart row: use the matched product, else the best candidate, else flag
 *   it add-as-new (productId null) for the route to create. The spoken quantity
 *   is used verbatim (voice already knows the count - no qty inference).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Called per item by app/api/voice/parse/route.ts after matchItem().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/voice/parse/route.ts ; imports MatchResult from lib/scan/match
 *   and VoiceParseItem from lib/voice/types
 */
import type { MatchResult } from '@/lib/scan/match'
import type { VoiceParseItem } from './types'

export interface PendingCartRow {
  productId: string | null // null => create an active product (add-as-new)
  name: string
  quantity: number
  unitPrice: number
  addAsNew: boolean
}

export function buildPendingRow(spoken: VoiceParseItem, match: MatchResult): PendingCartRow {
  const useId = match.matchedProductId ?? match.candidates[0]?.productId
  if (useId) {
    const cat = match.candidates.find(c => c.productId === useId)
    return {
      productId: useId,
      name: cat?.name ?? match.matchedProductName ?? spoken.name,
      quantity: spoken.quantity,
      unitPrice: cat?.unitPrice ?? 0,
      addAsNew: false,
    }
  }
  return {
    productId: null,
    name: spoken.name,
    quantity: spoken.quantity,
    unitPrice: 0,
    addAsNew: true,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/voice/buildCartRow.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/voice/buildCartRow.ts lib/voice/buildCartRow.test.ts
git commit -m "feat(voice): pure match-to-cart-row mapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Cart reducer (merge / set-qty / total)

**Files:**
- Create: `lib/voice/cart.ts`
- Test: `lib/voice/cart.test.ts`

**Interfaces:**
- Consumes: `VoiceCartRow` from `lib/voice/types`.
- Produces: `addRowsToCart(cart: VoiceCartRow[], incoming: VoiceCartRow[]): VoiceCartRow[]` (merges same `productId` by summing quantity, immutable), `setRowQuantity(cart, productId, quantity): VoiceCartRow[]` (drops the row when `quantity <= 0`), `cartTotal(cart): number`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/voice/cart.test.ts
import { describe, it, expect } from 'vitest'
import { addRowsToCart, setRowQuantity, cartTotal } from '@/lib/voice/cart'
import type { VoiceCartRow } from '@/lib/voice/types'

const row = (productId: string, quantity: number, unitPrice: number): VoiceCartRow =>
  ({ productId, name: productId, quantity, unitPrice, addedAsNew: false })

describe('addRowsToCart', () => {
  it('appends new rows and merges duplicates by productId', () => {
    const cart = [row('a', 2, 10)]
    const next = addRowsToCart(cart, [row('a', 3, 10), row('b', 1, 50)])
    expect(next.find(r => r.productId === 'a')!.quantity).toBe(5)
    expect(next.find(r => r.productId === 'b')!.quantity).toBe(1)
  })

  it('does not mutate the input cart', () => {
    const cart = [row('a', 2, 10)]
    addRowsToCart(cart, [row('a', 3, 10)])
    expect(cart[0].quantity).toBe(2)
  })
})

describe('setRowQuantity', () => {
  it('sets the quantity of the matching row', () => {
    const next = setRowQuantity([row('a', 2, 10), row('b', 1, 50)], 'a', 7)
    expect(next.find(r => r.productId === 'a')!.quantity).toBe(7)
  })

  it('removes the row when quantity is zero or below', () => {
    const next = setRowQuantity([row('a', 2, 10), row('b', 1, 50)], 'a', 0)
    expect(next.map(r => r.productId)).toEqual(['b'])
  })
})

describe('cartTotal', () => {
  it('sums unitPrice * quantity across rows', () => {
    expect(cartTotal([row('a', 2, 10), row('b', 3, 50)])).toBe(170)
  })

  it('is zero for an empty cart', () => {
    expect(cartTotal([])).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/voice/cart.test.ts`
Expected: FAIL - cannot find module `@/lib/voice/cart`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * FILE: lib/voice/cart.ts
 *
 * WHAT THIS DOES:
 *   Pure, immutable cart operations for the voice session: merge incoming
 *   matched rows (summing duplicates by productId), set a row's quantity
 *   (removing it at zero), and compute the running total.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Used by app/(dashboard)/voice/page.tsx to keep the live cart in sync as
 *   parsed phrases arrive and as the merchant taps +/-.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; imports VoiceCartRow from lib/voice/types
 */
import type { VoiceCartRow } from './types'

export function addRowsToCart(cart: VoiceCartRow[], incoming: VoiceCartRow[]): VoiceCartRow[] {
  const next = cart.map(r => ({ ...r }))
  for (const row of incoming) {
    const existing = next.find(r => r.productId === row.productId)
    if (existing) existing.quantity += row.quantity
    else next.push({ ...row })
  }
  return next
}

export function setRowQuantity(cart: VoiceCartRow[], productId: string, quantity: number): VoiceCartRow[] {
  if (quantity <= 0) return cart.filter(r => r.productId !== productId)
  return cart.map(r => (r.productId === productId ? { ...r, quantity } : r))
}

export function cartTotal(cart: VoiceCartRow[]): number {
  return cart.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/voice/cart.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/voice/cart.ts lib/voice/cart.test.ts
git commit -m "feat(voice): pure live-cart reducer (merge, set-qty, total)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: VAD decision helper

**Files:**
- Create: `lib/voice/vad.ts`
- Test: `lib/voice/vad.test.ts`

**Interfaces:**
- Produces: tunable constants `VAD_SILENCE_THRESHOLD`, `VAD_SILENCE_MS`, `VAD_MIN_SPEECH_MS`; `computeRms(samples: Float32Array): number`; `VadState { speaking: boolean; speechMs: number; silenceMs: number }`; `initVadState(): VadState`; `advanceVad(state, rms, frameMs, opts?): { state: VadState; finalize: boolean }`.

This is the only testable part of the audio loop. `advanceVad` is a pure state machine: a frame above threshold is speech (resets trailing silence); once speaking, frames below threshold accumulate silence; a phrase **finalizes** when it had at least `minSpeechMs` of speech followed by at least `silenceMs` of trailing silence. On finalize, the returned state resets so the next phrase starts clean.

- [ ] **Step 1: Write the failing test**

```ts
// lib/voice/vad.test.ts
import { describe, it, expect } from 'vitest'
import { computeRms, initVadState, advanceVad } from '@/lib/voice/vad'

describe('computeRms', () => {
  it('is zero for silence', () => {
    expect(computeRms(new Float32Array([0, 0, 0, 0]))).toBe(0)
  })
  it('is the root-mean-square of the samples', () => {
    // rms of [0.5, -0.5] = sqrt((0.25 + 0.25) / 2) = 0.5
    expect(computeRms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5, 6)
  })
  it('is zero for an empty buffer', () => {
    expect(computeRms(new Float32Array([]))).toBe(0)
  })
})

describe('advanceVad', () => {
  const opts = { threshold: 0.02, silenceMs: 900, minSpeechMs: 300 }

  it('does not finalize on silence before any speech', () => {
    let s = initVadState()
    for (let i = 0; i < 30; i++) {
      const r = advanceVad(s, 0.0, 50, opts)
      s = r.state
      expect(r.finalize).toBe(false)
    }
    expect(s.speaking).toBe(false)
  })

  it('finalizes after enough speech then ~900ms of trailing silence', () => {
    let s = initVadState()
    // 400ms of speech (8 loud frames of 50ms)
    for (let i = 0; i < 8; i++) s = advanceVad(s, 0.1, 50, opts).state
    expect(s.speaking).toBe(true)
    // 850ms of silence: not yet
    let finalized = false
    for (let i = 0; i < 17; i++) {
      const r = advanceVad(s, 0.0, 50, opts)
      s = r.state
      finalized = finalized || r.finalize
    }
    expect(finalized).toBe(false)
    // one more 50ms frame crosses 900ms -> finalize
    const r = advanceVad(s, 0.0, 50, opts)
    expect(r.finalize).toBe(true)
    expect(r.state).toEqual(initVadState()) // resets for the next phrase
  })

  it('ignores a brief blip shorter than minSpeechMs', () => {
    let s = initVadState()
    s = advanceVad(s, 0.1, 50, opts).state // 50ms of speech only
    let finalized = false
    for (let i = 0; i < 30; i++) {
      const r = advanceVad(s, 0.0, 50, opts)
      s = r.state
      finalized = finalized || r.finalize
    }
    expect(finalized).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/voice/vad.test.ts`
Expected: FAIL - cannot find module `@/lib/voice/vad`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * FILE: lib/voice/vad.ts
 *
 * WHAT THIS DOES:
 *   Pure voice-activity-detection helpers for the continuous mic loop. Computes
 *   RMS volume per audio frame and runs a small state machine that finalizes a
 *   spoken phrase after enough speech followed by ~1s of trailing silence.
 *   Thresholds are exported constants so they can be tuned on real devices.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Driven frame-by-frame by hooks/useVoiceSession.ts against an AnalyserNode.
 *
 * CALLED BY / IMPORTS FROM:
 *   hooks/useVoiceSession.ts ; no imports.
 */

// Tune on real devices. RMS is 0..1 on getFloatTimeDomainData output.
export const VAD_SILENCE_THRESHOLD = 0.015 // below this a frame is "silence"
export const VAD_SILENCE_MS = 900          // ~1s of trailing silence ends a phrase
export const VAD_MIN_SPEECH_MS = 300       // ignore blips shorter than this

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

export interface VadState {
  speaking: boolean
  speechMs: number
  silenceMs: number
}

export function initVadState(): VadState {
  return { speaking: false, speechMs: 0, silenceMs: 0 }
}

export function advanceVad(
  state: VadState,
  rms: number,
  frameMs: number,
  opts: { threshold?: number; silenceMs?: number; minSpeechMs?: number } = {},
): { state: VadState; finalize: boolean } {
  const threshold = opts.threshold ?? VAD_SILENCE_THRESHOLD
  const silenceLimit = opts.silenceMs ?? VAD_SILENCE_MS
  const minSpeech = opts.minSpeechMs ?? VAD_MIN_SPEECH_MS

  let { speaking, speechMs, silenceMs } = state
  const loud = rms >= threshold

  if (loud) {
    speaking = true
    speechMs += frameMs
    silenceMs = 0
  } else if (speaking) {
    silenceMs += frameMs
  }

  const finalize = speaking && speechMs >= minSpeech && silenceMs >= silenceLimit
  const nextState = finalize ? initVadState() : { speaking, speechMs, silenceMs }
  return { state: nextState, finalize }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/voice/vad.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full unit suite and commit**

Run: `npm test`
Expected: all prior tests + the new voice tests PASS (no regressions).

```bash
npx tsc --noEmit
git add lib/voice/vad.ts lib/voice/vad.test.ts
git commit -m "feat(voice): pure VAD segment-finalization helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Gemini audio caller

**Files:**
- Create: `lib/anthropic/voiceParse.ts`

**Interfaces:**
- Consumes: `getGeminiClient`, `DEFAULT_GEMINI_MODEL` from `lib/anthropic/client`; `normalizeVoiceParse` from `lib/voice/parseGemini`.
- Produces: `parseVoiceAudio(audioBase64: string, mimeType: string): Promise<VoiceParseResult>`.

This mirrors `lib/anthropic/extraction.ts` but sends an audio clip instead of an image and asks for the transcript + items/command JSON. No vitest (it makes a network call); it is verified by `tsc` and exercised in the Task 6 route + the Task 10 manual pass.

- [ ] **Step 1: Write the implementation**

```ts
/**
 * FILE: lib/anthropic/voiceParse.ts
 *
 * WHAT THIS DOES:
 *   Sends one short spoken-phrase audio clip to Gemini and gets back a single
 *   JSON: the transcript, whether it is items or a command, the parsed items
 *   (Hindi expanded to clean English names, Hinglish numbers read), and the
 *   command if any. Returns a typed, normalized VoiceParseResult.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1). Gemini audio, NOT Claude.
 *
 * WHERE IT FITS:
 *   Called by app/api/voice/parse/route.ts with the base64 audio segment.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/voice/parse/route.ts ; uses lib/anthropic/client.ts and
 *   lib/voice/parseGemini.ts
 */
import type { VoiceParseResult } from '@/lib/voice/types'
import { normalizeVoiceParse } from '@/lib/voice/parseGemini'
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from './client'

const SYSTEM_INSTRUCTION = `You are a voice assistant for an Indian kirana (grocery) shopkeeper logging sales hands-free at the counter, mid-rush, speaking Hinglish. You receive a short audio clip of ONE spoken phrase. Return ONLY valid JSON, no markdown.

First decide: is the phrase a list of ITEMS being sold, or a COMMAND to the app?

Map command phrases to one of these (else it is items):
- "next" / "agla" / "agla customer" / "iska ho gaya" -> "next"
- "close" / "khatam" / "bas" / "ho gaya" / "band karo" -> "close"
- "balance" / "hisab" / "total" / "kitna hua" / "kitne ka" -> "read_balance"

For ITEMS, expand common Hindi to clean English product names (doodh->milk, chawal->rice, cheeni->sugar, atta->wheat flour, anda->egg, tel->oil, namak->salt). Keep brand names exactly (Parle-G, Thums Up, Amul, Maggi). Read Hindi/Hinglish numbers (ek=1, do=2, teen=3, chaar=4, paanch=5, das=10, dozen=12). If no number is spoken for an item, use quantity 1.

Return exactly:
{
  "transcript": string,
  "kind": "items" | "command",
  "items": [ { "name": string, "quantity": number, "unit": string | null } ],
  "command": "next" | "close" | "read_balance" | null,
  "args": { "quantity": number | null, "customerName": string | null }
}`

export async function parseVoiceAudio(
  audioBase64: string,
  mimeType: string,
): Promise<VoiceParseResult> {
  const genAI = getGeminiClient()
  const response = await genAI.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: audioBase64, mimeType } },
        { text: 'Parse this spoken phrase into the JSON schema.' },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  })

  let text = (response.text ?? '').trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {}
  }
  return normalizeVoiceParse(parsed)
}
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/anthropic/voiceParse.ts
git commit -m "feat(voice): Gemini audio caller for spoken-phrase parsing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: `POST /api/voice/parse` route

**Files:**
- Create: `app/api/voice/parse/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient`, `aiRateLimit`, `parseVoiceAudio`, `matchItem` + `CatalogEntry` from `lib/scan/match`, `buildPendingRow`, types from `lib/voice/types`.
- Produces: HTTP endpoint returning `VoiceParseResponse`. For `kind === 'command'`, returns the command with an empty `cartItems`. For `kind === 'items'`, matches each item to the active catalog, creates an active product for true misses, and returns `cartItems` (every row has a `productId`).

Pattern follows `app/api/scan/route.ts` (auth -> rate limit -> store -> validate input -> AI -> match -> respond). The catalog load mirrors `lib/scan/resolve.ts` (active products + 30-day frequency) but always prices from `selling_price` (voice logs sales). A private `loadCatalog` helper keeps it self-contained; do not refactor `resolve.ts`.

- [ ] **Step 1: Write the implementation**

```ts
/**
 * FILE: app/api/voice/parse/route.ts
 *
 * WHAT THIS DOES:
 *   POST: receives one spoken-phrase audio clip (multipart "audio"), validates
 *   type+size, sends it to Gemini audio, and returns a VoiceParseResponse. For
 *   items it matches each against the store's active catalog and creates an
 *   active product for true misses (so they match next time); for a command it
 *   passes the classification back to the client.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Called by hooks/useVoiceSession.ts once per VAD-finalized segment.
 *
 * CALLED BY / IMPORTS FROM:
 *   hooks/useVoiceSession.ts ; uses lib/anthropic/voiceParse.ts, lib/scan/match.ts,
 *   lib/voice/buildCartRow.ts, lib/ratelimit.ts
 */
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { aiRateLimit } from '@/lib/ratelimit'
import { parseVoiceAudio } from '@/lib/anthropic/voiceParse'
import { matchItem, type CatalogEntry } from '@/lib/scan/match'
import { buildPendingRow } from '@/lib/voice/buildCartRow'
import type { VoiceCartRow, VoiceParseResponse } from '@/lib/voice/types'

const ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await aiRateLimit(user.id)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many voice requests. Please wait a moment and try again.' },
      { status: 429 },
    )
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('audio') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No audio provided' }, { status: 400 })
  }
  const mime = (file.type || 'audio/webm').split(';')[0].trim()
  if (!ALLOWED_TYPES.includes(mime)) {
    return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio clip too large' }, { status: 400 })
  }

  const audioBase64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  let parsed
  try {
    parsed = await parseVoiceAudio(audioBase64, mime)
  } catch {
    return NextResponse.json({ error: 'voice_parse_failed' }, { status: 422 })
  }

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

  // Items: match against the catalog; create active products for true misses.
  const catalog = await loadCatalog(supabase, store.id)
  const cartItems: VoiceCartRow[] = []
  for (const spoken of parsed.items) {
    const sizeToken = spoken.unit && /\d/.test(spoken.unit) ? spoken.unit : null
    const match = matchItem({ normalizedName: spoken.name, sizeToken }, catalog)
    const pending = buildPendingRow(spoken, match)

    let productId = pending.productId
    let unitPrice = pending.unitPrice
    if (!productId) {
      const { data: created } = await supabase
        .from('products')
        .insert({
          store_id: store.id,
          name: pending.name,
          category: 'Uncategorised',
          unit: 'piece',
          purchase_price: 0,
          selling_price: 0,
          tax_rate: 0,
          is_active: true,
          is_pinned: false,
        })
        .select('id')
        .single()
      if (!created) continue // could not create - skip this item rather than 500
      productId = created.id
      unitPrice = 0
    }

    cartItems.push({
      productId,
      name: pending.name,
      quantity: pending.quantity,
      unitPrice,
      addedAsNew: pending.addAsNew,
    })
  }

  const res: VoiceParseResponse = {
    transcript: parsed.transcript,
    kind: 'items',
    cartItems,
    command: null,
    args: parsed.args,
  }
  return NextResponse.json(res)
}

// Active catalog + 30-day purchase frequency, priced from selling_price
// (voice logs sales). Mirrors lib/scan/resolve.ts without coupling to it.
async function loadCatalog(supabase: SupabaseClient, storeId: string): Promise<CatalogEntry[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, brand, parent_product_id, selling_price')
    .eq('store_id', storeId)
    .eq('is_active', true)

  const since = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const { data: recentTx } = await supabase
    .from('transactions')
    .select('id')
    .eq('store_id', storeId)
    .gte('date', since)
  const txIds = (recentTx ?? []).map((t: { id: string }) => t.id)

  const freq: Record<string, number> = {}
  if (txIds.length > 0) {
    const { data: lineItems } = await supabase
      .from('transaction_items')
      .select('product_id')
      .in('transaction_id', txIds)
    for (const li of lineItems ?? []) freq[li.product_id] = (freq[li.product_id] ?? 0) + 1
  }

  return (products ?? []).map((p: {
    id: string; name: string; brand: string | null
    parent_product_id: string | null; selling_price: number
  }) => ({
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    parentId: p.parent_product_id ?? null,
    unitPrice: Number(p.selling_price) || 0,
    freq: freq[p.id] ?? 0,
  }))
}
```

- [ ] **Step 2: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (If the build hits the OneDrive `.next` EINVAL readlink error, run `rm -rf .next && npm run build`.)

- [ ] **Step 3: Commit**

```bash
git add app/api/voice/parse/route.ts
git commit -m "feat(voice): POST /api/voice/parse - Gemini audio + catalog match

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Client voice-session hook

**Files:**
- Create: `hooks/useVoiceSession.ts`

**Interfaces:**
- Consumes: `advanceVad`, `computeRms`, `initVadState`, `VadState` from `lib/voice/vad`; `VoiceParseResponse` from `lib/voice/types`.
- Produces: `useVoiceSession(onResult: (r: VoiceParseResponse) => void): { status: VoiceStatus; lastTranscript: string; start: () => Promise<void>; stop: () => void }` where `VoiceStatus = 'idle' | 'listening' | 'thinking' | 'error' | 'denied' | 'offline'`.

Browser shell (no vitest - relies on `getUserMedia`/`MediaRecorder`/`AudioContext`). The continuous mic feeds an `AnalyserNode`; a ~50ms interval computes RMS and drives `advanceVad`. On the speech-start edge it starts a `MediaRecorder`; on `finalize` it stops it; `onstop` POSTs the clip to `/api/voice/parse` and calls `onResult`. Verified by `tsc`/`build` + the Task 10 device pass.

- [ ] **Step 1: Write the implementation**

```ts
/**
 * FILE: hooks/useVoiceSession.ts
 *
 * WHAT THIS DOES:
 *   Runs the continuous mic loop for the voice sales session. Captures audio,
 *   uses the pure VAD helper to cut each spoken phrase on ~1s of silence, POSTs
 *   the clip to /api/voice/parse, and reports the result + a status the UI shows
 *   (listening / thinking / denied / offline / error).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Used by app/(dashboard)/voice/page.tsx behind the mic button.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; uses lib/voice/vad.ts and lib/voice/types.ts
 */
'use client'
import { useCallback, useRef, useState } from 'react'
import { advanceVad, computeRms, initVadState, type VadState } from '@/lib/voice/vad'
import type { VoiceParseResponse } from '@/lib/voice/types'

const FRAME_MS = 50
const MIN_CLIP_BYTES = 1200 // ignore clips too short to contain speech

export type VoiceStatus = 'idle' | 'listening' | 'thinking' | 'error' | 'denied' | 'offline'

export function useVoiceSession(onResult: (r: VoiceParseResponse) => void) {
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [lastTranscript, setLastTranscript] = useState('')

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const vadRef = useRef<VadState>(initVadState())
  const loopRef = useRef<number | null>(null)
  const bufRef = useRef<Float32Array | null>(null)

  const send = useCallback(async (blob: Blob) => {
    if (blob.size < MIN_CLIP_BYTES) { setStatus('listening'); return }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setStatus('offline'); return }
    setStatus('thinking')
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'clip.webm')
      const res = await fetch('/api/voice/parse', { method: 'POST', body: fd })
      if (!res.ok) { setStatus('error'); return }
      const data: VoiceParseResponse = await res.json()
      if (data.transcript) setLastTranscript(data.transcript)
      onResult(data)
      setStatus('listening')
    } catch {
      setStatus('error')
    }
  }, [onResult])

  const startRecorder = useCallback(() => {
    if (recorderRef.current || !streamRef.current) return
    const rec = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      recorderRef.current = null
      void send(blob)
    }
    rec.start()
    recorderRef.current = rec
  }, [send])

  const tick = useCallback(() => {
    const analyser = analyserRef.current
    const buf = bufRef.current
    if (!analyser || !buf) return
    analyser.getFloatTimeDomainData(buf)
    const rms = computeRms(buf)
    const wasSpeaking = vadRef.current.speaking
    const { state, finalize } = advanceVad(vadRef.current, rms, FRAME_MS)
    vadRef.current = state
    if (!wasSpeaking && state.speaking) startRecorder()
    if (finalize && recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [startRecorder])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)
      vadRef.current = initVadState()
      loopRef.current = window.setInterval(tick, FRAME_MS)
      setStatus('listening')
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setStatus(denied ? 'denied' : 'error')
    }
  }, [tick])

  const stop = useCallback(() => {
    if (loopRef.current !== null) { clearInterval(loopRef.current); loopRef.current = null }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    setStatus('idle')
  }, [])

  return { status, lastTranscript, start, stop }
}
```

- [ ] **Step 2: Verify typecheck and commit**

Run: `npx tsc --noEmit`
Expected: PASS. (If `MediaRecorder`/`AudioContext`/`getFloatTimeDomainData` types are missing, confirm `tsconfig.json` `lib` includes `"DOM"` - it does for a Next.js app; do NOT add new libs.)

```bash
git add hooks/useVoiceSession.ts
git commit -m "feat(voice): browser mic + VAD session hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Cart UI + `/voice` screen + Save

**Files:**
- Create: `components/voice/VoiceCart.tsx`
- Create: `app/(dashboard)/voice/page.tsx`

**Interfaces:**
- Consumes: `useVoiceSession`, `addRowsToCart` + `setRowQuantity` + `cartTotal` from `lib/voice/cart`, `VoiceCartRow` + `VoiceParseResponse` from `lib/voice/types`. Save reuses `POST /api/entry/quick` with body `{ type: 'sale', paymentMethod: 'cash', items: VoiceCartRow -> { productId, quantity } }` (the route prices each line from the product's `selling_price`).
- Produces: the `/voice` route UI.

In Layer 1, a `kind === 'command'` result only updates the transcript line (no action); voice command handlers land in Layer 2. Save is the on-screen **Save (cash)** button.

- [ ] **Step 1: Write the cart component**

```tsx
/**
 * FILE: components/voice/VoiceCart.tsx
 *
 * WHAT THIS DOES:
 *   Presentational live cart for the voice session. Renders each row (name, +/-
 *   quantity, line total), a running total, and an empty-state coach line. All
 *   controls are tappable fallbacks so a mis-parse is never a dead end.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Rendered by app/(dashboard)/voice/page.tsx.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; uses lib/voice/cart.ts and lib/voice/types.ts
 */
'use client'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { cartTotal } from '@/lib/voice/cart'
import type { VoiceCartRow } from '@/lib/voice/types'

export function VoiceCart({
  rows,
  onSetQty,
}: {
  rows: VoiceCartRow[]
  onSetQty: (productId: string, quantity: number) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Tap the mic and say what is selling - &quot;2 doodh, 5 Parle-G&quot;.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100">
      {rows.map((r) => (
        <div key={r.productId} className="row-lift flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-500">
              {r.unitPrice > 0 ? `₹${r.unitPrice} each` : 'No price set'}
              {r.addedAsNew ? ' - new item' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => onSetQty(r.productId, r.quantity - 1)}
              className="btn-lift flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 cursor-pointer"
            >
              {r.quantity <= 1 ? <Trash2 size={15} /> : <Minus size={15} />}
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums">{r.quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onSetQty(r.productId, r.quantity + 1)}
              className="btn-lift flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 cursor-pointer"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="w-16 text-right text-sm font-semibold tabular-nums text-gray-900">
            ₹{r.unitPrice * r.quantity}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-gray-500">Total</span>
        <span className="text-lg font-bold text-emerald-700 tabular-nums">₹{cartTotal(rows)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the `/voice` page**

```tsx
/**
 * FILE: app/(dashboard)/voice/page.tsx
 *
 * WHAT THIS DOES:
 *   The voice-first sales session screen. Tap the mic to listen, speak items in
 *   Hinglish, watch them land in a live cart (pause-segmented + Gemini-parsed +
 *   catalog-matched), then Save the cart as a cash sale. Honest mic-denied /
 *   offline / error states. Voice commands are surfaced as transcript only in
 *   Layer 1; their handlers arrive in Layer 2.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Reached from the Sidebar (desktop) and the VoiceFab (mobile).
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router ; uses hooks/useVoiceSession.ts, components/voice/VoiceCart.tsx,
 *   lib/voice/cart.ts, and POST /api/entry/quick
 */
'use client'
import { useCallback, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { useVoiceSession } from '@/hooks/useVoiceSession'
import { VoiceCart } from '@/components/voice/VoiceCart'
import { addRowsToCart, setRowQuantity, cartTotal } from '@/lib/voice/cart'
import type { VoiceCartRow, VoiceParseResponse } from '@/lib/voice/types'

export default function VoicePage() {
  const [rows, setRows] = useState<VoiceCartRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const onResult = useCallback((r: VoiceParseResponse) => {
    if (r.kind === 'items' && r.cartItems.length > 0) {
      setRows((prev) => addRowsToCart(prev, r.cartItems))
    }
    // Layer 1: a command result only shows its transcript (handled by the hook).
  }, [])

  const { status, lastTranscript, start, stop } = useVoiceSession(onResult)
  const listening = status === 'listening' || status === 'thinking'

  function setQty(productId: string, quantity: number) {
    setRows((prev) => setRowQuantity(prev, productId, quantity))
  }

  async function save() {
    if (rows.length === 0 || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/entry/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          paymentMethod: 'cash',
          items: rows.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        }),
      })
      if (!res.ok) { setSaveError('Could not save. Check your connection and try again.'); return }
      setRows([])
    } catch {
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Bolकर बेचो</h1>
        <p className="text-sm text-gray-500">Tap the mic and speak what is selling.</p>
      </header>

      {/* Mic + status */}
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          type="button"
          onClick={listening ? stop : start}
          className={`btn-lift flex h-20 w-20 items-center justify-center rounded-full text-white cursor-pointer ${
            listening
              ? 'bg-gradient-to-br from-rose-500 to-rose-700 animate-pulse'
              : 'bg-gradient-to-br from-emerald-500 to-emerald-700'
          }`}
          aria-label={listening ? 'Stop listening' : 'Start listening'}
        >
          {status === 'thinking' ? <Loader2 size={30} className="animate-spin" />
            : listening ? <Square size={26} /> : <Mic size={30} />}
        </button>
        <p className="h-5 text-sm text-gray-600">
          {status === 'denied' && 'Mic blocked. Allow microphone access in your browser to use voice.'}
          {status === 'offline' && 'You are offline. Voice needs an internet connection.'}
          {status === 'error' && 'Something went wrong. Tap the mic to try again.'}
          {status === 'thinking' && 'Listening...'}
          {status === 'listening' && 'Listening - speak now.'}
          {status === 'idle' && 'Tap to start.'}
        </p>
        {lastTranscript && (
          <p className="max-w-full truncate rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
            &ldquo;{lastTranscript}&rdquo;
          </p>
        )}
      </div>

      <VoiceCart rows={rows} onSetQty={setQty} />

      {saveError && <p className="text-sm text-rose-600">{saveError}</p>}

      {/* Footer: on-screen Save (button equivalent for the voice "next"/"close") */}
      <button
        type="button"
        onClick={save}
        disabled={rows.length === 0 || saving}
        className={`btn-lift w-full rounded-xl py-3.5 text-base font-semibold text-white ${
          rows.length === 0 || saving
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-emerald-600 cursor-pointer'
        }`}
      >
        {saving ? 'Saving...' : `Save sale (cash) - ₹${cartTotal(rows)}`}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (OneDrive `.next` EINVAL -> `rm -rf .next && npm run build`.)

- [ ] **Step 4: Commit**

```bash
git add components/voice/VoiceCart.tsx "app/(dashboard)/voice/page.tsx"
git commit -m "feat(voice): /voice screen - mic, live cart, save as cash sale

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Navigation entry (desktop + mobile)

**Files:**
- Modify: `components/shared/Sidebar.tsx` (add `/voice` to `PRIMARY_NAV`)
- Create: `components/voice/VoiceFab.tsx` (mobile floating mic shortcut)
- Modify: `app/(dashboard)/layout.tsx` (mount `VoiceFab`)

**Interfaces:**
- Produces: a `/voice` link in the desktop sidebar and a mobile FAB linking to `/voice`. (The mobile `BottomNav` 5-slot grid is full with a center Scan FAB; rather than redesign it, a small dedicated mic FAB sits above the bottom bar on mobile only.)

- [ ] **Step 1: Add the Sidebar nav item**

In `components/shared/Sidebar.tsx`, update the lucide import line and the `PRIMARY_NAV` array.

Change the import:

```ts
import {
  Home, Camera, Mic, PenLine, Package, Users,
  BarChart2, Bot, Settings,
} from 'lucide-react'
```

Add the Voice entry to `PRIMARY_NAV` (right after the Scan item):

```ts
const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Home',      Icon: Home      },
  { href: '/scan',      label: 'Scan Bill', Icon: Camera    },
  { href: '/voice',     label: 'Voice',     Icon: Mic       },
  { href: '/entry',     label: 'Entry',     Icon: PenLine   },
  { href: '/inventory', label: 'Stock',     Icon: Package   },
  { href: '/customers', label: 'Customers', Icon: Users     },
  { href: '/reports',   label: 'Reports',   Icon: BarChart2 },
  { href: '/advisor',   label: 'Advisor',   Icon: Bot       },
]
```

Also update the Sidebar file-comment block CHANGES line to note: `- Added Voice (/voice) nav item`.

- [ ] **Step 2: Create the mobile mic FAB**

```tsx
/**
 * FILE: components/voice/VoiceFab.tsx
 *
 * WHAT THIS DOES:
 *   Mobile-only floating mic button that links to /voice from any dashboard
 *   screen, so the merchant can start a hands-free sale in one tap. Hidden on
 *   desktop (the Sidebar has a Voice item) and hidden on /voice itself.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Mounted in app/(dashboard)/layout.tsx, sits above the BottomNav on mobile.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic } from 'lucide-react'

export function VoiceFab() {
  const pathname = usePathname()
  if (pathname.startsWith('/voice')) return null

  return (
    <Link
      href="/voice"
      aria-label="Speak to sell"
      className="btn-lift md:hidden fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-300/50 cursor-pointer"
    >
      <Mic size={24} />
    </Link>
  )
}
```

- [ ] **Step 3: Mount the FAB in the dashboard layout**

In `app/(dashboard)/layout.tsx`, add the import and render `<VoiceFab />` next to `<BottomNav />`.

Add the import (after the `BottomNav` import):

```ts
import { VoiceFab } from "@/components/voice/VoiceFab";
```

Update the returned JSX footer area:

```tsx
        <BottomNav />
        <VoiceFab />
```

Also update the layout file-comment block CHANGES line: `- Mounted VoiceFab (mobile mic shortcut to /voice)`.

- [ ] **Step 4: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/shared/Sidebar.tsx components/voice/VoiceFab.tsx "app/(dashboard)/layout.tsx"
git commit -m "feat(voice): nav entry - sidebar item + mobile mic FAB

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Layer 1 end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full automated verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; all vitest tests pass (prior suite + 22 new voice tests); production build succeeds.

- [ ] **Step 2: Real-device manual pass (the spec's required test)**

On a mid-range Android over real network, signed in as a store with a catalog (use the Ram Kirana demo catalog via Settings -> Sample Templates -> Kirana, or `supabase/seeds/ram-kirana-products.csv`):

1. Open `/voice` (mobile FAB or sidebar). Tap the mic - grant permission.
2. Speak 5+ items in Hinglish with background noise: e.g. "paanch Parle-G, ek doodh, do Maggi, teen bread". Confirm each phrase lands as a cart row with the catalog name + price, quantities correct, total right.
3. Speak an item not in the catalog. Confirm it appears as a row marked "new item" (price 0) and that re-speaking it next phrase matches the just-created product.
4. Tap +/- on a row (and decrement to remove). Confirm the cart + total update.
5. Tap **Save sale (cash)**. Confirm a 201, the cart clears, and the sale shows in `/reports` / dashboard today's sales with stock decremented in `/inventory`.
6. Deny mic permission (or block it in site settings) -> confirm the plain-language "Mic blocked" message, no crash.
7. Toggle airplane mode mid-session -> confirm the "You are offline" message, no stuck spinner.
8. Note the on-device VAD feel. If phrases cut too early/late, tune `VAD_SILENCE_THRESHOLD` / `VAD_SILENCE_MS` in `lib/voice/vad.ts` and re-run `npm test`.

- [ ] **Step 3: Honest-state confirmation**

Confirm the known Layer 1 limitations are acceptable for the demo and recorded in the handoff: add-as-new items save at price 0 (catalog items price correctly); voice commands (next/close/read-total) are not yet wired (Layer 2) - Save is the on-screen button; noisy-shop mis-parses are mitigated by the visible cart + tappable fallbacks, not eliminated.

- [ ] **Step 4: Update HANDOFF.md**

Move "Voice Layer 1" from NEXT to a short "Built & live" bullet (screen + VAD + `/api/voice/parse` + cart + cash save), and set NEXT to "Voice Layer 2: commands next / close / read_balance (TTS)". Commit:

```bash
git add HANDOFF.md
git commit -m "docs: handoff - Voice Layer 1 shipped, Layer 2 is next

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- **`/voice` screen + mic + VAD + parse + live cart + save (Layer 1 core):** Tasks 4 (VAD), 6 (parse route), 7 (mic+VAD shell), 8 (screen + cart + save), 9 (nav). Covered.
- **Gemini audio, one JSON (transcript + kind + items/command):** Task 5, schema matches the spec's shape (transcript, kind, items[name,quantity,unit?], command, args{quantity,customerName}). Covered.
- **VAD auto-segment on ~1s silence, tunable threshold constant:** Task 4 exports `VAD_SILENCE_THRESHOLD` / `VAD_SILENCE_MS`; Task 7 drives it. Covered.
- **Server-side catalog match, reuse the existing matcher, unmatched -> active product:** Task 6 reuses pure `matchItem`; true misses are created `is_active: true` (matches the scan fix). Covered. (Note: uses `matchItem` directly rather than `resolveItems`, because voice already knows the quantity and must not run bill qty/price inference - documented in Task 2/6.)
- **Save reuses the quick-entry path, cash sale:** Task 8 POSTs `/api/entry/quick` with `{ type:'sale', paymentMethod:'cash', items:[{productId,quantity}] }`. Covered.
- **Button equivalents so a misfire is never a dead end:** Task 8 cart has +/- and remove; footer has an on-screen Save. Covered (per-voice-command buttons for next/close arrive with their Layer 2 voice handlers).
- **Honest risks stated in the build:** Task 10 Step 3 + the empty/denied/offline/error states in Task 8. Covered.
- **Testing per the spec (unit-test pure logic; tsc/build; real-device manual):** Tasks 1-4 are vitest TDD; Tasks 5-9 are tsc/build; Task 10 is the device pass. Covered.
- **Deferred intents not built here:** commands, corrections, udhaar - explicitly out of Layer 1 scope, route still classifies `command`. Covered.
- **Type consistency:** `VoiceParseResult` (engine) vs `VoiceParseResponse` (API) vs `VoiceCartRow` (cart) used consistently across Tasks 1/5/6/7/8; `PendingCartRow` only crosses Task 2 -> Task 6; `matchItem`/`MatchResult`/`MatchCandidate` signatures match `lib/scan/match.ts`; `QuickEntryItem = { productId, quantity }` matches the save body. Verified.

No placeholder steps; every code step shows complete code; every command lists expected output.
