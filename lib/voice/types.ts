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
