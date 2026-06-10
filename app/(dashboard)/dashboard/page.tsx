/**
 * FILE: app/(dashboard)/dashboard/page.tsx
 *
 * WHAT THIS DOES:
 *   Home screen dashboard. Server-fetches today's snapshot and renders
 *   6 stat cards, 3 quick-action buttons, and the AI insight card.
 *
 * CHANGES THIS SESSION:
 *   - Replaced Phase 1 placeholder with real Phase 4 dashboard
 *   - Added InsightCard for Phase 5 AI Advisor proactive insight
 *   - Redesign: two-column desktop layout, quick actions with Lucide icons,
 *     trend arrow on profit card, page-enter animation
 *
 * WHERE IT FITS:
 *   First page a merchant sees after logging in. Uses server-side fetch
 *   so the page renders with data immediately (no loading spinner).
 *
 * CALLED BY / IMPORTS FROM:
 *   Dashboard layout, all post-auth redirects
 */

import { createSupabaseServerClient } from "@/lib/supabase/server"
import { StatCard, formatINR } from "@/components/reports/StatCard"
import { InsightCard } from "@/components/ai/InsightCard"
import Link from "next/link"
import { Camera, PenLine, Package, TrendingUp, TrendingDown } from "lucide-react"
import type { DashboardSnapshot } from "@/types"

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, owner_name")
    .eq("owner_id", user!.id)
    .maybeSingle()

  let snapshot: DashboardSnapshot = {
    todaySales: 0,
    todayPurchases: 0,
    todayNetProfit: 0,
    outstandingReceivables: 0,
    lowStockCount: 0,
    expiryAlertCount: 0,
    storeName: store?.name ?? "Your store",
    ownerName: store?.owner_name ?? "",
  }

  if (store) {
    const today = new Date().toISOString().split("T")[0]

    const [txResult, costsResult, customersResult, inventoryResult, expiryResult] =
      await Promise.all([
        supabase
          .from("transactions")
          .select("type, total_amount")
          .eq("store_id", store.id)
          .eq("date", today),
        supabase
          .from("fixed_costs")
          .select("amount, frequency")
          .eq("store_id", store.id)
          .eq("is_active", true),
        supabase
          .from("customers")
          .select("current_balance")
          .eq("store_id", store.id)
          .gt("current_balance", 0),
        supabase
          .from("inventory")
          .select("current_stock, reorder_point")
          .eq("store_id", store.id),
        supabase
          .from("inventory")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id)
          .lte(
            "expiry_date",
            new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
          )
          .gt("current_stock", 0),
      ])

    let todaySales = 0
    let todayPurchases = 0
    for (const tx of txResult.data ?? []) {
      const amt = Number(tx.total_amount) || 0
      if (tx.type === "sale") todaySales += amt
      else if (tx.type === "purchase") todayPurchases += amt
    }

    const dailyFixedCost = (costsResult.data ?? []).reduce((sum, c) => {
      const amt = Number(c.amount) || 0
      if (c.frequency === "daily") return sum + amt
      if (c.frequency === "weekly") return sum + amt / 7
      if (c.frequency === "monthly") return sum + amt / 30
      if (c.frequency === "yearly") return sum + amt / 365
      return sum
    }, 0)

    const outstandingReceivables = (customersResult.data ?? []).reduce(
      (sum, c) => sum + (Number(c.current_balance) || 0),
      0
    )

    let lowStockCount = 0
    for (const inv of inventoryResult.data ?? []) {
      const stock = Number(inv.current_stock) || 0
      const reorder = Number(inv.reorder_point) || 0
      if (stock <= 0 || (reorder > 0 && stock <= reorder)) lowStockCount++
    }

    snapshot = {
      todaySales: Math.round(todaySales),
      todayPurchases: Math.round(todayPurchases),
      todayNetProfit: Math.round(todaySales - todayPurchases - dailyFixedCost),
      outstandingReceivables: Math.round(outstandingReceivables),
      lowStockCount,
      expiryAlertCount: expiryResult.count ?? 0,
      storeName: store.name,
      ownerName: store.owner_name,
    }
  }

  const profitAccent =
    snapshot.todayNetProfit > 0 ? "green" :
    snapshot.todayNetProfit < 0 ? "red" : "slate"

  const ProfitIcon = snapshot.todayNetProfit > 0
    ? TrendingUp
    : snapshot.todayNetProfit < 0
    ? TrendingDown
    : null

  return (
    <div className="page-enter px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{snapshot.storeName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Today&apos;s overview</p>
      </div>

      {/* Desktop two-column grid */}
      <div className="md:grid md:grid-cols-[1fr_300px] md:gap-6">

        {/* Left: stats + quick actions */}
        <div className="space-y-5">
          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            <Link href="/entry"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-900 py-3.5 text-white hover:bg-slate-800 active:opacity-90 transition-colors">
              <PenLine size={18} />
              <span className="text-xs font-medium">Add Sale</span>
            </Link>
            <Link href="/scan"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3.5 text-gray-700 hover:bg-gray-50 active:opacity-80 transition-colors">
              <Camera size={18} />
              <span className="text-xs font-medium">Scan Bill</span>
            </Link>
            <Link href="/inventory"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3.5 text-gray-700 hover:bg-gray-50 active:opacity-80 transition-colors">
              <Package size={18} />
              <span className="text-xs font-medium">Stock</span>
            </Link>
          </div>

          {/* Snapshot stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Sales today"
              value={formatINR(snapshot.todaySales)}
              accent="slate"
            />
            <StatCard
              label="Purchases today"
              value={formatINR(snapshot.todayPurchases)}
              accent="slate"
            />
            {/* Profit card with trend icon */}
            <div className={`rounded-xl border p-4 ${
              profitAccent === "green" ? "bg-green-50 border-green-100" :
              profitAccent === "red"   ? "bg-red-50 border-red-100" :
              "bg-white border-gray-200"
            }`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Net profit today
              </p>
              <div className="flex items-end gap-1.5">
                <p className={`text-2xl font-bold tracking-tight ${
                  profitAccent === "green" ? "text-green-800" :
                  profitAccent === "red"   ? "text-red-700" :
                  "text-gray-900"
                }`}>
                  {formatINR(snapshot.todayNetProfit)}
                </p>
                {ProfitIcon && (
                  <ProfitIcon size={16} className={`mb-0.5 ${
                    profitAccent === "green" ? "text-green-600" : "text-red-500"
                  }`} />
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">after costs</p>
            </div>

            <Link href="/customers" className="contents">
              <StatCard
                label="Receivables"
                value={formatINR(snapshot.outstandingReceivables)}
                sublabel="outstanding credit"
                accent={snapshot.outstandingReceivables > 0 ? "amber" : "slate"}
              />
            </Link>
            <Link href="/inventory" className="contents">
              <StatCard
                label="Low stock"
                value={String(snapshot.lowStockCount)}
                sublabel={snapshot.lowStockCount > 0 ? "tap to view" : "all stocked up"}
                accent={snapshot.lowStockCount > 0 ? "red" : "slate"}
              />
            </Link>
            <Link href="/inventory" className="contents">
              <StatCard
                label="Expiring soon"
                value={String(snapshot.expiryAlertCount)}
                sublabel={snapshot.expiryAlertCount > 0 ? "within 7 days" : "none expiring"}
                accent={snapshot.expiryAlertCount > 0 ? "amber" : "slate"}
              />
            </Link>
          </div>
        </div>

        {/* Right column (desktop only): AI insight + secondary links */}
        <div className="hidden md:flex flex-col gap-4">
          <InsightCard />
          <Link href="/reports"
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            View full reports
          </Link>
          <Link href="/advisor"
            className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Ask the AI advisor
          </Link>
        </div>
      </div>

      {/* AI insight — mobile only (after stats) */}
      <div className="md:hidden mt-5">
        <InsightCard />
      </div>

      {/* Bottom nav links — mobile only */}
      <div className="md:hidden grid grid-cols-2 gap-3 mt-4">
        <Link href="/reports"
          className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          View reports
        </Link>
        <Link href="/advisor"
          className="flex items-center justify-center rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800">
          Ask advisor
        </Link>
      </div>
    </div>
  )
}
