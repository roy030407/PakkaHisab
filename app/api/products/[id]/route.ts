/**
 * FILE: app/api/products/[id]/route.ts
 *
 * WHAT THIS DOES:
 *   GET: fetch a single product with its variants.
 *   PATCH: update product fields (partial update).
 *   DELETE: soft-delete by setting is_active = false.
 *   All operations are store-scoped via RLS.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1c (product catalog)
 *
 * WHERE IT FITS:
 *   Used by the product edit form and variant manager.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/products/VariantManager.tsx, products page edit actions
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  // Fetch product + its variants in one query
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, item_number, parent_product_id, name, brand, category, subcategory, unit, purchase_price, selling_price, tax_rate, shelf_life_days, is_active, is_pinned, created_at, updated_at"
    )
    .eq("id", params.id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Fetch variants if this is a parent product
  const { data: variants } = await supabase
    .from("products")
    .select(
      "id, item_number, name, unit, purchase_price, selling_price, tax_rate, is_active"
    )
    .eq("parent_product_id", params.id)
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return NextResponse.json({ product: { ...product, variants: variants ?? [] } });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Only allow safe field updates
  const allowed = [
    "name",
    "brand",
    "category",
    "subcategory",
    "unit",
    "purchase_price",
    "selling_price",
    "tax_rate",
    "shelf_life_days",
    "is_pinned",
    "is_active",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    // Accept both camelCase and snake_case from client
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (body[camel] !== undefined) updates[key] = body[camel];
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (updates["name"] !== undefined) {
    updates["name"] = String(updates["name"]).trim();
    if (!updates["name"]) {
      return NextResponse.json({ error: "Product name cannot be empty" }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", params.id)
    .eq("store_id", store.id)
    .select("id, name, purchase_price, selling_price, tax_rate, is_active, is_pinned, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
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

  // Soft delete — preserves transaction history
  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", params.id)
    .eq("store_id", store.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
