/**
 * FILE: eval/lib/text.ts
 *
 * WHAT THIS DOES:
 *   Pure text helpers for scoring: name normalization for item alignment,
 *   alias-aware name matching, and word error rate (WER).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (audit Session C eval harness)
 *
 * WHERE IT FITS:
 *   Used by eval/lib/tasks/scan.ts and eval/lib/tasks/voice.ts.
 *
 * CALLED BY / IMPORTS FROM:
 *   eval/lib/tasks/* ; no imports
 */

const SIZE_RE = /\b\d+(?:\.\d+)?\s?(?:kg|g|gm|gms|gram|grams|ml|l|ltr|litre|liter|pc|pcs)\b/gi
const STOP = new Set(['and', 'aur', 'the', 'of', 'pack', 'packet', 'pkt', 'small', 'big', 'bada', 'chota'])

// Lowercase, ASCII-fold common brand marks, drop sizes/punctuation/stopwords.
export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(SIZE_RE, ' ')
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP.has(w))
    .join(' ')
}

// 2 = exact after normalization, 1 = one side's tokens all contained in the other, 0 = no match.
export function nameScore(pred: string, aliases: string[]): number {
  const p = normName(pred)
  if (!p) return 0
  const pt = new Set(p.split(' '))
  let best = 0
  for (const a of aliases) {
    const n = normName(a)
    if (!n) continue
    if (n === p) return 2
    const at = n.split(' ')
    const aInP = at.every(w => pt.has(w))
    const pInA = Array.from(pt).every(w => at.includes(w))
    if (aInP || pInA) best = Math.max(best, 1)
  }
  return best
}

export function normTranscript(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

// Word-level Levenshtein distance / reference length.
export function wordErrorRate(reference: string, hypothesis: string): { wer: number; edits: number; refWords: number } {
  const r = normTranscript(reference)
  const h = normTranscript(hypothesis)
  if (r.length === 0) return { wer: h.length === 0 ? 0 : 1, edits: h.length, refWords: 0 }
  const prev = new Array<number>(h.length + 1)
  const cur = new Array<number>(h.length + 1)
  for (let j = 0; j <= h.length; j++) prev[j] = j
  for (let i = 1; i <= r.length; i++) {
    cur[0] = i
    for (let j = 1; j <= h.length; j++) {
      const sub = prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)
      cur[j] = Math.min(sub, prev[j] + 1, cur[j - 1] + 1)
    }
    for (let j = 0; j <= h.length; j++) prev[j] = cur[j]
  }
  const edits = prev[h.length]
  return { wer: edits / r.length, edits, refWords: r.length }
}

export function hasDevanagari(s: string): boolean {
  return /[ऀ-ॿ]/.test(s)
}

export function round(n: number, dp = 3): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export function ratio(num: number, den: number): number | null {
  return den === 0 ? null : round(num / den)
}
