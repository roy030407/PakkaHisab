/**
 * FILE: lib/anthropic/insight.ts
 *
 * WHAT THIS DOES:
 *   Generates one daily proactive insight for a store by calling Claude
 *   with a condensed business context. Caches in periodic_reports so it is
 *   generated at most once per day per store.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *   - Fix: update model to claude-sonnet-4-6; fix upsert onConflict target to match DB constraint
 *
 * WHERE IT FITS:
 *   Called by /api/ai/insight. Result shown as InsightCard on dashboard.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/ai/insight/route.ts
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAnthropicClient } from "./client"
import { buildBusinessContext, buildSystemPrompt, type StoreProfile } from "./advisor"
import { INSIGHT_SYSTEM_PROMPT } from "./prompts"

export async function getDailyInsight(
  supabase: SupabaseClient,
  profile: StoreProfile
): Promise<string> {
  const today = new Date().toISOString().split("T")[0]

  // Check cache first
  const { data: cached } = await supabase
    .from("periodic_reports")
    .select("summary_text")
    .eq("store_id", profile.storeId)
    .eq("report_type", "daily")
    .eq("period_start", today)
    .maybeSingle()

  if (cached?.summary_text) {
    return cached.summary_text
  }

  // Generate fresh insight
  const context = await buildBusinessContext(supabase, profile)
  const systemPrompt = buildSystemPrompt(INSIGHT_SYSTEM_PROMPT, profile, context)

  const anthropic = getAnthropicClient()
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Generate today's business insight.",
      },
    ],
  })

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : ""

  // Cache it
  await supabase.from("periodic_reports").upsert(
    {
      store_id: profile.storeId,
      report_type: "daily",
      period_start: today,
      period_end: today,
      summary_text: text,
      report_json: null,
    },
    { onConflict: "store_id,report_type" }
  )

  return text
}
