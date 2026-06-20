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
  'next', 'close', 'read_balance', 'remove_last', 'set_qty', 'attach_customer', 'customer_balance',
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
