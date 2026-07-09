/**
 * FILE: lib/anthropic/voiceParse.ts
 *
 * WHAT THIS DOES:
 *   Sends one short spoken-phrase audio clip to Gemini and gets back a single
 *   JSON: the transcript, whether it is items or a command, the parsed items
 *   (Hindi expanded to clean English names, Hinglish numbers read), and the
 *   command if any. Returns a typed, normalized VoiceParseResult.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1). Gemini audio, NOT Claude.
 *   - Layer 3: classify remove_last + set_qty (set_qty number in args.quantity)
 *   - Layer 4: classify attach_customer + customer_balance (name in args.customerName)
 *   - Catalog biasing: caller can pass the store's product names, which are
 *     appended to the system instruction so Gemini transcribes spoken names
 *     as known catalog products instead of guessing blind
 *
 * WHERE IT FITS:
 *   Called by app/api/voice/parse/route.ts with the base64 audio segment.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/voice/parse/route.ts ; uses lib/anthropic/client.ts and
 *   lib/voice/parseGemini.ts
 */
import type { VoiceParseResult } from '@/lib/voice/types'
import { normalizeVoiceParse } from '@/lib/voice/parseGemini'
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from './client'

const SYSTEM_INSTRUCTION = `You are a voice assistant for an Indian kirana (grocery) shopkeeper logging sales hands-free at the counter, mid-rush, speaking Hinglish. You receive a short audio clip of ONE spoken phrase. Return ONLY valid JSON, no markdown.

First decide: is the phrase a list of ITEMS being sold, or a COMMAND to the app?

Map command phrases to one of these (else it is items):
- "next" / "agla" / "agla customer" / "iska ho gaya" -> "next"
- "close" / "khatam" / "bas" / "ho gaya" / "band karo" -> "close"
- "balance" / "hisab" / "total" / "kitna hua" / "kitne ka" -> "read_balance"
- "remove last" / "aakhri hata do" / "pichla hata do" / "ye hata do" / "galat" -> "remove_last"
- "set quantity" / "change quantity" / "teen kar do" / "do kar do" / "make it 3" -> "set_qty" (put the new number in args.quantity)
- "<name> udhaar" / "<name> ko udhaar" / "udhaar <name>" / "<name> ke naam" -> "attach_customer" (put the person name in args.customerName)
- "<name> ka kitna baaki" / "<name> ka balance" / "<name> ka hisab" / "<name> kitna dena hai" -> "customer_balance" (put the person name in args.customerName)

For ITEMS, expand common Hindi to clean English product names (doodh->milk, chawal->rice, cheeni->sugar, atta->wheat flour, anda->egg, tel->oil, namak->salt). Keep brand names exactly (Parle-G, Thums Up, Amul, Maggi). Read Hindi/Hinglish numbers (ek=1, do=2, teen=3, chaar=4, paanch=5, das=10, dozen=12). If no number is spoken for an item, use quantity 1.

Return exactly:
{
  "transcript": string,
  "kind": "items" | "command",
  "items": [ { "name": string, "quantity": number, "unit": string | null } ],
  "command": "next" | "close" | "read_balance" | "remove_last" | "set_qty" | "attach_customer" | "customer_balance" | null,
  "args": { "quantity": number | null, "customerName": string | null }
}`

export async function parseVoiceAudio(
  audioBase64: string,
  mimeType: string,
  catalogNames: string[] = [],
): Promise<VoiceParseResult> {
  const genAI = getGeminiClient()

  // Bias transcription toward the store's own catalog. Kirana product and
  // brand names spoken in Hinglish are frequently misheard without this.
  const catalogHint = catalogNames.length
    ? `\n\nThis shop sells the following products. When a spoken item sounds like one of these, transcribe it as that exact product name (these are the most likely words the shopkeeper says):\n${catalogNames.join(', ')}`
    : ''

  const response = await genAI.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: audioBase64, mimeType } },
        { text: 'Parse this spoken phrase into the JSON schema.' },
      ],
    }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION + catalogHint,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  })

  let text = (response.text ?? '').trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {}
  }
  return normalizeVoiceParse(parsed)
}
