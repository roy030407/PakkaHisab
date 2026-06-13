/**
 * FILE: app/api/import/map/route.ts
 *
 * WHAT THIS DOES:
 *   POST: sends file headers and a sample row to Gemini, which returns
 *   a suggested column mapping (user column → our schema field).
 *   Merchant reviews and confirms the mapping before import.
 *
 * CHANGES THIS SESSION:
 *   - Switched from Anthropic to Gemini 2.0 Flash (free tier)
 *
 * WHERE IT FITS:
 *   Step 2 of the import wizard. Called after /api/import/upload.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/settings/page.tsx (import section)
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from "@/lib/anthropic/client"

const PRODUCT_FIELDS = [
  "name", "brand", "category", "subcategory", "unit",
  "purchase_price", "selling_price", "tax_rate", "shelf_life_days",
]
const CUSTOMER_FIELDS = ["name", "phone", "type", "credit_limit", "notes"]
const TRANSACTION_FIELDS = ["date", "type", "total_amount", "payment_method", "vendor_name", "notes"]
const INVENTORY_FIELDS = ["product_name", "current_stock", "reorder_point", "expiry_date"]

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { headers: string[]; sampleRow: Record<string, string> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { headers, sampleRow } = body
  if (!headers?.length) {
    return NextResponse.json({ error: "No headers provided" }, { status: 400 })
  }

  const prompt = `You are helping import data into an Indian retail business app called PakkaHisab.

Given these CSV/Excel column headers and a sample row, determine:
1. What type of data this file contains: "products", "customers", "transactions", or "inventory"
2. Map each column to the closest matching field from the target schema

Target schemas:
- products: ${PRODUCT_FIELDS.join(", ")}
- customers: ${CUSTOMER_FIELDS.join(", ")}
- transactions: ${TRANSACTION_FIELDS.join(", ")}
- inventory: ${INVENTORY_FIELDS.join(", ")}

Column headers: ${JSON.stringify(headers)}
Sample row: ${JSON.stringify(sampleRow)}

Return ONLY valid JSON in this exact format (no explanation):
{
  "dataType": "products" | "customers" | "transactions" | "inventory",
  "mapping": {
    "<original column name>": "<target field name or null if unmappable>"
  }
}`

  const genAI = getGeminiClient()
  const result = await genAI.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      maxOutputTokens: 512,
      responseMimeType: "application/json",
    },
  })
  let text = (result.text ?? "").trim()

  // Strip markdown fences as a safety net
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim()
  }

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json(
      { error: "Could not determine column mapping. Please map manually." },
      { status: 422 }
    )
  }
}
