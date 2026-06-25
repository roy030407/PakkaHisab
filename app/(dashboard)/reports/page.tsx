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
 *   - Khata Green restyle
 *   - Added ExpenseBreakdownCard between items sold and profit card
 *
 * WHERE IT FITS:
 *   Accessible from the bottom nav "Reports" tab and dashboard quick links.
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout, bottom nav, dashboard page quick link
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Download, Share2, ShoppingCart, Package, TrendingUp, Landmark } from "lucide-react"
import { toast } from "sonner"
import { PeriodToggle } from "@/components/reports/PeriodToggle"
import { StatCard, formatINR } from "@/components/reports/StatCard"
import { ProfitCard } from "@/components/reports/ProfitCard"
import { TaxSummary } from "@/components/reports/TaxSummary"
import { ItemsSoldCard } from "@/components/reports/ItemsSoldCard"
import { ExpenseBreakdownCard } from "@/components/reports/ExpenseBreakdownCard"
import { ReportSkeleton } from "@/components/shared/PageSkeleton"
import type { ReportPeriod, PeriodReport } from "@/types"
import { track } from "@/lib/analytics/posthog"

// Charts pull in recharts (heavy). Lazy-load them client-side so the rest of the
// Reports page - and every other route sharing the bundle - loads faster.
const ChartFallback = () => <div className="h-56 rounded-2xl border border-gray-100 bg-gray-50 animate-pulse" />
const CashFlowChart = dynamic(() => import("@/components/reports/CashFlowChart").then(m => m.CashFlowChart), { ssr: false, loading: ChartFallback })
const SalesPurchasesChart = dynamic(() => import("@/components/reports/SalesPurchasesChart").then(m => m.SalesPurchasesChart), { ssr: false, loading: ChartFallback })
const TopProductsChart = dynamic(() => import("@/components/reports/TopProductsChart").then(m => m.TopProductsChart), { ssr: false, loading: ChartFallback })

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly")
  const [report, setReport] = useState<PeriodReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      const res = await fetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      await navigator.clipboard.writeText(url)
      toast.success('Share link copied to clipboard')
    } catch {
      toast.error('Could not create share link')
    } finally {
      setSharing(false)
    }
  }

  const fetchReport = useCallback(async (p: ReportPeriod) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports?period=${p}`)
      if (!res.ok) throw new Error("Failed to load report")
      setReport(await res.json())
      track('report_viewed', { period: p })
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
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          {report && (
            <p className="text-sm text-gray-500 mt-0.5">
              {report.periodLabel} · {report.transactionCount} transactions
            </p>
          )}
        </div>
        {report && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`/api/reports/pdf?period=${period}`}
              download
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 bg-white">
              <Download size={14} />
              PDF
            </a>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 bg-white disabled:opacity-60">
              <Share2 size={14} />
              {sharing ? '…' : 'Share'}
            </button>
          </div>
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

      {loading && <ReportSkeleton />}

      {!loading && report && (
        <div className="space-y-4">
          {/* Summary stat row */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Sales" value={formatINR(report.sales)} accent="green" icon={ShoppingCart} />
            <StatCard label="Purchases" value={formatINR(report.purchases)} accent="amber" icon={Package} />
            <StatCard
              label="Net profit"
              value={formatINR(report.netProfit)}
              accent={report.netProfit >= 0 ? "green" : "red"}
              icon={TrendingUp}
            />
            <StatCard
              label="GST payable"
              value={formatINR(Math.abs(report.taxSummary.payable))}
              sublabel={report.taxSummary.payable >= 0 ? "owe to govt" : "credit"}
              accent={report.taxSummary.payable > 0 ? "amber" : "green"}
              icon={Landmark}
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

          {/* Per-item sales breakdown (collapsed preview, expandable) */}
          <ItemsSoldCard items={report.itemsSold ?? report.topProducts ?? []} />

          {/* Expense category breakdown */}
          {(report.totalExpenses ?? 0) > 0 && (
            <ExpenseBreakdownCard
              breakdown={report.expenseBreakdown!}
              total={report.totalExpenses!}
            />
          )}

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
