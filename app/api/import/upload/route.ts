/**
 * FILE: app/api/import/upload/route.ts
 *
 * WHAT THIS DOES:
 *   POST: accepts a multipart file upload (.csv, .xlsx, .xls),
 *   parses it, and returns the column headers + first 5 rows so
 *   the merchant can review before mapping.
 *   Max file size: 10MB. MIME validated server-side.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 data import
 *
 * WHERE IT FITS:
 *   Step 1 of the import wizard in settings page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/settings/page.tsx (import section)
 */

import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { parseCSV } from "@/lib/parsers/csv"
import { parseExcel } from "@/lib/parsers/excel"

const ALLOWED_MIME = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const mime = file.type || ""
  const isCSV = ext === "csv" || mime.includes("csv") || mime.includes("text/plain")
  const isExcel = ext === "xlsx" || ext === "xls" || mime.includes("excel") || mime.includes("spreadsheetml")

  if (!isCSV && !isExcel && !ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Only CSV and Excel files are accepted" },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  let headers: string[] = []
  let rows: Record<string, string>[] = []

  if (isCSV) {
    const text = buffer.toString("utf-8")
    const result = parseCSV(text)
    headers = result.headers
    rows = result.rows
  } else {
    const result = parseExcel(buffer)
    headers = result.headers
    rows = result.rows
  }

  if (headers.length === 0) {
    return NextResponse.json({ error: "Could not read columns from file" }, { status: 400 })
  }

  return NextResponse.json({
    headers,
    preview: rows.slice(0, 5),
    totalRows: rows.length,
    fileName: file.name,
  })
}
