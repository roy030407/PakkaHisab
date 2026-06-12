/**
 * FILE: components/shared/AttentionCard.tsx
 *
 * WHAT THIS DOES:
 *   Consolidates low-stock + expiry alerts into ONE calm amber card
 *   (or a slim green "All good" strip when there is nothing to flag).
 *   Replaces the separate red/amber alert StatCards on the dashboard.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Dashboard below the stat row; same pattern reused on /inventory.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx, app/(dashboard)/inventory/page.tsx
 */

import Link from "next/link"
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react"

interface Props {
  lowStockCount: number
  expiryCount: number
  href?: string
}

export function AttentionCard({ lowStockCount, expiryCount, href = "/inventory" }: Props) {
  const total = lowStockCount + expiryCount

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <CheckCircle2 size={16} className="text-emerald-600" />
        <p className="text-sm font-medium text-emerald-800">
          All good — stock levels healthy, nothing expiring soon
        </p>
      </div>
    )
  }

  const parts: string[] = []
  if (lowStockCount > 0)
    parts.push(`${lowStockCount} item${lowStockCount > 1 ? "s" : ""} low on stock`)
  if (expiryCount > 0)
    parts.push(`${expiryCount} expiring within 7 days`)

  return (
    <Link
      href={href}
      className="card-lift flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={18} className="shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-bold text-amber-900">
            {total} thing{total > 1 ? "s" : ""} need{total === 1 ? "s" : ""} attention
          </p>
          <p className="text-xs text-amber-700">{parts.join(" · ")}</p>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-amber-500" />
    </Link>
  )
}
