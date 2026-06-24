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
 *   - Khata Green redesign: greeting header, hero sparkline + trend pill, AttentionCard
 *   - Slice C: "Din ka hisab" card links to the cash reconciliation screen
 *   - POC: "Scan your khata" card links to the ledger capture -> day total screen
 *   - Added RecentTransactions section (transaction history feature)
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
import { GreetingHeader } from "@/components/shared/GreetingHeader"
import { AttentionCard } from "@/components/shared/AttentionCard"
import { Sparkline } from "@/components/shared/Sparkline"
import { AnimatedNumber } from "@/components/shared/AnimatedNumber"
import { PrivacyCard } from "@/components/shared/PrivacyCard"
import Link from "next/link"
import { Camera, PenLine, Package, ShoppingCart, HandCoins } from "lucide-react"
import { RecentTransactions } from "@/components/dashboard/RecentTransactions"
import { DashboardQuickSale } from "@/components/dashboard/DashboardQuickSale"

function istDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d)
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, owner_name")
    .eq("owner_id", user!.id)
    .maybeSingle()

  // Last 7 days (inclusive of today), IST
  const today = istDateString(new Date())
  const sevenDaysAgo = istDateString(new Date(Date.now() - 6 * 86400000))
  const monthStart = today.slice(0, 8) + "01"

  let salesToday = 0, purchasesToday = 0, txCountToday = 0
  let salesMtd = 0, purchasesMtd = 0
  let dailyFixedCost = 0, outstandingReceivables = 0, receivableCustomers = 0
  let lowStockCount = 0, expiryCount = 0
  let profitByDay: number[] = []
  let dayLabels: string[] = []
  let totalTxCount = 0, totalSalesAmount = 0, activeSinceDays = 0, activeSinceDate = ""

  if (store) {
    const [txResult, mtdResult, allTimeSalesResult, earliestTxResult, costsResult, customersResult, inventoryResult, expiryResult] =
      await Promise.all([
        supabase
          .from("transactions")
          .select("type, total_amount, date")
          .eq("store_id", store.id)
          .is("voided_at", null)
          .gte("date", sevenDaysAgo)
          .lte("date", today),
        supabase
          .from("transactions")
          .select("type, total_amount")
          .eq("store_id", store.id)
          .is("voided_at", null)
          .gte("date", monthStart)
          .lte("date", today),
        supabase
          .from("transactions")
          .select("type, total_amount")
          .eq("store_id", store.id)
          .is("voided_at", null),
        supabase
          .from("transactions")
          .select("date")
          .eq("store_id", store.id)
          .is("voided_at", null)
          .order("date", { ascending: true })
          .limit(1),
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
          .lte("expiry_date", istDateString(new Date(Date.now() + 7 * 86400000)))
          .gt("current_stock", 0),
      ])

    dailyFixedCost = (costsResult.data ?? []).reduce((sum, c) => {
      const amt = Number(c.amount) || 0
      if (c.frequency === "daily") return sum + amt
      if (c.frequency === "weekly") return sum + amt / 7
      if (c.frequency === "monthly") return sum + amt / 30
      if (c.frequency === "yearly") return sum + amt / 365
      return sum
    }, 0)

    // Bucket transactions into the 7 calendar days
    const buckets = new Map<string, { sales: number; purchases: number; count: number }>()
    for (let i = 6; i >= 0; i--) {
      buckets.set(istDateString(new Date(Date.now() - i * 86400000)), {
        sales: 0, purchases: 0, count: 0,
      })
    }
    for (const tx of txResult.data ?? []) {
      const b = buckets.get(tx.date)
      if (!b) continue
      const amt = Number(tx.total_amount) || 0
      if (tx.type === "sale") { b.sales += amt; b.count++ }
      else if (tx.type === "purchase") { b.purchases += amt; b.count++ }
    }

    profitByDay = Array.from(buckets.values()).map(
      (b) => b.sales - b.purchases - dailyFixedCost
    )
    dayLabels = Array.from(buckets.keys()).map((d, i) =>
      i === 6 ? "Today"
        : new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })
            .format(new Date(`${d}T12:00:00`))
    )

    const todayBucket = buckets.get(today)!
    salesToday = todayBucket.sales
    purchasesToday = todayBucket.purchases
    txCountToday = todayBucket.count

    for (const tx of mtdResult.data ?? []) {
      const amt = Number(tx.total_amount) || 0
      if (tx.type === "sale") salesMtd += amt
      else if (tx.type === "purchase") purchasesMtd += amt
    }

    outstandingReceivables = (customersResult.data ?? []).reduce(
      (sum, c) => sum + (Number(c.current_balance) || 0), 0
    )
    receivableCustomers = (customersResult.data ?? []).length

    for (const inv of inventoryResult.data ?? []) {
      const stock = Number(inv.current_stock) || 0
      const reorder = Number(inv.reorder_point) || 0
      if (stock <= 0 || (reorder > 0 && stock <= reorder)) lowStockCount++
    }
    expiryCount = expiryResult.count ?? 0

    for (const tx of allTimeSalesResult.data ?? []) {
      totalTxCount++
      if (tx.type === "sale") totalSalesAmount += Number(tx.total_amount) || 0
    }

    const earliest = earliestTxResult.data?.[0]?.date
    if (earliest) {
      const diff = Date.now() - new Date(earliest + "T00:00:00+05:30").getTime()
      activeSinceDays = Math.max(1, Math.ceil(diff / 86400000))
      activeSinceDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
        .format(new Date(earliest + "T00:00:00+05:30"))
    }
  }

  const netProfitToday = Math.round(salesToday - purchasesToday - dailyFixedCost)
  const netProfitYesterday = Math.round(profitByDay[5] ?? 0)
  const trendPct =
    netProfitYesterday !== 0
      ? Math.round(((netProfitToday - netProfitYesterday) / Math.abs(netProfitYesterday)) * 100)
      : null

  const dayOfMonth = new Date().getDate()
  const mtdFixedCost = dailyFixedCost * dayOfMonth
  const netProfitMtd = Math.round(salesMtd - purchasesMtd - mtdFixedCost)
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "Asia/Kolkata" }).format(new Date())

  const formatLargeINR = (n: number) => {
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(Math.round(n))
  }

  return (
    <div className="page-enter px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto">
      {/* Usage evidence banner */}
      {activeSinceDays > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-white">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-medium">Active {activeSinceDays} days</span>
            <span className="text-gray-400">|</span>
            <span>{totalTxCount} transactions</span>
            <span className="text-gray-400">|</span>
            <span>&#8377;{formatLargeINR(totalSalesAmount)} in sales</span>
          </div>
          <span className="text-[10px] text-gray-400">since {activeSinceDate}</span>
        </div>
      )}

      <div className="mb-5">
        <GreetingHeader
          ownerName={store?.owner_name ?? ""}
          storeName={store?.name ?? "Your store"}
        />
      </div>

      <div className="md:grid md:grid-cols-[1fr_300px] md:gap-6">
        <div className="space-y-4">

          {/* Hero sales + profit card */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-5">
            <div className="pointer-events-none absolute -right-5 -top-5 h-28 w-28 rounded-full bg-emerald-500/[0.08]" />
            <div className="pointer-events-none absolute -bottom-9 right-5 h-20 w-20 rounded-full bg-emerald-500/[0.06]" />

            <div className="grid grid-cols-2 gap-4">
              {/* Today */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Today
                </p>
                <div className="mt-2 space-y-1">
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600/70">Sales</p>
                    <p className="text-xl font-extrabold tracking-tight leading-none text-emerald-950">
                      <AnimatedNumber value={Math.round(salesToday)} format="inr" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600/70">Profit</p>
                    <div className="flex items-end gap-1.5">
                      <p className={`text-xl font-extrabold tracking-tight leading-none ${
                        netProfitToday < 0 ? "text-red-700" : "text-emerald-950"
                      }`}>
                        <AnimatedNumber value={netProfitToday} format="inr" />
                      </p>
                      {trendPct !== null && (
                        <span className={`mb-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                          trendPct >= 0
                            ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-600"
                        }`}>
                          {trendPct >= 0 ? "▲" : "▼"} {Math.abs(trendPct)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Month to date */}
              <div className="border-l border-emerald-200/60 pl-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  {monthName} (1-{dayOfMonth})
                </p>
                <div className="mt-2 space-y-1">
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600/70">Sales</p>
                    <p className="text-xl font-extrabold tracking-tight leading-none text-emerald-950">
                      <AnimatedNumber value={Math.round(salesMtd)} format="inr" />
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600/70">Profit</p>
                    <p className={`text-xl font-extrabold tracking-tight leading-none ${
                      netProfitMtd < 0 ? "text-red-700" : "text-emerald-950"
                    }`}>
                      <AnimatedNumber value={netProfitMtd} format="inr" />
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Sparkline values={profitByDay} labels={dayLabels} />
            </div>
          </div>

          {/* Quick sale from frequent items */}
          <DashboardQuickSale />

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            <Link href="/entry"
              className="flex flex-col items-center gap-1.5 rounded-xl bg-emerald-700 py-3.5 text-white hover:bg-emerald-800 active:opacity-90 transition-colors">
              <PenLine size={18} />
              <span className="text-xs font-medium">Add Sale</span>
            </Link>
            <Link href="/scan"
              className="card-lift flex flex-col items-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3.5 text-gray-700">
              <Camera size={18} />
              <span className="text-xs font-medium">Scan Bill</span>
            </Link>
            <Link href="/inventory"
              className="card-lift flex flex-col items-center gap-1.5 rounded-xl bg-white border border-gray-200 py-3.5 text-gray-700">
              <Package size={18} />
              <span className="text-xs font-medium">Stock</span>
            </Link>
          </div>

          {/* Sales + Udhaar */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Sales today"
              value={formatINR(Math.round(salesToday))}
              rawValue={Math.round(salesToday)}
              format="inr-compact"
              sublabel={`${txCountToday} transaction${txCountToday === 1 ? "" : "s"}`}
              icon={ShoppingCart}
            />
            <Link href="/customers?tab=udhaar" className="contents">
              <StatCard
                label="Udhaar due"
                value={formatINR(Math.round(outstandingReceivables))}
                rawValue={Math.round(outstandingReceivables)}
                format="inr-compact"
                sublabel={
                  receivableCustomers > 0
                    ? `from ${receivableCustomers} customer${receivableCustomers === 1 ? "" : "s"}`
                    : "no credit pending"
                }
                accent={outstandingReceivables > 0 ? "amber" : "slate"}
                icon={HandCoins}
              />
            </Link>
          </div>

          {/* Consolidated alerts */}
          <AttentionCard lowStockCount={lowStockCount} expiryCount={expiryCount} />

          {/* Recent transactions */}
          <RecentTransactions />

          {/* Scan your khata (ledger -> day total) */}
          <Link href="/ledger"
            className="card-lift flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Scan your khata</p>
              <p className="text-xs text-emerald-700/80">Photo your ledger page - see entries + day total</p>
            </div>
            <span className="text-emerald-700">&rarr;</span>
          </Link>

          {/* Din ka hisab */}
          <Link href="/reconcile"
            className="card-lift flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-gray-900">Din ka hisab</p>
              <p className="text-xs text-gray-400">Close the day - count the cash drawer</p>
            </div>
            <span className="text-emerald-700">&rarr;</span>
          </Link>
        </div>

        {/* Right rail (desktop) */}
        <div className="hidden md:flex flex-col gap-4">
          <InsightCard />
          <Link href="/reports"
            className="card-lift flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700">
            View full reports
          </Link>
          <Link href="/advisor"
            className="card-lift flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700">
            Ask the AI advisor
          </Link>
          <PrivacyCard />
        </div>
      </div>

      {/* Mobile: insight + links */}
      <div className="md:hidden mt-4 space-y-4">
        <InsightCard />
        <PrivacyCard />
      </div>
      <div className="md:hidden grid grid-cols-2 gap-3 mt-4 mb-8">
        <Link href="/reports"
          className="flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700">
          View reports
        </Link>
        <Link href="/advisor"
          className="flex items-center justify-center rounded-xl bg-emerald-700 py-3 text-sm font-medium text-white hover:bg-emerald-800">
          Ask advisor
        </Link>
      </div>
    </div>
  )
}
