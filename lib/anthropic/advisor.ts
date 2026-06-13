/**
 * FILE: lib/anthropic/advisor.ts
 *
 * WHAT THIS DOES:
 *   Builds the business context payload that goes into Claude's system prompt.
 *   Queries the last 90 days of transactions, inventory, fixed costs,
 *   and customer balances — all scoped to the authenticated store.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *
 * WHERE IT FITS:
 *   Called by /api/ai/chat and /api/ai/insight before calling Claude.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/ai/chat/route.ts, app/api/ai/insight/route.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface StoreProfile {
  storeId: string
  storeName: string
  storeType: string
  ownerName: string
  preferredLanguage: string
}

const LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  mr: "Marathi",
}

export async function buildBusinessContext(
  supabase: SupabaseClient,
  profile: StoreProfile
): Promise<string> {
  const { storeId } = profile
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ago90 = ninetyDaysAgo.toISOString().split("T")[0]
  const todayStr = today.toISOString().split("T")[0]

  // Last 90 days transactions
  const [txResult, inventoryResult, fixedCostsResult, customersResult] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("type, total_amount, payment_method, date")
        .eq("store_id", storeId)
        .gte("date", ago90)
        .lte("date", todayStr),
      supabase
        .from("inventory")
        .select(
          "current_stock, reorder_point, expiry_date, product_id, products(name, category)"
        )
        .eq("store_id", storeId),
      supabase
        .from("fixed_costs")
        .select("name, amount, frequency")
        .eq("store_id", storeId)
        .eq("is_active", true),
      supabase
        .from("customers")
        .select("name, current_balance, type")
        .eq("store_id", storeId)
        .gt("current_balance", 0)
        .order("current_balance", { ascending: false })
        .limit(5),
    ])

  const txRows = txResult.data ?? []
  let totalSales = 0
  let totalPurchases = 0
  let cashSales = 0
  let upiSales = 0
  let creditSales = 0

  // Current month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0]
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    .toISOString()
    .split("T")[0]

  let thisMonthSales = 0
  let lastMonthSales = 0

  for (const tx of txRows) {
    const amt = Number(tx.total_amount) || 0
    if (tx.type === "sale") {
      totalSales += amt
      if (tx.date >= monthStart) thisMonthSales += amt
      if (tx.date >= lastMonthStart && tx.date <= lastMonthEnd) lastMonthSales += amt
      if (tx.payment_method === "cash") cashSales += amt
      else if (tx.payment_method === "upi") upiSales += amt
      else if (tx.payment_method === "credit") creditSales += amt
    } else if (tx.type === "purchase") {
      totalPurchases += amt
    }
  }

  const grossMargin = totalSales - totalPurchases

  // Fixed costs (monthly equivalent)
  const monthlyCost = (fixedCostsResult.data ?? []).reduce((sum, c) => {
    const amt = Number(c.amount) || 0
    if (c.frequency === "daily") return sum + amt * 30
    if (c.frequency === "weekly") return sum + amt * 4
    if (c.frequency === "monthly") return sum + amt
    if (c.frequency === "yearly") return sum + amt / 12
    return sum
  }, 0)

  // Inventory alerts
  const inv = inventoryResult.data ?? []
  const outOfStock: string[] = []
  const lowStock: string[] = []
  const expiringSoon: string[] = []
  const in7Days = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .split("T")[0]

  for (const row of inv) {
    const name =
      (row.products as { name?: string } | null)?.name ?? "Unknown product"
    const stock = Number(row.current_stock) || 0
    const reorder = Number(row.reorder_point) || 0
    if (stock <= 0) {
      outOfStock.push(name)
    } else if (reorder > 0 && stock <= reorder) {
      lowStock.push(name)
    }
    if (row.expiry_date && row.expiry_date <= in7Days && stock > 0) {
      expiringSoon.push(`${name} (expires ${row.expiry_date})`)
    }
  }

  // Top customers by outstanding balance
  const topDebtors = (customersResult.data ?? [])
    .slice(0, 3)
    .map((c) => `${c.name}: ₹${Math.round(Number(c.current_balance) || 0).toLocaleString("en-IN")}`)
    .join(", ")

  const fmt = (n: number) =>
    `₹${Math.round(n).toLocaleString("en-IN")}`

  const lines: string[] = [
    `--- LAST 90 DAYS ---`,
    `Total sales: ${fmt(totalSales)} | Total purchases: ${fmt(totalPurchases)}`,
    `Gross margin: ${fmt(grossMargin)} (${totalSales > 0 ? Math.round((grossMargin / totalSales) * 100) : 0}%)`,
    `This month sales: ${fmt(thisMonthSales)} | Last month sales: ${fmt(lastMonthSales)}`,
    `Payment split: Cash ${fmt(cashSales)}, UPI ${fmt(upiSales)}, Credit ${fmt(creditSales)}`,
    ``,
    `--- FIXED COSTS ---`,
    `Monthly fixed costs: ${fmt(monthlyCost)} (rent, salaries, electricity etc.)`,
    monthlyCost > 0
      ? `Estimated net profit (90 days): ${fmt(grossMargin - monthlyCost * 3)}`
      : "",
    ``,
    `--- INVENTORY STATUS ---`,
    outOfStock.length > 0
      ? `Out of stock: ${outOfStock.slice(0, 8).join(", ")}`
      : "No out-of-stock items",
    lowStock.length > 0
      ? `Low stock: ${lowStock.slice(0, 8).join(", ")}`
      : "No low-stock items",
    expiringSoon.length > 0
      ? `Expiring soon: ${expiringSoon.slice(0, 5).join(", ")}`
      : "No items expiring soon",
    ``,
    `--- OUTSTANDING RECEIVABLES ---`,
    topDebtors
      ? `Top customers who owe money: ${topDebtors}`
      : "No outstanding credit",
  ]

  return lines.filter((l) => l !== "").join("\n")
}

export function buildSystemPrompt(
  template: string,
  profile: StoreProfile,
  context: string
): string {
  const langName = LANG_NAMES[profile.preferredLanguage] ?? "English"
  // Strip {{...}} patterns from user-controlled fields to prevent double-substitution
  const sanitize = (s: string) => s.replace(/\{\{[^}]*\}\}/g, "")
  return template
    .replace(/{{storeName}}/g, sanitize(profile.storeName))
    .replace(/{{storeType}}/g, sanitize(profile.storeType))
    .replace(/{{ownerName}}/g, sanitize(profile.ownerName))
    .replace(/{{language}}/g, langName)
    .replace(/{{businessContext}}/g, context)
}
