# Voice-First Sales Session - Design Spec

Date: 2026-06-19
Status: Approved-in-principle (pending spec review)
Owner: Roy Harwani

## Problem

The merchant (Ram Kirana's owner - he asked for this directly, validated demand)
hates typing and wants to log sales by speaking as he serves customers, mid-rush.
Scan needs a paper bill; manual entry needs tapping a catalog. Neither fits a
hands-busy, customer-waiting counter.

## Goal

Tap a mic once and run a voice session: speak items continuously ("5 Parle-G, ek
doodh"), see them land in a live cart, and drive everything by voice commands
("agla customer", "khatam", "balance batao"), in Hinglish, on a budget Android.
A visible cart keeps it trustworthy - no voice system blind-saves money.

## Decisions (from brainstorm / grill)

| Topic | Decision |
| --- | --- |
| Worth it? | Yes - the merchant explicitly asked. Not inference. |
| When | Live at the counter, mid-rush (highest value, hardest audio). |
| Engine | Gemini audio (already integrated `lib/anthropic/client.ts`, free tier, strong at Hinglish + brand names + numbers, one call does transcribe + intent + items). Scales later (paid / swap to Sarvam). |
| Listening | Auto-segment on pause (VAD): continuous mic, a ~1s silence ends a phrase -> that short clip is sent. Robust to ambient noise vs always-on streaming. |
| Readback | Browser SpeechSynthesis (free, on-demand only) reads the total/balance aloud. |
| Matching | Reuse the existing catalog matcher (`lib/scan/match.ts` + `resolve.ts`); unmatched -> add-as-new active product (same as the scan fix). |
| Scope | "Everything" - layered so the CORE ships first, richer intents stack on top. |

## Architecture

New route **`/voice`** (a session screen) + one new endpoint **`POST /api/voice/parse`**.

Per spoken phrase (the loop):
1. **Record** with MediaRecorder (audio/webm; opus).
2. **VAD** via Web Audio `AnalyserNode` (RMS volume): when volume stays below a
   threshold for ~1s, finalize the segment. Keep listening (session continues).
3. **Send** the clip (base64) to `POST /api/voice/parse` with no catalog payload
   (the route loads the store catalog server-side, like /api/scan does).
4. **Gemini** (audio inlineData, model `DEFAULT_GEMINI_MODEL`) returns ONE JSON:
   ```
   { transcript: string,
     kind: "items" | "command",
     items?: [{ name: string, quantity: number, unit?: string }],
     command?: "next" | "close" | "read_balance" | "remove_last" | "set_qty" | "attach_customer",
     args?: { quantity?: number, customerName?: string } }
   ```
   The prompt instructs it to expand Hindi (doodh->milk, etc.), read Hinglish +
   brand names, and classify the utterance as items vs a command.
5. **Match** items to the catalog server-side (reuse `resolveItems`), return matched
   line items (name, productId|addAsNew, unitPrice from catalog, quantity).
6. **Client** updates the cart or executes the command.

## Intents (full assistant - layered)

CORE (must ship):
- **add items**: "5 Parle-G, ek doodh" -> matched rows added to the cart.
- **agla / next customer**: save the current cart as a sale, start a fresh cart.
- **khatam / close / ho gaya**: save + end the session.
- **balance / hisab batao**: TTS reads the running cart total.

STRETCH (stack on; cut first if the week runs out):
- **remove last / aakhri hata do**: drop the last cart row.
- **set qty / "teen kar do" / change to 3**: set the last row's quantity.
- **udhaar**: "Sharma ji udhaar" -> match the customer by name, attach + mark the
  cart credit.
- **balance by name**: "Sharma ji ka kitna baaki" -> look up + TTS that customer's
  outstanding.

Every voice command has a **button equivalent** on screen (Save & next, Khatam,
speaker icon, per-row delete/qty) so a misfire is never a dead end.

## UI - `/voice`

- Big **mic button** (tap to start/stop the session) with a pulsing "listening"
  state; shows the **last transcript** line so the merchant sees what it heard.
- **Live cart**: rows (name, qty with +/-, price, line total), tap-to-edit as a
  fallback; a running **total**.
- **Customer chip** + payment method (cash default; credit when udhaar attached).
- Footer: **Save & next (agla)** and **Khatam (close)**; a **speaker** button to
  read the total.
- Empty state coaches: "Tap and say what's selling - 2 doodh, 5 Parle-G..."

## Save

Reuse the quick-entry save path (`POST /api/entry/quick` shape: type sale,
paymentMethod, customerId?, items[]). Each "next"/"close" persists one sale.
Unmatched spoken items create an active product (so they match next time).

## Error handling / honest risks (state them in the build)

- **Noise / other voices** mid-rush -> Gemini may mis-parse. Mitigated by the
  visible cart, button fallbacks, and the correction intents. Not eliminated.
- **Latency** ~1-2s per segment on 4G; **free-tier rate limits** (~15 req/min) -
  fine for one shop, may need debouncing/merging of rapid phrases.
- **VAD tuning** (when a phrase ends) is fiddly and needs real-device tuning;
  expose the silence threshold as a constant.
- **Network required** (Gemini is server-side); no offline voice. Show a clear
  "needs internet" state.
- **Mic permissions**: handle denial gracefully with a plain-language prompt.
- "Everything in a week" is ambitious - ship the CORE first.

## Build order (within the week)

1. `/voice` screen + mic record + VAD auto-segment + `POST /api/voice/parse`
   (Gemini audio -> items, server catalog match) + live cart + Save (cash). [core]
2. Commands: next / close / read_balance (total TTS). [core]
3. Corrections: remove_last / set_qty. [stretch]
4. Customer/udhaar by voice + balance-by-name. [stretch]

## Testing

- Unit-test any pure logic (intent JSON -> cart action mapper; the
  transcript/items normalizer) with vitest.
- `npx tsc --noEmit`, `npm run build` per layer.
- Real-device, mid-rush manual test: speak 5+ items in Hinglish with background
  noise; run each command; confirm the cart + saved sale are correct; test mic
  denial + offline states.

## Out of scope

- Wake word ("hey app"); fully offline voice; languages beyond Hindi/Hinglish;
  speaker diarization (separating the owner's voice from customers').

## Open questions

None blocking. VAD threshold + Gemini audio prompt will be tuned on-device.
