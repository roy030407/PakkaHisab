/**
 * FILE: lib/parsers/csv.ts
 *
 * WHAT THIS DOES:
 *   Parses a CSV string into an array of row objects keyed by header names.
 *   Handles quoted fields, commas inside quotes, and BOM prefix.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 import parsing
 *
 * WHERE IT FITS:
 *   Called by /api/import/upload when the uploaded file is .csv.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/import/upload/route.ts
 */

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSV(text: string): ParseResult {
  // Remove BOM
  const cleaned = text.replace(/^﻿/, "")
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim())

  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = splitCSVLine(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    if (values.every((v) => !v.trim())) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim()
    })
    rows.push(row)
  }

  return { headers, rows }
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
