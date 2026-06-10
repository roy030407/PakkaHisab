/**
 * FILE: app/(dashboard)/dashboard/page.tsx
 *
 * WHAT THIS DOES:
 *   Home screen dashboard. Fetches today's snapshot from /api/dashboard
 *   and renders 6 stat cards: sales, purchases, net profit, receivables,
 *   low stock count, and expiry alert count. All tap to their detail pages.
 *
 * CHANGES THIS SESSION:
 *   - Replaced Phase 1 placeholder with real Phase 4 dashboard
 *   - Added InsightCard for Phase 5 AI Advisor proactive insight
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
import type { DashboardSnapshot } from "@/types"

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch snapshot directly — same logic as /api/dashboard but server-side
  // so there's no waterfall round-trip.
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

    // Daily fixed cost allocation
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
    snapshot.todayNetProfit > 0
      ? "green"
      : snapshot.todayNetProfit < 0
      ? "red"
      : "slate"

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{snapshot.storeName}</h1>
        <p className="text-sm text-gray-500">Today&apos;s overview</p>
      </div>

      {/* AI Insight */}
      <div className="mb-5">
        <InsightCard />
      </div>

      {/* Snapshot grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
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
        <StatCard
          label="Net profit today"
          value={formatINR(snapshot.todayNetProfit)}
          sublabel="after costs"
          accent={profitAccent}
        />
        <StatCard
          label="Receivables"
          value={formatINR(snapshot.outstandingReceivables)}
          sublabel="outstanding credit"
          accent={snapshot.outstandingReceivables > 0 ? "amber" : "slate"}
        />
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

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/reports"
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:opacity-80"
        >
          View reports
        </Link>
        <Link
          href="/entry"
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800 active:opacity-80"
        >
          Add entry
        </Link>
      </div>
    </div>
  )
}
