/**
 * FILE: components/reports/SalesPurchasesChart.tsx
 *
 * WHAT THIS DOES:
 *   Grouped bar chart comparing total sales vs purchases for the period.
 *   Single-bar version for daily; multi-bar for other periods using
 *   the same CashFlowPoint[] data.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Placed on the reports page alongside CashFlowChart.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/reports/page.tsx
 */

"use client"

import {
  BarChart,
  Bar,
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

export function SalesPurchasesChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl border border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-400">No data for this period</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900 mb-4">Sales vs purchases</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
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
          <Bar dataKey="sales" fill="#047857" name="Sales" radius={[4, 4, 0, 0]} />
          <Bar dataKey="purchases" fill="#f59e0b" name="Purchases" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
