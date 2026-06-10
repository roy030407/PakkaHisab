/**
 * FILE: app/api/ai/insight/route.ts
 *
 * WHAT THIS DOES:
 *   GET: Returns today's proactive insight for the store.
 *   Checks periodic_reports cache first; generates via Claude only if
 *   no entry exists for today. At most one API call per store per day.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *
 * WHERE IT FITS:
 *   Called by the dashboard page to populate the InsightCard.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/ai/InsightCard.tsx (via fetch in dashboard page)
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getDailyInsight } from "@/lib/anthropic/insight"

export async function GET() {
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
    .select("id, name, type, owner_name, preferred_language")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  const profile = {
    storeId: store.id,
    storeName: store.name,
    storeType: store.type,
    ownerName: store.owner_name,
    preferredLanguage: store.preferred_language ?? "en",
  }

  try {
    const insight = await getDailyInsight(supabase, profile)
    return NextResponse.json({ insight })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate insight"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
