/**
 * FILE: app/api/products/route.ts
 *
 * WHAT THIS DOES:
 *   GET: list all active products for the user's store, sorted by
 *   is_pinned desc, then is_frequently_used (recently used), then name.
 *   POST: create a new product (with optional parent for variants).
 *   All queries are scoped to store_id via RLS and explicit filter.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1c (product catalog)
 *
 * WHERE IT FITS:
 *   Core data layer for the product catalog. Used by the products page,
 *   quick entry, and bill scanning flows.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/products/page.tsx, components/entry/ProductSearch.tsx
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's store
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q")?.trim();
  const category = searchParams.get("category");
  const parentOnly = searchParams.get("parent_only") === "true";

  let query = supabase
    .from("products")
    .select(
      "id, item_number, parent_product_id, name, brand, category, subcategory, unit, purchase_price, selling_price, tax_rate, shelf_life_days, is_active, is_pinned, created_at, updated_at"
    )
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("is_pinned", { ascending: false })
    .order("name", { ascending: true });

  if (parentOnly) {
    query = query.is("parent_product_id", null);
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (search) {
    // Partial match on name, brand, or item_number
    query = query.or(
      `name.ilike.%${search}%,brand.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: {
    name: string;
    brand?: string;
    category?: string;
    subcategory?: string;
    unit?: string;
    purchasePrice?: number;
    sellingPrice?: number;
    taxRate?: number;
    shelfLifeDays?: number;
    parentProductId?: string;
    isPinned?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  // Validate parent product belongs to the same store if provided
  if (body.parentProductId) {
    const { data: parent } = await supabase
      .from("products")
      .select("id")
      .eq("id", body.parentProductId)
      .eq("store_id", store.id)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json(
        { error: "Parent product not found" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: store.id,
      item_number: 0, // Trigger assigns the real sequential number
      parent_product_id: body.parentProductId ?? null,
      name: body.name.trim(),
      brand: body.brand?.trim() ?? null,
      category: body.category?.trim() ?? null,
      subcategory: body.subcategory?.trim() ?? null,
      unit: body.unit ?? "piece",
      purchase_price: body.purchasePrice ?? 0,
      selling_price: body.sellingPrice ?? 0,
      tax_rate: body.taxRate ?? 0,
      shelf_life_days: body.shelfLifeDays ?? null,
      is_pinned: body.isPinned ?? false,
    })
    .select(
      "id, item_number, name, brand, category, unit, purchase_price, selling_price, tax_rate, is_active, is_pinned, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }

  return NextResponse.json({ product: data }, { status: 201 });
}
