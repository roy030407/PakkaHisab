/**
 * FILE: app/api/scan/correction/route.ts
 *
 * WHAT THIS DOES:
 *   POST: saves a merchant's correction to an extracted field.
 *   Stored in extraction_corrections and used as few-shot examples
 *   in future bill scans for this store (improving per-merchant accuracy).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 (6c — handwriting correction feedback loop)
 *
 * WHERE IT FITS:
 *   Called by the scan confirm screen when merchant edits an extracted value.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/scan/ExtractionReview.tsx (when a field is corrected)
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { randomUUID } from "crypto"

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  let body: {
    documentUploadId?: string
    fieldName: string
    originalValue: string
    correctedValue: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { documentUploadId, fieldName, originalValue, correctedValue } = body

  if (!fieldName || originalValue === undefined || correctedValue === undefined) {
    return NextResponse.json({ error: "fieldName, originalValue, correctedValue are required" }, { status: 400 })
  }

  // Don't save a correction if nothing actually changed
  if (originalValue === correctedValue) {
    return NextResponse.json({ saved: false })
  }

  const { error } = await supabase.from("extraction_corrections").insert({
    id: randomUUID(),
    store_id: store.id,
    document_upload_id: documentUploadId ?? null,
    field_name: fieldName,
    original_value: String(originalValue),
    corrected_value: String(correctedValue),
    created_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: "Failed to save correction" }, { status: 500 })
  }

  return NextResponse.json({ saved: true })
}
