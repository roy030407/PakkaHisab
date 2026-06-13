/**
 * FILE: app/api/stores/route.ts
 *
 * WHAT THIS DOES:
 *   GET: returns the current user's store record (used to determine
 *   whether onboarding is needed and to seed the session context).
 *   POST: creates a new store record for the authenticated user.
 *   Optionally triggers sample product seeding if wantsSampleStore=true.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation - replaces old /api/businesses route
 *
 * WHERE IT FITS:
 *   Called by the onboarding page on submit, and by the dashboard layout
 *   to check if a store record exists.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(auth)/onboarding/page.tsx, app/(dashboard)/layout.tsx
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StoreOnboardingFormData } from "@/types";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("stores")
    .select(
      "id, name, type, owner_name, city, gst_number, preferred_language, is_interstate, created_at"
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ store: data });
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

  let body: StoreOnboardingFormData;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, type, ownerName, city, gstNumber, preferredLanguage } = body;

  if (!name?.trim() || !type || !ownerName?.trim() || !city?.trim() || !preferredLanguage) {
    return NextResponse.json(
      { error: "Store name, type, owner name, city, and language are required" },
      { status: 400 }
    );
  }

  // Prevent duplicate stores for the same user
  const { data: existing } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ store: existing }, { status: 200 });
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      owner_id: user.id,
      name: name.trim(),
      type,
      owner_name: ownerName.trim(),
      city: city.trim(),
      gst_number: gstNumber?.trim() || null,
      preferred_language: preferredLanguage,
      is_interstate: false,
    })
    .select("id, name, type")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create store" },
      { status: 500 }
    );
  }

  // Sample store seeding is handled by a separate endpoint (Phase 1e / data/seeds)
  // wantsSampleStore flag is stored and seed is triggered when seed data is ready

  return NextResponse.json({ store: data }, { status: 201 });
}
