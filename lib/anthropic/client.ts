/**
 * FILE: lib/anthropic/client.ts
 *
 * WHAT THIS DOES:
 *   Exports a singleton Google Gemini client for server-side use only.
 *   Never import this in client components or NEXT_PUBLIC_ contexts.
 *
 * CHANGES THIS SESSION:
 *   - Switched from Anthropic SDK to Google Gemini (free tier, 1500 req/day)
 *   - Upgraded from @google/generative-ai to @google/genai (supports AQ. key format)
 *   - Model updated to gemini-2.5-flash
 *   - Default now gemini-flash-latest: gemini-2.5-flash was retired and
 *     returned 404 on generateContent, silently breaking every AI feature
 *     (voice, chat, insight, extraction) wherever GEMINI_MODEL is unset
 *
 * WHERE IT FITS:
 *   Shared by all API routes that call AI (chat, insight, extraction, import/map).
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/anthropic/extraction.ts, lib/anthropic/insight.ts,
 *   app/api/ai/chat/route.ts, app/api/import/map/route.ts
 */

import { GoogleGenAI } from "@google/genai"

let _client: GoogleGenAI | null = null

// "latest" alias tracks Google's current flash model so a model retirement
// (like gemini-2.5-flash in July 2026) cannot 404 the whole AI layer again.
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest"

export function getGeminiClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not set")
    _client = new GoogleGenAI({ apiKey })
  }
  return _client
}

// Alias so existing callers that imported getAnthropicClient still compile
export { getGeminiClient as getAnthropicClient }
