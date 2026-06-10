/**
 * FILE: lib/parsers/amounts.ts
 *
 * WHAT THIS DOES:
 *   Normalizes Indian amount formats to plain numbers.
 *   Handles ₹, Rs., commas (1,23,456), "only" suffix, L/Lakh/K suffixes.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 6 import parsing
 *
 * WHERE IT FITS:
 *   Used by excel.ts and csv.ts when parsing price/amount columns.
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/parsers/excel.ts, lib/parsers/csv.ts
 */

export function parseIndianAmount(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0
  if (typeof raw === "number") return isFinite(raw) ? raw : 0

  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/₹|rs\.?|inr/gi, "")
    .replace(/\s+/g, "")
    .replace(/ only$/i, "")
    .replace(/,/g, "")

  if (s.endsWith("l") || s.endsWith("lakh")) {
    return parseFloat(s) * 100000
  }
  if (s.endsWith("k")) {
    return parseFloat(s) * 1000
  }

  const n = parseFloat(s)
  return isFinite(n) ? n : 0
}

export function parseIndianDate(raw: unknown): string | null {
  if (!raw) return null
  const s = String(raw).trim()

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // Excel serial date
  if (/^\d{5}$/.test(s)) {
    const serial = parseInt(s)
    const date = new Date((serial - 25569) * 86400 * 1000)
    return date.toISOString().split("T")[0]
  }

  return null
}
