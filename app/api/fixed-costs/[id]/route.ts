/**
 * FILE: app/api/fixed-costs/[id]/route.ts
 *
 * WHAT THIS DOES:
 *   PATCH: update a fixed cost entry.
 *   DELETE: soft-delete (is_active = false) to preserve report history.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1d
 *
 * WHERE IT FITS:
 *   Used by the settings page fixed costs manager.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/settings/page.tsx
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];
const VALID_CATEGORIES = [
  "rent",
  "salaries",
  "electricity",
  "transport",
  "other",
];

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

  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = name;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0)
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    updates.amount = amount;
  }
  if (body.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(String(body.frequency)))
      return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
    updates.frequency = body.frequency;
  }
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(String(body.category)))
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    updates.category = body.category;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("fixed_costs")
    .update(updates)
    .eq("id", params.id)
    .eq("store_id", store.id)
    .select("id, name, amount, frequency, category, is_active")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ fixedCost: data });
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

  const { error } = await supabase
    .from("fixed_costs")
    .update({ is_active: false })
    .eq("id", params.id)
    .eq("store_id", store.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
