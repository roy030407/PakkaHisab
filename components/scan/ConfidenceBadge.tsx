/**
 * FILE: components/scan/ConfidenceBadge.tsx
 *
 * WHAT THIS DOES:
 *   Inline amber/red/green badge for extraction confidence on individual fields.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Used inside ExtractionReview rows for low/medium confidence fields.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/scan/ExtractionReview.tsx
 */
import type { ConfidenceLevel } from '@/types'

interface Props { level: ConfidenceLevel }

export function ConfidenceBadge({ level }: Props) {
  if (level === 'high') return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded ${
      level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
    }`}>
      ⚠ check
    </span>
  )
}
