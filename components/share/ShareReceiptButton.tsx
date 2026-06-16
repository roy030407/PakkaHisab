/**
 * FILE: components/share/ShareReceiptButton.tsx
 *
 * WHAT THIS DOES:
 *   One-tap WhatsApp receipt for a saved sale. Fetches the transaction (with its
 *   items and customer) by id, builds the receipt text, and opens a prefilled
 *   wa.me link when the customer has a usable phone, or copies the text to the
 *   clipboard otherwise. The shopkeeper reviews the message before sending.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice B1 receipt sharing)
 *
 * WHERE IT FITS:
 *   Used after a manual sale saves (QuickEntry/FullEntry) and on sale rows in the
 *   customer ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/entry/QuickEntry.tsx, components/entry/FullEntryForm.tsx,
 *   components/customers/CustomerLedger.tsx, lib/share/receipt,
 *   lib/collections/reminder
 */
'use client'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { buildReceiptText, type ReceiptInput } from '@/lib/share/receipt'
import { buildWhatsappUrl } from '@/lib/collections/reminder'

interface Props {
  transactionId: string
  shopName: string
  variant?: 'prominent' | 'compact'
  className?: string
}

interface ApiItem { product_name_raw: string; quantity: number; total_price: number }

export function ShareReceiptButton({ transactionId, shopName, variant = 'prominent', className }: Props) {
  const [busy, setBusy] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)

  async function share() {
    setBusy(true)
    try {
      const res = await fetch(`/api/transactions/${transactionId}`)
      if (!res.ok) {
        toast.error('Could not load the bill to share.')
        return
      }
      const d = await res.json()
      const tx = d.transaction
      const customer = d.customer as { name: string; phone: string | null; current_balance: number } | null

      const input: ReceiptInput = {
        shopName,
        date: tx.date,
        items: (d.items ?? []).map((i: ApiItem) => ({
          name: i.product_name_raw,
          quantity: Number(i.quantity),
          lineTotal: Number(i.total_price),
        })),
        total: Number(tx.total_amount),
        paymentMethod: tx.payment_method,
        customerName: customer?.name ?? null,
        balanceAfter: tx.payment_method === 'credit' && customer ? Number(customer.current_balance) : null,
      }

      const text = buildReceiptText(input)
      const url = buildWhatsappUrl(customer?.phone, text)
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      try {
        await navigator.clipboard.writeText(text)
        toast.success('Receipt copied - paste it into WhatsApp.')
      } catch {
        // Last resort: show the text so the shopkeeper can select and copy it.
        if (variant === 'prominent') setFallbackText(text)
        else toast.error('Could not copy the receipt. Open the bill to copy it.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={share}
        disabled={busy}
        aria-label="Share receipt on WhatsApp"
        className={className ?? 'btn-lift ml-1 p-1 text-emerald-600 hover:text-emerald-700 disabled:opacity-60'}
      >
        <MessageCircle size={16} />
      </button>
    )
  }

  return (
    <div className="w-full">
      <button
        onClick={share}
        disabled={busy}
        className={
          className ??
          'btn-lift inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60'
        }
      >
        <MessageCircle size={16} />
        {busy ? 'Opening...' : 'Share receipt on WhatsApp'}
      </button>
      {fallbackText && (
        <textarea
          readOnly
          value={fallbackText}
          onFocus={(e) => e.currentTarget.select()}
          rows={6}
          className="mt-2 w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-700"
        />
      )}
    </div>
  )
}
