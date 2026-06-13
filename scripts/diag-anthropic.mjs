/**
 * FILE: scripts/diag-anthropic.mjs
 *
 * WHAT THIS DOES:
 *   One-off diagnostic: verifies the local ANTHROPIC_API_KEY works and the
 *   model id "claude-sonnet-4-6" is valid, with a minimal 10-token call.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for debugging AI chat/insight 500s
 *
 * WHERE IT FITS:
 *   Dev tooling only. Not imported by the app. Safe to delete.
 *
 * CALLED BY / IMPORTS FROM:
 *   Run manually: node scripts/diag-anthropic.mjs
 */
import { readFileSync } from "fs"
import Anthropic from "@anthropic-ai/sdk"

const env = readFileSync(".env.local", "utf8")
const apiKey = env.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim()
console.log("Key present:", !!apiKey, "| prefix:", apiKey?.slice(0, 10))

const anthropic = new Anthropic({ apiKey })
try {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 10,
    messages: [{ role: "user", content: "Say OK" }],
  })
  console.log("MODEL+KEY OK:", msg.content[0]?.type === "text" ? msg.content[0].text : msg.content[0]?.type)
} catch (e) {
  console.log("ANTHROPIC CALL FAILED:")
  console.log("status:", e.status, "| type:", e.error?.error?.type)
  console.log("message:", e.message?.slice(0, 300))
}
