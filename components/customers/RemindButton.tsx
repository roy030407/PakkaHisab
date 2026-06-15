/**
 * FILE: components/customers/RemindButton.tsx
 *
 * WHAT THIS DOES:
 *   One-tap WhatsApp udhaar reminder. Renders the store's reminder template with
 *   the customer's name/balance/shop, builds a wa.me link, and opens it for the
 *   shopkeeper to review and send. With no usable phone, it prompts to add one
 *   instead of opening a broken link.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Used in the Customers udhaar tab and the customer ledger.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx, components/customers/CustomerLedger.tsx
 *   lib/collections/reminder.ts
 */
'use client'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { renderTemplate, buildWhatsappUrl, DEFAULT_REMINDER_TEMPLATE } from '@/lib/collections/reminder'

interface Props {
  customerName: string
  phone?: string | null
  balance: number
  shopName: string
  template?: string | null
  onNeedPhone?: () => void
  className?: string
}

export function RemindButton({ customerName, phone, balance, shopName, template, onNeedPhone, className }: Props) {
  const [noPhone, setNoPhone] = useState(false)

  function remind() {
    const message = renderTemplate(template?.trim() || DEFAULT_REMINDER_TEMPLATE, {
      name: customerName,
      amount: Math.max(0, balance).toLocaleString('en-IN'),
      shop: shopName,
    })
    const url = buildWhatsappUrl(phone, message)
    if (!url) {
      setNoPhone(true)
      onNeedPhone?.()
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={remind}
        className={
          className ??
          'btn-lift inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50'
        }
      >
        <MessageCircle size={14} />
        Remind
      </button>
      {noPhone && (
        <span className="mt-1 text-xs text-amber-600">Add a phone number to send a reminder.</span>
      )}
    </div>
  )
}
