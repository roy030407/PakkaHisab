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
 *   - Layer 3: voice corrections (remove_last drops the last row, set_qty sets
 *     the last row's quantity); runCommand now receives args
 *   - Layer 4: udhaar by voice (attach_customer attaches a customer + saves the
 *     sale on credit; customer_balance reads a named customer's balance aloud);
 *     detachable customer chip
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
import { Mic, Square, Loader2, Volume2, X } from 'lucide-react'
import { useVoiceSession } from '@/hooks/useVoiceSession'
import { VoiceCart } from '@/components/voice/VoiceCart'
import { addRowsToCart, setRowQuantity, cartTotal, removeLastRow, setLastRowQuantity } from '@/lib/voice/cart'
import { decideCommandAction, buildBalanceSpeech } from '@/lib/voice/command'
import { speak } from '@/lib/voice/speak'
import { buildBalanceByNameSpeech } from '@/lib/voice/customer'
import type { VoiceCartRow, VoiceParseResponse, VoiceCommand, VoiceParseArgs, VoiceCustomerMatch } from '@/lib/voice/types'
import { FrequentItems, type FrequentProduct } from '@/components/shared/FrequentItems'

export default function VoicePage() {
  const [rows, setRows] = useState<VoiceCartRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<VoiceCustomerMatch | null>(null)

  // The hook holds onResult by identity, so command handling reads the latest
  // cart + saving flag + attached customer through a ref, not a stale closure.
  const stateRef = useRef<{ rows: VoiceCartRow[]; saving: boolean; customer: VoiceCustomerMatch | null }>({ rows, saving, customer })
  stateRef.current = { rows, saving, customer }

  // stop comes from the hook below; onResult (defined first) reaches it via a ref.
  const stopRef = useRef<() => void>(() => {})

  const saveCart = useCallback(async () => {
    const cart = stateRef.current.rows
    if (cart.length === 0 || stateRef.current.saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const cust = stateRef.current.customer
      const res = await fetch('/api/entry/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sale',
          paymentMethod: cust ? 'credit' : 'cash',
          customerId: cust?.id,
          items: cart.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        }),
      })
      if (!res.ok) { setSaveError('Could not save. Check your connection and try again.'); return }
      setRows([])
      setCustomer(null)
    } catch {
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }, [])

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

  const onResult = useCallback((r: VoiceParseResponse) => {
    if (r.kind === 'items' && r.cartItems.length > 0) {
      setRows((prev) => addRowsToCart(prev, r.cartItems))
      return
    }
    if (r.kind !== 'command' || !r.command) return
    if (r.command === 'attach_customer') {
      if (r.customer) setCustomer(r.customer)
      else speak('Customer not found.')
      return
    }
    if (r.command === 'customer_balance') {
      speak(buildBalanceByNameSpeech(r.customer ?? null))
      return
    }
    runCommand(r.command, r.args)
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

      {/* Quick add frequent items by tap */}
      <FrequentItems
        onAdd={(p: FrequentProduct) => {
          setRows(prev => addRowsToCart(prev, [{
            productId: p.id, name: p.name, quantity: 1,
            unitPrice: p.price, addedAsNew: false,
          }]))
        }}
        onRemove={(p: FrequentProduct) => {
          setRows(prev => {
            const idx = prev.findIndex(r => r.productId === p.id)
            if (idx === -1) return prev
            const row = prev[idx]
            if (row.quantity <= 1) return [...prev.slice(0, idx), ...prev.slice(idx + 1)]
            return [...prev.slice(0, idx), { ...row, quantity: row.quantity - 1 }, ...prev.slice(idx + 1)]
          })
        }}
        label="Tap to add"
      />

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

      {customer && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-sm font-medium text-amber-900">
            Udhaar: {customer.name} (credit)
          </span>
          <button
            type="button"
            onClick={() => setCustomer(null)}
            aria-label="Remove customer from this sale"
            className="btn-lift flex h-7 w-7 items-center justify-center rounded-lg text-amber-700 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

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
          {saving ? 'Saving...' : `${customer ? 'Save udhaar' : 'Save'} & agla - ₹${total}`}
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
