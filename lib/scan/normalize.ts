/**
 * FILE: lib/scan/normalize.ts
 *
 * WHAT THIS DOES:
 *   Pure text helpers for bill matching: normalize names, find and strip a
 *   size token (1kg, 200ml, ...), and compute a size-stripped base name.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for smart bill matching
 *
 * WHERE IT FITS:
 *   Used by lib/scan/match.ts and lib/scan/resolve.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   lib/scan/match.ts, lib/scan/resolve.ts
 */
const SIZE_RE = /(\d+(?:\.\d+)?)\s?(kg|g|gm|gms|ml|l|ltr|litre|liter|pc|pcs|piece|dozen|box)\b/i

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSizeToken(name: string): string | null {
  const m = name.match(SIZE_RE)
  if (!m) return null
  return `${m[1]}${m[2].toLowerCase()}`.replace(/\s+/g, '')
}

export function stripSize(name: string): string {
  return name.replace(SIZE_RE, '').replace(/\s+/g, ' ').trim()
}

export function baseName(name: string): string {
  return normalizeText(stripSize(name))
}

// The numeric part of a size token: "600ml" -> 600, "1.5l" -> 1.5, null -> null.
// Used to stop a pack-size number being mistaken for a quantity.
export function sizeNumber(sizeToken: string | null): number | null {
  if (!sizeToken) return null
  const m = sizeToken.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : null
}
