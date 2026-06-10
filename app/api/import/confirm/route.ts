/**
 * FILE: app/api/import/confirm/route.ts
 *
 * WHAT THIS DOES:
 *   POST: takes a confirmed column mapping + all rows, validates and
 *   bulk-inserts into the appropriate table (products, customers,
 *   transactions, or inventory). Scoped strictly to the authenticated store.
 *   Skips rows with missing required fields rather than failing the whole batch.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 data import
 *
 * WHERE IT FITS:
 *   Final step of the import wizard. Called after merchant confirms mapping.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/settings/page.tsx (import section)
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { parseIndianAmount, parseIndianDate } from "@/lib/parsers/amounts"
import { randomUUID } from "crypto"

interface ImportPayload {
  dataType: "products" | "customers" | "transactions" | "inventory"
  mapping: Record<string, string | null>
  rows: Record<string, string>[]
}

function mapped(row: Record<string, string>, mapping: Record<string, string | null>, field: string): string {
  const col = Object.entries(mapping).find(([, v]) => v === field)?.[0]
  return col ? (row[col] ?? "") : ""
}

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

  let body: ImportPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { dataType, mapping, rows } = body
  if (!rows?.length) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 })
  }

  const NOW = new Date().toISOString()
  let inserted = 0
  let skipped = 0

  if (dataType === "products") {
    const batch = rows
      .map((row) => {
        const name = mapped(row, mapping, "name").trim()
        if (!name) return null
        return {
          id: randomUUID(),
          store_id: store.id,
          name,
          brand: mapped(row, mapping, "brand") || null,
          category: mapped(row, mapping, "category") || "General",
          subcategory: mapped(row, mapping, "subcategory") || null,
          unit: mapped(row, mapping, "unit") || "piece",
          purchase_price: parseIndianAmount(mapped(row, mapping, "purchase_price")),
          selling_price: parseIndianAmount(mapped(row, mapping, "selling_price")),
          tax_rate: parseIndianAmount(mapped(row, mapping, "tax_rate")),
          shelf_life_days: mapped(row, mapping, "shelf_life_days")
            ? parseInt(mapped(row, mapping, "shelf_life_days")) || null
            : null,
          is_active: true,
          is_pinned: false,
          created_at: NOW,
          updated_at: NOW,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (batch.length === 0) {
      return NextResponse.json({ error: "No valid product rows found" }, { status: 400 })
    }

    const { error } = await supabase.from("products").insert(batch)
    if (error) {
      return NextResponse.json({ error: "Failed to insert products" }, { status: 500 })
    }
    inserted = batch.length
    skipped = rows.length - batch.length

  } else if (dataType === "customers") {
    const batch = rows
      .map((row) => {
        const name = mapped(row, mapping, "name").trim()
        if (!name) return null
        return {
          id: randomUUID(),
          store_id: store.id,
          name,
          phone: mapped(row, mapping, "phone") || null,
          type: mapped(row, mapping, "type") || "walk_in",
          credit_limit: parseIndianAmount(mapped(row, mapping, "credit_limit")),
          current_balance: 0,
          notes: mapped(row, mapping, "notes") || null,
          created_at: NOW,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (batch.length === 0) {
      return NextResponse.json({ error: "No valid customer rows found" }, { status: 400 })
    }

    const { error } = await supabase.from("customers").insert(batch)
    if (error) {
      return NextResponse.json({ error: "Failed to insert customers" }, { status: 500 })
    }
    inserted = batch.length
    skipped = rows.length - batch.length

  } else if (dataType === "transactions") {
    const batch = rows
      .map((row) => {
        const amountStr = mapped(row, mapping, "total_amount")
        const totalAmount = parseIndianAmount(amountStr)
        const dateStr = parseIndianDate(mapped(row, mapping, "date"))
        if (!totalAmount || !dateStr) return null
        return {
          id: randomUUID(),
          store_id: store.id,
          user_id: user.id,
          date: dateStr,
          type: mapped(row, mapping, "type") || "expense",
          total_amount: totalAmount,
          payment_method: mapped(row, mapping, "payment_method") || "cash",
          vendor_name: mapped(row, mapping, "vendor_name") || null,
          notes: mapped(row, mapping, "notes") || null,
          source: "csv_import",
          created_at: NOW,
          updated_at: NOW,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (batch.length === 0) {
      return NextResponse.json({ error: "No valid transaction rows found" }, { status: 400 })
    }

    const { error } = await supabase.from("transactions").insert(batch)
    if (error) {
      return NextResponse.json({ error: "Failed to insert transactions" }, { status: 500 })
    }
    inserted = batch.length
    skipped = rows.length - batch.length

  } else if (dataType === "inventory") {
    // Match product by name, then upsert inventory record
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("store_id", store.id)

    const productMap = new Map(
      (products ?? []).map((p) => [p.name.toLowerCase().trim(), p.id])
    )

    const batch = rows
      .map((row) => {
        const productName = mapped(row, mapping, "product_name").trim().toLowerCase()
        const productId = productMap.get(productName)
        if (!productId) return null
        return {
          id: randomUUID(),
          store_id: store.id,
          product_id: productId,
          current_stock: parseIndianAmount(mapped(row, mapping, "current_stock")),
          reorder_point: parseIndianAmount(mapped(row, mapping, "reorder_point")) || 5,
          expiry_date: parseIndianDate(mapped(row, mapping, "expiry_date")),
          updated_at: NOW,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (batch.length === 0) {
      return NextResponse.json(
        { error: "No matching products found for inventory rows. Import products first." },
        { status: 400 }
      )
    }

    const { error } = await supabase.from("inventory").upsert(batch, {
      onConflict: "store_id,product_id",
    })
    if (error) {
      return NextResponse.json({ error: "Failed to upsert inventory" }, { status: 500 })
    }
    inserted = batch.length
    skipped = rows.length - batch.length
  } else {
    return NextResponse.json({ error: "Unknown data type" }, { status: 400 })
  }

  return NextResponse.json({ inserted, skipped })
}
