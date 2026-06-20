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
