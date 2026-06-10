/**
 * FILE: app/(dashboard)/reports/page.tsx
 *
 * WHAT THIS DOES:
 *   Full reports page. Period toggle (daily/weekly/monthly/yearly) drives
 *   a fetch to /api/reports which returns profit, tax, top products, and
 *   chart data. Renders ProfitCard, TaxSummary, and three charts.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 4 reporting
 *
 * WHERE IT FITS:
 *   Accessible from the bottom nav "Reports" tab and dashboard quick links.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout, bottom nav, dashboard page quick link
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { PeriodToggle } from "@/components/reports/PeriodToggle"
import { StatCard, formatINR } from "@/components/reports/StatCard"
import { ProfitCard } from "@/components/reports/ProfitCard"
import { TaxSummary } from "@/components/reports/TaxSummary"
import { CashFlowChart } from "@/components/reports/CashFlowChart"
import { SalesPurchasesChart } from "@/components/reports/SalesPurchasesChart"
import { TopProductsChart } from "@/components/reports/TopProductsChart"
import type { ReportPeriod, PeriodReport } from "@/types"

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly")
  const [report, setReport] = useState<PeriodReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReport = useCallback(async (p: ReportPeriod) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports?period=${p}`)
      if (!res.ok) throw new Error("Failed to load report")
      setReport(await res.json())
    } catch {
      setError("Could not load report. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport(period)
  }, [period, fetchReport])

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        {report && (
          <p className="text-sm text-gray-500 mt-0.5">
            {report.periodLabel} · {report.transactionCount} transactions
          </p>
        )}
      </div>

      <div className="mb-5">
        <PeriodToggle value={period} onChange={setPeriod} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && report && (
        <div className="space-y-4">
          {/* Summary stat row */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Sales" value={formatINR(report.sales)} accent="slate" />
            <StatCard label="Purchases" value={formatINR(report.purchases)} accent="slate" />
            <StatCard
              label="Net profit"
              value={formatINR(report.netProfit)}
              accent={report.netProfit >= 0 ? "green" : "red"}
            />
            <StatCard
              label="GST payable"
              value={formatINR(Math.abs(report.taxSummary.payable))}
              sublabel={report.taxSummary.payable >= 0 ? "owe to govt" : "credit"}
              accent={report.taxSummary.payable > 0 ? "amber" : "slate"}
            />
          </div>

          {/* Payment breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Payment methods</p>
            <div className="flex gap-4">
              {(["cash", "upi", "credit"] as const).map((method) => (
                <div key={method} className="flex-1 text-center">
                  <p className="text-xs text-gray-500 capitalize mb-1">{method}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatINR(report.paymentBreakdown[method])}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Profit breakdown */}
          <ProfitCard report={report} />

          {/* Tax */}
          <TaxSummary tax={report.taxSummary} />

          {/* Charts */}
          <CashFlowChart data={report.cashFlowData} />
          <SalesPurchasesChart data={report.cashFlowData} />
          <TopProductsChart products={report.topProducts} />
        </div>
      )}
    </div>
  )
}
