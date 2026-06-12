/**
 * FILE: components/reports/CashFlowChart.tsx
 *
 * WHAT THIS DOES:
 *   Line chart showing sales vs purchases over the selected period.
 *   X-axis labels adjust per period (dates for daily/weekly/monthly,
 *   month names for yearly).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Placed on the reports page. Receives pre-built CashFlowPoint[] from
 *   the API so it is purely presentational.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */

"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { CashFlowPoint } from "@/types"

interface Props {
  data: CashFlowPoint[]
}

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`
  return `₹${v}`
}

export function CashFlowChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl border border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-400">No data for this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900 mb-4">Cash flow</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => fmt(typeof v === "number" ? v : 0)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#047857"
            strokeWidth={2}
            dot={false}
            name="Sales"
          />
          <Line
            type="monotone"
            dataKey="purchases"
            stroke="#dc2626"
            strokeWidth={2}
            dot={false}
            name="Purchases"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
