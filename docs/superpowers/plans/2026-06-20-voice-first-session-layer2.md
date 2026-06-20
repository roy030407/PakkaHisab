# Voice-First Sales Session - Layer 2 (Commands) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the three core voice commands the parse route already classifies but the screen currently ignores: `agla / next` (save the cart, keep selling), `khatam / close` (save + end the session), and `balance / hisab batao` (read the running total aloud via the browser), each with an on-screen button equivalent.

**Architecture:** No server changes. `/api/voice/parse` already returns `{ kind: 'command', command }` for these utterances (the Gemini prompt + `normalizeVoiceParse` from Layer 1 handle classification). This layer is entirely client-side: a pure decider maps a command + cart size to an action (save / close / speak), a tiny browser util wraps `SpeechSynthesis`, and the `/voice` page dispatches commands from its existing `onResult` callback (using refs so the hook's stable callback sees fresh state) plus new Khatam and speaker buttons.

**Tech Stack:** Next.js 14 App Router (TS strict), Tailwind + shadcn/ui, browser Web Speech `SpeechSynthesis`, vitest. Builds on Layer 1 (`lib/voice/*`, `hooks/useVoiceSession.ts`, `app/(dashboard)/voice/page.tsx`).

## Global Constraints

Copied verbatim from `CLAUDE.md` / `HANDOFF.md`. Every task implicitly includes these.

- **NO em dashes (—) anywhere** - code, comments, UI copy, prompts, commit messages. Use a comma, period, parentheses, or a spaced hyphen ( - ).
- **AI is Google Gemini, NOT Claude** (no AI change in this layer, but keep the convention).
- **Every new non-test file gets the project file-comment block** (FILE / WHAT THIS DOES / CHANGES THIS SESSION / WHERE IT FITS / CALLED BY / IMPORTS FROM). Update CHANGES on touched files. Test files follow the existing codebase convention (no block - start with the imports, like `lib/scan/match.test.ts`).
- **Every clickable element:** `cursor-pointer`; disabled: `cursor-not-allowed`. **Every interactive element:** a visible hover lift via `.btn-lift` (buttons/links). A disabled control must NOT lift (apply `btn-lift` only in the enabled branch).
- **Work on the `voice-layer-1` branch** (this is where Layer 1 lives; Layer 2 stacks on it). Do NOT commit to `main`. Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Confirm before pushing.
- **Per-layer verification before commit:** `npx tsc --noEmit`, `npm test`, `npm run build` all green. OneDrive `.next` EINVAL: `rm -rf .next && npm run build` if the build flakes.
- **Vitest only discovers `lib/**/*.test.ts`** (`vitest.config.ts`, environment node). All unit tests live under `lib/voice/`. Browser-only code (anything using `window` / `SpeechSynthesis` / React hooks) is NOT unit-tested here; it is verified by `tsc` + `build` + the real-device pass.

## Layer 2 scope (this plan)

In scope: the `next` / `close` / `read_balance` commands and their on-screen buttons (Save & agla, Khatam, speaker), plus read-aloud of the total. No server, no schema, no new AI prompt (Layer 1 already classifies these three).

Deferred (do NOT build here): `remove_last` / `set_qty` corrections (Layer 3); udhaar-by-voice + balance-by-name (Layer 4). The decider returns a no-op for those commands so an early or accidental utterance is harmless.

## Integration facts (from Layer 1, verified in the current code)

- `app/api/voice/parse/route.ts` returns `VoiceParseResponse` with `kind: 'command'`, `cartItems: []`, and `command` set for `next` / `close` / `read_balance`. No change needed.
- `lib/voice/types.ts` already exports `VoiceCommand = 'next' | 'close' | 'read_balance' | 'remove_last' | 'set_qty' | 'attach_customer'` and `VoiceParseResponse`.
- `app/(dashboard)/voice/page.tsx` (current) holds `rows` state, a `save()` that POSTs `/api/entry/quick` and clears the cart on success, and an `onResult` (stable `useCallback([])`) that today handles only `kind === 'items'`. `useVoiceSession(onResult)` returns `{ status, lastTranscript, start, stop }`.
- `lib/voice/cart.ts` exports `cartTotal(rows)`.

## File map

| File | Responsibility | Task |
| --- | --- | --- |
| `lib/voice/command.ts` | Pure: command + cart size -> `CommandAction`; total -> speech string | 1 |
| `lib/voice/command.test.ts` | Unit tests for the decider + speech builder | 1 |
| `lib/voice/speak.ts` | Browser `SpeechSynthesis` wrapper (guarded, silent-degrade) | 2 |
| `app/(dashboard)/voice/page.tsx` | Dispatch commands from `onResult`; Save & agla / Khatam / speaker buttons | 2 |
| `HANDOFF.md` | Mark Layer 2 done, set Layer 3 next | 3 |

---

### Task 1: Pure command decider + balance speech builder

**Files:**
- Create: `lib/voice/command.ts`
- Test: `lib/voice/command.test.ts`

**Interfaces:**
- Consumes: `VoiceCommand` from `lib/voice/types`.
- Produces: `CommandAction { save: boolean; closeSession: boolean; speakTotal: boolean }`, `decideCommandAction(command: VoiceCommand | null, cartCount: number): CommandAction`, `buildBalanceSpeech(total: number): string`.

Decisions encoded: `next` saves only when the cart has items, keeps the session. `close` always ends the session and saves only when the cart has items. `read_balance` only speaks. Any other command (the Layer 3/4 stretch set, or `null`) is a no-op.

- [ ] **Step 1: Write the failing test**

```ts
// lib/voice/command.test.ts
import { describe, it, expect } from 'vitest'
import { decideCommandAction, buildBalanceSpeech } from '@/lib/voice/command'

describe('decideCommandAction', () => {
  it('next saves and keeps the session when the cart has items', () => {
    expect(decideCommandAction('next', 3)).toEqual({ save: true, closeSession: false, speakTotal: false })
  })

  it('next is a no-op when the cart is empty', () => {
    expect(decideCommandAction('next', 0)).toEqual({ save: false, closeSession: false, speakTotal: false })
  })

  it('close saves and ends the session when the cart has items', () => {
    expect(decideCommandAction('close', 2)).toEqual({ save: true, closeSession: true, speakTotal: false })
  })

  it('close still ends the session with an empty cart but does not save', () => {
    expect(decideCommandAction('close', 0)).toEqual({ save: false, closeSession: true, speakTotal: false })
  })

  it('read_balance only speaks the total', () => {
    expect(decideCommandAction('read_balance', 5)).toEqual({ save: false, closeSession: false, speakTotal: true })
  })

  it('is a no-op for stretch commands and null', () => {
    const noop = { save: false, closeSession: false, speakTotal: false }
    expect(decideCommandAction('remove_last', 5)).toEqual(noop)
    expect(decideCommandAction('set_qty', 5)).toEqual(noop)
    expect(decideCommandAction('attach_customer', 5)).toEqual(noop)
    expect(decideCommandAction(null, 5)).toEqual(noop)
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/voice/command.test.ts`
Expected: FAIL - cannot find module `@/lib/voice/command`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * FILE: lib/voice/command.ts
 *
 * WHAT THIS DOES:
 *   Pure command logic for the voice session. Maps a recognized voice command
 *   plus the current cart size to a CommandAction (save / close / speak the
 *   total), and builds the spoken-total string for read-aloud. No side effects.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 2)
 *
 * WHERE IT FITS:
 *   Used by app/(dashboard)/voice/page.tsx to execute a parsed command.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; imports VoiceCommand from lib/voice/types
 */
