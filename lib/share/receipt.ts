/**
 * FILE: lib/share/receipt.ts
 *
 * WHAT THIS DOES:
 *   Pure helper that turns a sale (shop, date, items, total, payment, optional
 *   customer balance) into a plain-text WhatsApp receipt. No DB, no I/O, so the
 *   formatting is unit-tested in isolation. Deterministic date/amount formatting
 *   (fixed month names + en-IN grouping) keeps tests environment-stable.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice B1 receipt sharing)
 *
 * WHERE IT FITS:
 *   Used by components/share/ShareReceiptButton.tsx to build the message that is
 *   pre-filled into a wa.me link (or copied to the clipboard).
 *
 * CALLED BY / IMPORTS FROM:
 *   components/share/ShareReceiptButton.tsx
 */

export interface ReceiptItem {
  name: string
  quantity: number
  lineTotal: number
}

export interface ReceiptInput {
  shopName: string
  date: string // ISO timestamp or YYYY-MM-DD
  items: ReceiptItem[]
  total: number
  paymentMethod: string // 'cash' | 'upi' | 'credit'
  balanceAfter?: number | null
  customerName?: string | null
}

const SEP = '--------------------'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** DD Mon YYYY from a YYYY-MM-DD or ISO date; empty string if unparseable. */
function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return ''
  const monthIdx = Number(m[2]) - 1
  if (monthIdx < 0 || monthIdx > 11) return ''
  return `${Number(m[3])} ${MONTHS[monthIdx]} ${m[1]}`
}

function rupee(n: number): string {
  return `₹${Number(n).toLocaleString('en-IN')}`
}

export function buildReceiptText(input: ReceiptInput): string {
  const lines: string[] = []
  lines.push(input.shopName)
  lines.push(formatDate(input.date))

  if (input.items.length > 0) {
    lines.push(SEP)
    for (const it of input.items) {
      lines.push(`${it.quantity} x ${it.name} - ${rupee(it.lineTotal)}`)
    }
    lines.push(SEP)
  }

  lines.push(`Total: ${rupee(input.total)}`)
  if (input.paymentMethod === 'credit') {
    lines.push(`Udhaar: ${rupee(input.total)}`)
  } else {
    lines.push(`Paid: ${rupee(input.total)} (${input.paymentMethod})`)
  }
  if (input.balanceAfter != null && Number.isFinite(input.balanceAfter)) {
    lines.push(`Balance: ${rupee(input.balanceAfter)}`)
  }

  lines.push('')
  lines.push(`Dhanyavaad! - ${input.shopName}`)
  return lines.join('\n')
}
