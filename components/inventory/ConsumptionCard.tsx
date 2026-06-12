/**
 * FILE: components/inventory/ConsumptionCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows consumption intelligence for a single product:
 *   "Ordered X units Y days ago. Z remaining. Rate: ~N/day. Runs out in ~D days."
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Rendered inside the inventory page for products that have consumption data.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
import type { ConsumptionData } from '@/types'

interface Props {
  productName: string
  unit: string
  currentStock: number
  consumption: ConsumptionData
}

export function ConsumptionCard({ productName, unit, currentStock, consumption }: Props) {
  const { orderedQty, daysSinceOrder, dailyRate, daysUntilStockout } = consumption

  const urgencyColor =
    daysUntilStockout <= 1 ? 'border-red-200 bg-red-50'
    : daysUntilStockout <= 3 ? 'border-amber-200 bg-amber-50'
    : 'border-slate-100 bg-slate-50'

  const stockoutText =
    daysUntilStockout === Infinity || dailyRate === 0
      ? 'Consumption not tracked yet.'
      : daysUntilStockout < 1
      ? 'Running out today. Order now.'
      : daysUntilStockout < 2
      ? 'Runs out tomorrow at this rate.'
      : `Runs out in ~${Math.floor(daysUntilStockout)} day${Math.floor(daysUntilStockout) === 1 ? '' : 's'}.`

  return (
    <div className={`rounded-xl border p-4 text-sm ${urgencyColor}`}>
      <p className="font-medium text-foreground mb-1">{productName}</p>
      <p className="text-muted-foreground">
        Ordered {orderedQty} {unit}{orderedQty === 1 ? '' : 's'} {daysSinceOrder} day{daysSinceOrder === 1 ? '' : 's'} ago.{' '}
        {currentStock} remaining.
      </p>
      {dailyRate > 0 && (
        <p className="text-muted-foreground">
          Consumption: ~{dailyRate}/{unit}/day.{' '}
          <span className={daysUntilStockout <= 3 ? 'text-red-700 font-medium' : 'text-foreground'}>
            {stockoutText}
          </span>
        </p>
      )}
    </div>
  )
}
