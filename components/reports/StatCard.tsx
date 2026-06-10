/**
 * FILE: components/reports/StatCard.tsx
 *
 * WHAT THIS DOES:
 *   Single metric card with label, formatted value, and optional trend or
 *   sublabel. Used for the dashboard snapshot and report summary cards.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *
 * WHERE IT FITS:
 *   Used on the dashboard home screen and the reports page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx, app/(dashboard)/reports/page.tsx
 */

interface Props {
  label: string
  value: string
  sublabel?: string
  accent?: "green" | "red" | "amber" | "blue" | "slate"
  onClick?: () => void
}

const ACCENT_CLASSES: Record<string, string> = {
  green: "bg-green-50 border-green-100",
  red:   "bg-red-50 border-red-100",
  amber: "bg-amber-50 border-amber-100",
  blue:  "bg-blue-50 border-blue-100",
  slate: "bg-white border-gray-200",
}

const VALUE_CLASSES: Record<string, string> = {
  green: "text-green-800",
  red:   "text-red-700",
  amber: "text-amber-800",
  blue:  "text-blue-800",
  slate: "text-gray-900",
}

export function StatCard({ label, value, sublabel, accent = "slate", onClick }: Props) {
  const containerClass = `rounded-xl border p-4 ${ACCENT_CLASSES[accent]} ${onClick ? "cursor-pointer active:opacity-80" : ""}`
  const valueClass = `text-2xl font-bold tracking-tight ${VALUE_CLASSES[accent]}`

  return (
    <div className={containerClass} onClick={onClick}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={valueClass}>{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
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
