/**
 * FILE: app/api/import/template/route.ts
 *
 * WHAT THIS DOES:
 *   POST { templateName }: loads a curated sample product catalog and
 *   fixed costs into the authenticated store. Idempotent — skips products
 *   if the store already has > 10 products (won't overwrite existing data).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 template import
 *
 * WHERE IT FITS:
 *   Available at onboarding and in settings. One POST to pre-populate
 *   the store with ~50-60 products and suggested fixed costs.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/settings/page.tsx (template section)
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { STORE_TEMPLATES, TEMPLATE_NAMES } from "@/data/seeds/index"
import { randomUUID } from "crypto"

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  let body: { templateName: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const templateName = body.templateName?.toLowerCase().trim()
  const template = STORE_TEMPLATES[templateName]
  if (!template) {
    return NextResponse.json(
      { error: `Unknown template. Available: ${Object.keys(STORE_TEMPLATES).join(", ")}` },
      { status: 400 }
    )
  }

  // Check if store already has products — don't overwrite
  const { count: existingCount } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)

  if ((existingCount ?? 0) > 10) {
    return NextResponse.json(
      { error: "Store already has products. Clear existing products before loading a template." },
      { status: 409 }
    )
  }

  const NOW = new Date().toISOString()

  // Insert products
  const products = template.products.map((p, i) => ({
    id: randomUUID(),
    store_id: store.id,
    item_number: i + 1,
    name: p.name,
    brand: p.brand ?? null,
    category: p.category,
    subcategory: p.subcategory ?? null,
    unit: p.unit,
    purchase_price: p.purchase_price,
    selling_price: p.selling_price,
    tax_rate: p.tax_rate,
    shelf_life_days: p.shelf_life_days ?? null,
    is_active: true,
    is_pinned: false,
    created_at: NOW,
    updated_at: NOW,
  }))

  const { error: productError } = await supabase.from("products").insert(products)
  if (productError) {
    return NextResponse.json({ error: "Failed to insert products" }, { status: 500 })
  }

  // Insert inventory rows with a default stock of 0 (merchant sets actual stock)
  const inventory = products.map((p) => ({
    id: randomUUID(),
    store_id: store.id,
    product_id: p.id,
    current_stock: 0,
    reorder_point: 5,
    updated_at: NOW,
  }))

  await supabase.from("inventory").insert(inventory)

  // Insert fixed costs (skip if already has some)
  const { count: costsCount } = await supabase
    .from("fixed_costs")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)

  if ((costsCount ?? 0) === 0) {
    const fixedCosts = template.fixedCosts.map((c) => ({
      id: randomUUID(),
      store_id: store.id,
      name: c.name,
      amount: c.amount,
      frequency: c.frequency,
      category: c.category,
      is_active: true,
      created_at: NOW,
    }))
    await supabase.from("fixed_costs").insert(fixedCosts)
  }

  return NextResponse.json({
    templateName: TEMPLATE_NAMES[templateName] ?? templateName,
    productsInserted: products.length,
    fixedCostsInserted: (costsCount ?? 0) === 0 ? template.fixedCosts.length : 0,
  })
}
