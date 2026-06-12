/**
 * FILE: components/shared/Sparkline.tsx
 *
 * WHAT THIS DOES:
 *   Tiny 7-bar flex chart for showing a week of values inside cards.
 *   Pure CSS bars — no chart library. Server-component friendly.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *
 * WHERE IT FITS:
 *   Dashboard hero profit card; reusable in report cards.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */

interface Props {
  values: number[]
  labels?: string[]
}

export function Sparkline({ values, labels }: Props) {
  const max = Math.max(...values.map(Math.abs), 1)

  return (
    <div>
      <div className="flex items-end gap-1.5 h-9">
        {values.map((v, i) => {
          const heightPct = Math.max((Math.abs(v) / max) * 100, 8)
          const isLast = i === values.length - 1
          const color =
            v < 0 ? "bg-red-200" : isLast ? "bg-emerald-500" : "bg-emerald-200"
          return (
            <div
              key={i}
              className={`flex-1 rounded-[3px] ${color}`}
              style={{ height: `${heightPct}%` }}
            />
          )
        })}
      </div>
      {labels && (
        <div className="flex justify-between mt-1">
          {labels.map((l, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[9px] font-semibold ${
                i === labels.length - 1 ? "text-emerald-700" : "text-emerald-400"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
