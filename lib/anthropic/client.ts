/**
 * FILE: lib/anthropic/client.ts
 *
 * WHAT THIS DOES:
 *   Exports a singleton Anthropic client for server-side use only.
 *   Never import this in client components or NEXT_PUBLIC_ contexts.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *
 * WHERE IT FITS:
 *   Shared by all API routes that call Claude (chat, insight, extraction).
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/anthropic/advisor.ts, lib/anthropic/insight.ts, lib/anthropic/extraction.ts
 */

import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}
