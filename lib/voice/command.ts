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
