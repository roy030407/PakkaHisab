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
