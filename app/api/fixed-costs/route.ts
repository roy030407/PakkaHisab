/**
 * FILE: app/api/fixed-costs/route.ts
 *
 * WHAT THIS DOES:
 *   GET: list all active fixed costs for the user's store.
 *   POST: create a new fixed cost entry.
 *   Fixed costs are used in profit calculations throughout the app - *   distributed across reporting periods (monthly / 30 = daily cost).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 1d
 *
 * WHERE IT FITS:
 *   Feeds into profit calculations in Phase 4 (reports).
 *   Managed from the settings page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/settings/page.tsx, lib/reports/profit.ts (Phase 4)
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

export async function GET() {
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

  const { data, error } = await supabase
    .from("fixed_costs")
    .select("id, name, amount, frequency, category, is_active, created_at")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ fixedCosts: data ?? [] });
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
    amount: number;
    frequency: string;
    category: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Cost name is required" }, { status: 400 });
  }
  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }
  if (!VALID_FREQUENCIES.includes(body.frequency)) {
    return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("fixed_costs")
    .insert({
      store_id: store.id,
      name: body.name.trim(),
      amount: body.amount,
      frequency: body.frequency,
      category: body.category,
    })
    .select("id, name, amount, frequency, category, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create fixed cost" }, { status: 500 });
  }

  return NextResponse.json({ fixedCost: data }, { status: 201 });
}
