/**
 * FILE: components/reports/PeriodToggle.tsx
 *
 * WHAT THIS DOES:
 *   Four-button toggle for daily / weekly / monthly / yearly report period.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Placed at the top of the reports page; controls what period all
 *   charts and cards display.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */

"use client"

import type { ReportPeriod } from "@/types"

interface Props {
  value: ReportPeriod
  onChange: (period: ReportPeriod) => void
}

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "daily",   label: "Today"  },
  { value: "weekly",  label: "Week"   },
  { value: "monthly", label: "Month"  },
  { value: "yearly",  label: "Year"   },
]

export function PeriodToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-1 gap-1 w-full">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex-1 rounded-lg py-1.5 text-sm transition-colors ${
            value === p.value
              ? "bg-white text-emerald-800 shadow-sm font-semibold"
              : "text-gray-500 hover:text-gray-700 font-medium"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
