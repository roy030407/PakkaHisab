/**
 * FILE: lib/anthropic/client.ts
 *
 * WHAT THIS DOES:
 *   Exports a singleton Google Gemini client for server-side use only.
 *   Never import this in client components or NEXT_PUBLIC_ contexts.
 *
 * CHANGES THIS SESSION:
 *   - Switched from Anthropic SDK to Google Gemini (free tier, 1500 req/day)
 *
 * WHERE IT FITS:
 *   Shared by all API routes that call AI (chat, insight, extraction, import/map).
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/anthropic/extraction.ts, lib/anthropic/insight.ts,
 *   app/api/ai/chat/route.ts, app/api/import/map/route.ts
 */

import { GoogleGenerativeAI } from "@google/generative-ai"

let _client: GoogleGenerativeAI | null = null

export function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not set")
    _client = new GoogleGenerativeAI(apiKey)
  }
  return _client
}

// Alias so existing callers that imported getAnthropicClient still compile
export { getGeminiClient as getAnthropicClient }
