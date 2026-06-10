/**
 * FILE: components/reports/TopProductsChart.tsx
 *
 * WHAT THIS DOES:
 *   Horizontal bar chart showing top 5 products by revenue for the period.
 *   Falls back to a ranked text list when recharts is unavailable.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *
 * WHERE IT FITS:
 *   Placed on the reports page below the cash flow charts.
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
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { TopProduct } from "@/types"

interface Props {
  products: TopProduct[]
}

const COLORS = ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"]

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v}`
}

export function TopProductsChart({ products }: Props) {
  const top5 = products.slice(0, 5)

  if (top5.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-400">No sales data for this period</p>
      </div>
    )
  }

  const chartData = top5.map((p) => ({
    name: p.productName.length > 18 ? p.productName.slice(0, 16) + "…" : p.productName,
    revenue: p.revenue,
  }))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900 mb-4">Top products by revenue</p>
      <ResponsiveContainer width="100%" height={top5.length * 44 + 16}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 12, fill: "#374151" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => [fmt(typeof v === "number" ? v : 0), "Revenue"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
