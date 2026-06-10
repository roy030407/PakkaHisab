/**
 * FILE: components/scan/DuplicateWarning.tsx
 *
 * WHAT THIS DOES:
 *   Orange warning banner shown when the scan API detects a possible duplicate
 *   transaction (same vendor + amount within 24 hours).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Rendered above the item list in ExtractionReview when duplicateWarning is set.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/scan/ExtractionReview.tsx
 */
interface Props {
  date: string
  onDismiss: () => void
}

export function DuplicateWarning({ date, onDismiss }: Props) {
  const formatted = new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <div className="mx-4 mt-2 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-orange-800">Possible duplicate</p>
        <p className="text-xs text-orange-700 mt-0.5">
          A similar bill was already added on {formatted}. Add again?
        </p>
      </div>
      <button onClick={onDismiss} className="text-orange-400 text-lg leading-none flex-shrink-0">✕</button>
    </div>
  )
}
