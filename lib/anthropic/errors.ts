/**
 * FILE: lib/anthropic/errors.ts
 *
 * WHAT THIS DOES:
 *   Maps raw Google Gemini API errors to plain-language messages that are safe
 *   to show a merchant. Never leaks billing/auth details or stack traces.
 *
 * CHANGES THIS SESSION:
 *   - Updated error patterns for Gemini (was Anthropic billing/auth errors)
 *
 * WHERE IT FITS:
 *   Used by every route that calls Gemini before sending an error to the client.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/ai/chat/route.ts, app/api/ai/insight/route.ts
 */

export function friendlyAIError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)

  if (/quota|resource.?exhausted|RESOURCE_EXHAUSTED|rate.?limit|429/i.test(msg)) {
    return "The AI advisor is busy right now. Please try again in a minute."
  }
  if (/api.?key|invalid.?key|API_KEY_INVALID|unauthorized|permission|403|401/i.test(msg)) {
    return "The AI advisor is not set up correctly. Please contact support."
  }
  if (/billing|credit|payment|BILLING/i.test(msg)) {
    return "The AI advisor is temporarily unavailable. Please try again later."
  }
  return "The AI advisor could not answer right now. Please try again."
}
