/**
 * FILE: lib/anthropic/extraction.ts
 *
 * WHAT THIS DOES:
 *   Calls Gemini 2.0 Flash (Vision) to extract structured bill data.
 *   Builds prompt with store's top-20 frequent products and last-5 corrections
 *   as few-shot context. Returns ExtractionResult JSON.
 *
 * CHANGES THIS SESSION:
 *   - Switched from Anthropic Claude Vision to Gemini 2.0 Flash Vision (free tier)
 *
 * WHERE IT FITS:
 *   Called by POST /api/scan after the bill image has been uploaded to Storage.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/scan/route.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractionResult } from '@/types'
import { getGeminiClient } from './client'

interface TopProduct {
  id: string
  name: string
  unit: string
}

interface Correction {
  field_name: string
  original_value: string
  corrected_value: string
}

export async function extractBillData(
  supabase: SupabaseClient,
  storeId: string,
  imageBase64: string,
  mimeType: string
): Promise<ExtractionResult> {
  // Fetch top-20 products by frequency (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentItems } = await supabase
    .from('transaction_items')
    .select('product_id')
    .eq('store_id', storeId)
    .gte('created_at', sevenDaysAgo)

  const productFreq: Record<string, number> = {}
  for (const item of recentItems ?? []) {
    productFreq[item.product_id] = (productFreq[item.product_id] ?? 0) + 1
  }

  const topIds = Object.entries(productFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id)

  let topProducts: TopProduct[] = []
  if (topIds.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('id, name, unit')
      .in('id', topIds)
      .eq('store_id', storeId)
    topProducts = data ?? []
  }

  // Fetch last-5 extraction corrections for this store
  const { data: corrections } = await supabase
    .from('extraction_corrections')
    .select('field_name, original_value, corrected_value')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(5)

  const correctionLines = (corrections as Correction[] ?? [])
    .map(c => `In a previous scan for this store, '${c.original_value}' was corrected to '${c.corrected_value}' (field: ${c.field_name}).`)
    .join('\n')

  const productContext = topProducts.length > 0
    ? `Store catalog (top products by frequency):\n${topProducts.map(p => `- id: ${p.id} | name: ${p.name} | unit: ${p.unit}`).join('\n')}`
    : 'No catalog products available yet.'

  const systemInstruction = `You are a bill data extraction assistant for Indian retail stores. Extract structured data from bill images.

Return ONLY valid JSON. No preamble, no markdown, no explanation.

Handle Indian formats: "Rs.", "₹", Devanagari numerals, Dr/Cr columns, "only" suffix, partial dates.

If the image is a single bill/invoice, return document_type: "single_bill".
If the image is a ledger/account page with multiple entries, return document_type: "ledger_page" — in that case, replace "items" with "transactions" array where each element has the same structure as a single bill.

${correctionLines ? `Store-specific corrections learned from past scans:\n${correctionLines}\n` : ''}
${productContext}

Return this JSON schema:
{
  "document_type": "single_bill" | "ledger_page",
  "vendor_name": string | null,
  "date": "YYYY-MM-DD" | null,
  "total_amount": number | null,
  "confidence": "high" | "medium" | "low",
  "items": [
    {
      "product_name_raw": string,
      "matched_product_id": string | null,
      "matched_product_name": string | null,
      "needs_catalog_add": boolean,
      "quantity": number,
      "unit_price": number,
      "total_price": number,
      "tax_rate": number | null,
      "field_confidence": {
        "quantity": "high" | "medium" | "low",
        "unit_price": "high" | "medium" | "low",
        "total_price": "high" | "medium" | "low"
      }
    }
  ]
}`

  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction,
    generationConfig: { maxOutputTokens: 4096 },
  })

  const response = await model.generateContent([
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType as string,
      },
    },
    'Extract all data from this bill image.',
  ])

  // Strip markdown code fences if Gemini wraps the JSON
  let text = response.response.text().trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }

  const raw = JSON.parse(text)

  // Normalise to camelCase ExtractionResult
  return {
    documentType: raw.document_type,
    vendorName: raw.vendor_name ?? undefined,
    date: raw.date ?? undefined,
    totalAmount: raw.total_amount ?? undefined,
    confidence: raw.confidence,
    items: (raw.items ?? raw.transactions ?? []).map((item: Record<string, unknown>) => ({
      productNameRaw: item.product_name_raw as string,
      matchedProductId: (item.matched_product_id as string) ?? undefined,
      matchedProductName: (item.matched_product_name as string) ?? undefined,
      needsCatalogAdd: Boolean(item.needs_catalog_add),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      totalPrice: Number(item.total_price),
      taxRate: item.tax_rate != null ? Number(item.tax_rate) : undefined,
      fieldConfidence: {
        quantity: (item.field_confidence as Record<string, string>)?.quantity ?? 'low',
        unitPrice: (item.field_confidence as Record<string, string>)?.unit_price ?? 'low',
        totalPrice: (item.field_confidence as Record<string, string>)?.total_price ?? 'low',
      },
    })),
  } as ExtractionResult
}
