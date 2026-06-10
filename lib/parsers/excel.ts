/**
 * FILE: lib/parsers/excel.ts
 *
 * WHAT THIS DOES:
 *   Parses an Excel (.xlsx / .xls) Buffer into an array of row objects
 *   keyed by header names from the first row of the first sheet.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 import parsing
 *
 * WHERE IT FITS:
 *   Called by /api/import/upload when the uploaded file is .xlsx or .xls.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/import/upload/route.ts
 */

import * as XLSX from "xlsx"
import type { ParseResult } from "./csv"

export function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  })

  if (rawRows.length === 0) return { headers: [], rows: [] }

  const headers = Object.keys(rawRows[0])
  const rows = rawRows.map((r) => {
    const row: Record<string, string> = {}
    for (const h of headers) {
      row[h] = String(r[h] ?? "").trim()
    }
    return row
  })

  return { headers, rows }
}
