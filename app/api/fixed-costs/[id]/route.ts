/**
 * FILE: app/api/fixed-costs/[id]/route.ts
 *
 * WHAT THIS DOES:
 *   GET:    fetch a monthly override for a fixed cost (by ?month=YYYY-MM).
 *   PATCH:  update a fixed cost entry.
 *   PUT:    upsert a monthly override amount (by ?month=YYYY-MM).
 *   DELETE: soft-delete the cost, or remove a single override if ?month= is set.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1d
 *   - Added GET and PUT for monthly overrides
 *   - Updated DELETE to support per-month override removal
 *
 * WHERE IT FITS:
 *   Used by the settings page fixed costs manager and override editor.
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

/* ── helpers ─────────────────────────────────────────────────────────── */

async function getAuthenticatedStore(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { user: null, store: null };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  return { user, store };
}

/* ── GET - fetch override for a month ────────────────────────────────── */

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const { user, store } = await getAuthenticatedStore(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // Verify the fixed cost belongs to this store
  const { data: cost } = await supabase
    .from("fixed_costs")
    .select("id")
    .eq("id", params.id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!cost) {
    return NextResponse.json({ error: "Fixed cost not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  if (month) {
    const { data } = await supabase
      .from("fixed_cost_overrides")
      .select("amount, note")
      .eq("fixed_cost_id", params.id)
      .eq("month", month)
      .maybeSingle();

    return NextResponse.json({ override: data });
  }

  return NextResponse.json({ override: null });
}

/* ── PUT - upsert a monthly override ─────────────────────────────────── */

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const { user, store } = await getAuthenticatedStore(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month param required (YYYY-MM)" },
      { status: 400 }
    );
  }

  // Verify the fixed cost belongs to this store
  const { data: cost } = await supabase
    .from("fixed_costs")
    .select("id")
    .eq("id", params.id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!cost) {
    return NextResponse.json({ error: "Fixed cost not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be greater than 0" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("fixed_cost_overrides")
    .upsert(
      {
        fixed_cost_id: params.id,
        month,
        amount,
        note: body.note ? String(body.note) : null,
      },
      { onConflict: "fixed_cost_id,month" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/* ── PATCH - update a fixed cost entry ───────────────────────────────── */

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const { user, store } = await getAuthenticatedStore(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

/* ── DELETE - soft-delete cost, or remove a single month override ──── */

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const { user, store } = await getAuthenticatedStore(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  if (month) {
    // Delete only the override for this month
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format (YYYY-MM)" },
        { status: 400 }
      );
    }

    // Verify the cost belongs to this store first
    const { data: cost } = await supabase
      .from("fixed_costs")
      .select("id")
      .eq("id", params.id)
      .eq("store_id", store.id)
      .maybeSingle();

    if (!cost) {
      return NextResponse.json({ error: "Fixed cost not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("fixed_cost_overrides")
      .delete()
      .eq("fixed_cost_id", params.id)
      .eq("month", month);

    if (error) {
      return NextResponse.json({ error: "Failed to remove override" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // No month param - soft-delete the entire fixed cost
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
