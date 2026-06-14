/**
 * FILE: lib/anthropic/extraction.ts
 *
 * WHAT THIS DOES:
 *   Calls Gemini Vision to READ a bill. It normalizes each line into a clean
 *   name + size token + number tokens (with a guessed role per number). It does
 *   NOT match against the catalog - matching is done in code (lib/scan).
 *
 * CHANGES THIS SESSION:
 *   - Read-only output (normalizedName, sizeToken, numberTokens); matching moved
 *     to lib/scan/match.ts + resolve.ts.
 *
 * WHERE IT FITS:
 *   Called by app/api/scan/route.ts; its output is fed to resolveItems().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RawExtractedItem, NumberToken, ConfidenceLevel, DocumentType } from '@/types'
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from './client'

export interface RawExtraction {
  documentType: DocumentType
  vendorName?: string
  date?: string
  totalAmount?: number
  confidence: ConfidenceLevel
  rawItems: RawExtractedItem[]
}

interface Correction { field_name: string; original_value: string; corrected_value: string }

export async function extractBillData(
  supabase: SupabaseClient,
  storeId: string,
  imageBase64: string,
  mimeType: string
): Promise<RawExtraction> {
  const { data: corrections } = await supabase
    .from('extraction_corrections')
    .select('field_name, original_value, corrected_value')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(5)

  const correctionLines = (corrections as Correction[] ?? [])
    .map(c => `In a previous scan for this store, '${c.original_value}' was read as '${c.corrected_value}' (field: ${c.field_name}).`)
    .join('\n')

  const systemInstruction = `You are a bill reader for Indian retail stores. READ the bill image into structured JSON. Do NOT try to match products to any catalog. Return ONLY valid JSON, no markdown.

Handle Indian formats: "Rs.", "₹", Devanagari numerals, Dr/Cr columns, "only" suffix, partial dates.

For each line item:
- product_name_raw: the text exactly as written on the bill.
- normalized_name: a clean English product name (expand common Hindi: chawal->rice, cheeni->sugar, atta->wheat flour, doodh->milk). No size, no numbers.
- size_token: any pack size on the line ("1kg","500ml","200ml") or null.
- number_tokens: EVERY number near the line EXCEPT the pack-size number. The number inside size_token (e.g. the 600 in "600ml", the 1 in "1kg") is NOT a quantity and must NEVER appear in number_tokens. For each remaining number: value, guessed_role ("quantity" | "price" | "total" | "unknown"), has_currency_marker (true if a Rs/rupee symbol touches it), has_multiply_marker (true if an x/@ touches it), confidence ("high"|"medium"|"low").
  Do not guess a role you are unsure of - use "unknown".

If the image is a ledger/account page with multiple bills, set document_type "ledger_page" and put each bill's lines in items as well (flatten).

${correctionLines ? `Store read corrections:\n${correctionLines}\n` : ''}

Return this JSON:
{
  "document_type": "single_bill" | "ledger_page",
  "vendor_name": string | null,
  "date": "YYYY-MM-DD" | null,
  "total_amount": number | null,
  "confidence": "high" | "medium" | "low",
  "items": [
    {
      "product_name_raw": string,
      "normalized_name": string,
      "size_token": string | null,
      "number_tokens": [
        { "value": number, "guessed_role": "quantity"|"price"|"total"|"unknown",
          "has_currency_marker": boolean, "has_multiply_marker": boolean,
          "confidence": "high"|"medium"|"low" }
      ]
    }
  ]
}`

  const genAI = getGeminiClient()
  const response = await genAI.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: 'Read all data from this bill image.' },
      ],
    }],
    config: { systemInstruction, maxOutputTokens: 4096, responseMimeType: 'application/json' },
  })

  let text = (response.text ?? '').trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  const raw = JSON.parse(text)

  const rawItems: RawExtractedItem[] = (raw.items ?? raw.transactions ?? []).map((it: Record<string, unknown>) => ({
    productNameRaw: String(it.product_name_raw ?? ''),
    normalizedName: String(it.normalized_name ?? it.product_name_raw ?? ''),
    sizeToken: (it.size_token as string) ?? null,
    numberTokens: ((it.number_tokens as Record<string, unknown>[]) ?? []).map((n): NumberToken => ({
      value: Number(n.value) || 0,
      guessedRole: (n.guessed_role as NumberToken['guessedRole']) ?? 'unknown',
      hasCurrencyMarker: Boolean(n.has_currency_marker),
      hasMultiplyMarker: Boolean(n.has_multiply_marker),
      confidence: (n.confidence as ConfidenceLevel) ?? 'low',
    })),
  }))

  return {
    documentType: raw.document_type ?? 'single_bill',
    vendorName: raw.vendor_name ?? undefined,
    date: raw.date ?? undefined,
    totalAmount: raw.total_amount ?? undefined,
    confidence: raw.confidence ?? 'low',
    rawItems,
  }
}
