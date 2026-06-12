/**
 * FILE: components/reports/StatCard.tsx
 *
 * WHAT THIS DOES:
 *   Single metric card with label, formatted value, and optional trend or
 *   sublabel. Used for the dashboard snapshot and report summary cards.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Khata Green: icon chips, hover lift, optional count-up via AnimatedNumber
 *   - Fix: format prop is now a string preset (functions can't cross RSC boundary)
 *
 * WHERE IT FITS:
 *   Used on the dashboard home screen and the reports page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx, app/(dashboard)/reports/page.tsx
 */

import type { LucideIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/shared/AnimatedNumber"

interface Props {
  label: string
  value: string
  sublabel?: string
  accent?: "green" | "red" | "amber" | "blue" | "slate"
  icon?: LucideIcon
  /** When provided, value animates with a count-up (default format: compact INR) */
  rawValue?: number
  format?: "plain" | "inr" | "inr-compact"
  onClick?: () => void
}

const ACCENT_CLASSES: Record<string, string> = {
  green: "bg-emerald-50 border-emerald-100",
  red:   "bg-red-50 border-red-100",
  amber: "bg-amber-50 border-amber-100",
  blue:  "bg-blue-50 border-blue-100",
  slate: "bg-white border-gray-100 shadow-sm",
}

const VALUE_CLASSES: Record<string, string> = {
  green: "text-emerald-800",
  red:   "text-red-700",
  amber: "text-amber-800",
  blue:  "text-blue-800",
  slate: "text-gray-900",
}

const CHIP_CLASSES: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  red:   "bg-red-100 text-red-600",
  amber: "bg-amber-100 text-amber-600",
  blue:  "bg-blue-100 text-blue-600",
  slate: "bg-emerald-50 text-emerald-700",
}

export function StatCard({
  label, value, sublabel, accent = "slate", icon: Icon, rawValue, format, onClick,
}: Props) {
  return (
    <div
      className={`card-lift rounded-xl border p-4 ${ACCENT_CLASSES[accent]} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="mb-1.5 flex items-center gap-2">
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${CHIP_CLASSES[accent]}`}>
            <Icon size={14} />
          </span>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      </div>
      <p className={`text-xl font-bold tracking-tight ${VALUE_CLASSES[accent]}`}>
        {rawValue !== undefined ? (
          <AnimatedNumber value={rawValue} format={format ?? "inr-compact"} />
        ) : (
          value
        )}
      </p>
      {sublabel && <p className="mt-1 text-xs text-gray-400">{sublabel}</p>}
    </div>
  )
}

export function formatINR(amount: number): string {
  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  if (Math.abs(amount) >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }
  return `₹${amount.toLocaleString("en-IN")}`
}
