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
 *   - Disabled Save button no longer lifts on hover
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
        className={`w-full rounded-xl py-3.5 text-base font-semibold text-white ${
          rows.length === 0 || saving
            ? 'bg-gray-300 cursor-not-allowed'
            : 'btn-lift bg-emerald-600 cursor-pointer'
        }`}
      >
        {saving ? 'Saving...' : `Save sale (cash) - ₹${cartTotal(rows)}`}
      </button>
    </div>
  )
}