import type { VoiceCommand } from './types'

export interface CommandAction {
  save: boolean
  closeSession: boolean
  speakTotal: boolean
}

export function decideCommandAction(command: VoiceCommand | null, cartCount: number): CommandAction {
  switch (command) {
    case 'next':
      return { save: cartCount > 0, closeSession: false, speakTotal: false }
    case 'close':
      return { save: cartCount > 0, closeSession: true, speakTotal: false }
    case 'read_balance':
      return { save: false, closeSession: false, speakTotal: true }
    default:
      // remove_last / set_qty / attach_customer (Layer 3-4) and null: no-op.
      return { save: false, closeSession: false, speakTotal: false }
  }
}

export function buildBalanceSpeech(total: number): string {
  if (total <= 0) return 'Cart is empty.'
  return `Total ${total} rupees.`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/voice/command.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/voice/command.ts lib/voice/command.test.ts
git commit -m "feat(voice): pure command decider + balance speech builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Browser TTS util + wire commands into the `/voice` page

**Files:**
- Create: `lib/voice/speak.ts`
- Modify: `app/(dashboard)/voice/page.tsx` (full replacement below)

**Interfaces:**
- Consumes: `decideCommandAction`, `buildBalanceSpeech` from `lib/voice/command`; `speak` from `lib/voice/speak`; `cartTotal` from `lib/voice/cart`; `useVoiceSession`; `VoiceCommand` + `VoiceParseResponse` + `VoiceCartRow` from `lib/voice/types`.
- Produces: `speak(text: string): void` (browser-guarded, degrades silently). The `/voice` screen now executes commands and exposes Save & agla / Khatam / speaker buttons.

Wiring approach: `useVoiceSession` holds `onResult` by identity, so the command handler reads fresh cart state through a ref (`stateRef`) and calls the hook's `stop` through a ref (`stopRef`, set after the hook returns, since `onResult` is defined before it). `save()` becomes `saveCart()` (reads `stateRef.current.rows`, returns nothing; still clears on success). The primary button and the `next` command both call `saveCart`; Khatam and `close` call `saveCart` then `stop`; the speaker button and `read_balance` both speak the total.

- [ ] **Step 1: Create the TTS util**

```ts
/**
 * FILE: lib/voice/speak.ts
 *
 * WHAT THIS DOES:
 *   Thin browser wrapper around the Web Speech SpeechSynthesis API. Reads a
 *   short phrase aloud (the running total), cancelling any in-flight speech
 *   first. Guarded for SSR and unsupported browsers - degrades silently so the
 *   visible total is always the source of truth.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 2)
 *
 * WHERE IT FITS:
 *   Called by app/(dashboard)/voice/page.tsx for the "balance batao" command
 *   and the on-screen speaker button.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/voice/page.tsx ; no imports.
 */
export function speak(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-IN'
    utter.rate = 1
    window.speechSynthesis.speak(utter)
  } catch {
    // TTS unavailable or blocked: degrade silently, the visible total remains.
  }
}
```

- [ ] **Step 2: Replace the `/voice` page with the command-aware version**

Replace the entire contents of `app/(dashboard)/voice/page.tsx` with:

```tsx
/**
 * FILE: app/(dashboard)/voice/page.tsx
 *
 * WHAT THIS DOES:
 *   The voice-first sales session screen. Tap the mic to listen, speak items in
 *   Hinglish, watch them land in a live cart, and drive the session by voice:
 *   "agla" saves and keeps selling, "khatam" saves and ends, "balance batao"
 *   reads the total aloud. Every command has an on-screen button equivalent.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *   - Disabled Save button no longer lifts on hover
 *   - Layer 2: voice commands (agla/next, khatam/close, balance read-aloud),
 *     Save & agla / Khatam / speaker buttons, command dispatch via refs
 *
 * WHERE IT FITS:
 *   Reached from the Sidebar (desktop) and the VoiceFab (mobile).
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router ; uses hooks/useVoiceSession.ts, components/voice/VoiceCart.tsx,
 *   lib/voice/cart.ts, lib/voice/command.ts, lib/voice/speak.ts, and POST /api/entry/quick
 */
'use client'
import { useCallback, useRef, useState } from 'react'
import { Mic, Square, Loader2, Volume2 } from 'lucide-react'
import { useVoiceSession } from '@/hooks/useVoiceSession'
import { VoiceCart } from '@/components/voice/VoiceCart'
import { addRowsToCart, setRowQuantity, cartTotal } from '@/lib/voice/cart'
import { decideCommandAction, buildBalanceSpeech } from '@/lib/voice/command'
import { speak } from '@/lib/voice/speak'
import type { VoiceCartRow, VoiceParseResponse, VoiceCommand } from '@/lib/voice/types'

export default function VoicePage() {
  const [rows, setRows] = useState<VoiceCartRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // The hook holds onResult by identity, so command handling reads the latest
  // cart + saving flag through a ref rather than a stale closure.
  const stateRef = useRef<{ rows: VoiceCartRow[]; saving: boolean }>({ rows, saving })
  stateRef.current = { rows, saving }

  // stop comes from the hook below; onResult (defined first) reaches it via a ref.
  const stopRef = useRef<() => void>(() => {})

  const saveCart = useCallback(async () => {
    const cart = stateRef.current.rows
    if (cart.length === 0 || stateRef.current.saving) return
    setSaving(true)
    setSaveError(null)
    try {
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
    } catch {
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }, [])

  const runCommand = useCallback((command: VoiceCommand) => {
    const cart = stateRef.current.rows
    const action = decideCommandAction(command, cart.length)
    if (action.speakTotal) speak(buildBalanceSpeech(cartTotal(cart)))
    if (action.save) void saveCart()
    if (action.closeSession) stopRef.current()
  }, [saveCart])

  const onResult = useCallback((r: VoiceParseResponse) => {
    if (r.kind === 'items' && r.cartItems.length > 0) {
      setRows((prev) => addRowsToCart(prev, r.cartItems))
      return
    }
    if (r.kind === 'command' && r.command) runCommand(r.command)
  }, [runCommand])

  const { status, lastTranscript, start, stop } = useVoiceSession(onResult)
  stopRef.current = stop
  const listening = status === 'listening' || status === 'thinking'

  function setQty(productId: string, quantity: number) {
    setRows((prev) => setRowQuantity(prev, productId, quantity))
  }

  const total = cartTotal(rows)
  const canSave = rows.length > 0 && !saving
  const canClose = listening || rows.length > 0

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Bolकर बेचो</h1>
        <p className="text-sm text-gray-500">Tap the mic and speak. Say &ldquo;agla&rdquo; to save, &ldquo;khatam&rdquo; to finish.</p>
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

      {/* Speaker: read the running total aloud (voice equivalent: "balance batao") */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => speak(buildBalanceSpeech(total))}
          className="btn-lift inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 cursor-pointer"
          aria-label="Read the total aloud"
        >
          <Volume2 size={15} /> Total batao
        </button>
      </div>

      {saveError && <p className="text-sm text-rose-600">{saveError}</p>}

      {/* Footer: button equivalents for the voice commands. */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { void saveCart() }}
          disabled={!canSave}
          className={`flex-1 rounded-xl py-3.5 text-base font-semibold text-white ${
            canSave ? 'btn-lift bg-emerald-600 cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {saving ? 'Saving...' : `Save & agla - ₹${total}`}
        </button>
        <button
          type="button"
          onClick={() => { void saveCart(); stop() }}
          disabled={!canClose}
          className={`rounded-xl px-5 py-3.5 text-base font-semibold ${
            canClose ? 'btn-lift bg-gray-900 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Khatam
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, `/voice` route still present. (OneDrive `.next` EINVAL -> `rm -rf .next && npm run build`.)

- [ ] **Step 4: Run the unit suite (no regressions)**

Run: `npm test`
Expected: all prior tests + the 8 new command tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/voice/speak.ts "app/(dashboard)/voice/page.tsx"
git commit -m "feat(voice): wire next/close/read-balance commands + TTS and buttons

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Layer 2 verification + handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Full automated verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc clean; all vitest tests pass (Layer 1 suite + 8 new command tests); build succeeds with `/voice` present.

- [ ] **Step 2: Real-device manual pass (voice commands)**

On a mid-range Android over real network, signed in as a store with a catalog, on the `voice-layer-1` preview deployment:

1. Open `/voice`, tap the mic, speak a few items so the cart has rows.
2. Say "agla" (or "next"). Confirm the cart saves as a cash sale and clears, and the session keeps listening. Verify the sale in `/reports` / dashboard.
3. Add items again. Say "balance batao" (or "hisab"). Confirm the phone reads the total aloud (English, e.g. "Total 250 rupees"). Tap the speaker button - confirm the same.
4. Say "khatam" (or "close"). Confirm the cart saves and the mic stops (session ends).
5. Tap the on-screen Save & agla and Khatam buttons - confirm they match the voice behavior.
6. Edge: say "balance batao" with an empty cart - confirm it reads "Cart is empty." and does not crash. Say "agla" with an empty cart - confirm it is a harmless no-op.
7. Confirm a misheard command never blind-saves silently: the cart is always visible and the buttons are the fallback.

- [ ] **Step 3: Update HANDOFF.md**

In `HANDOFF.md`, under "Built & live", update the Voice bullet to note Layer 2 shipped (commands next/close/read-balance + TTS + buttons). In the NEXT section, set the next build to "Voice Layer 3: corrections (remove_last / set_qty)" and keep the device-test + push reminders. Commit:

```bash
git add HANDOFF.md
git commit -m "docs: handoff - Voice Layer 2 (commands) shipped, Layer 3 next

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- **`agla / next` (save + new cart):** Task 1 decider (`save` when cart non-empty, no close) + Task 2 `runCommand` calls `saveCart` (which clears on success); the Save & agla button mirrors it. Covered.
- **`khatam / close / ho gaya` (save + end):** Task 1 decider (`save` + `closeSession`) + Task 2 calls `saveCart` then `stop`; the Khatam button mirrors it. Covered.
- **`balance / hisab batao` (TTS the total):** Task 1 `buildBalanceSpeech` + Task 2 `speak` (browser SpeechSynthesis) + the speaker button. Covered.
- **Every voice command has a button equivalent:** Save & agla, Khatam, speaker. Covered.
- **Browser SpeechSynthesis, on-demand only:** `lib/voice/speak.ts`, called only on command/button. Covered.
- **No server/AI change needed:** Layer 1's route + prompt already classify these three commands; verified in Integration facts. Covered.
- **Misfire is never a dead end:** visible cart + buttons retained; decider no-ops unknown/stretch commands. Covered.
- **Testing per the spec (unit-test pure logic; tsc/build; real-device manual):** Task 1 is vitest TDD; Task 2 is tsc/build (browser shells); Task 3 is the device pass. Covered.
- **Deferred intents not built here:** `remove_last` / `set_qty` (Layer 3), udhaar + balance-by-name (Layer 4) - decider returns no-op. Covered.
- **Type consistency:** `CommandAction` shape identical across Task 1 and Task 2; `decideCommandAction` / `buildBalanceSpeech` / `speak` signatures match their call sites; `VoiceCommand` / `VoiceParseResponse` reused from Layer 1 types; `saveCart` reads `stateRef.current.rows`; `stopRef.current` set after the hook. Verified.

No placeholder steps; every code step shows complete code; every command lists expected output.
