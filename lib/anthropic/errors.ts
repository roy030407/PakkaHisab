/**
 * FILE: lib/anthropic/errors.ts
 *
 * WHAT THIS DOES:
 *   Maps raw Anthropic API errors to plain-language messages that are safe
 *   to show a merchant. Never leaks billing/auth details or stack traces.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (AI routes were returning raw API error text)
 *
 * WHERE IT FITS:
 *   Used by every route that calls Claude before sending an error
 *   to the client.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/ai/chat/route.ts, app/api/ai/insight/route.ts
 */

export function friendlyAIError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)

  if (/credit balance|billing|purchase credits/i.test(msg)) {
    return "The AI advisor is temporarily unavailable. Please try again later."
  }
  if (/api key|authentication|unauthorized|401/i.test(msg)) {
    return "The AI advisor is not set up correctly. Please contact support."
  }
  if (/overloaded|rate.?limit|429|529/i.test(msg)) {
    return "The AI advisor is busy right now. Please try again in a minute."
  }
  return "The AI advisor could not answer right now. Please try again."
}
