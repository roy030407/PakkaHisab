/**
 * FILE: components/inventory/ExpiryAlert.tsx
 *
 * WHAT THIS DOES:
 *   Yellow banner listing all products whose expiry date is within 7 days.
 *   Shows product name, units remaining, and days until expiry.
 *   Hidden when no expiring items exist.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green restyle
 *
 * WHERE IT FITS:
 *   Top of the inventory page, above the stock list.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx
 */
import type { StockItemWithConsumption } from '@/types'

interface Props {
  items: StockItemWithConsumption[]
}

export function ExpiryAlert({ items }: Props) {
  const expiring = items.filter(item => {
    if (!item.expiryDate || item.currentStock <= 0) return false
    const daysUntil = Math.ceil(
      (new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysUntil <= 7
  })

  if (expiring.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-800">
        {expiring.length} item{expiring.length === 1 ? '' : 's'} expiring soon
      </p>
      {expiring.map(item => {
        const daysUntil = Math.ceil(
          (new Date(item.expiryDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return (
          <div key={item.productId} className="flex items-center justify-between text-sm">
            <span className="text-amber-900">
              {item.productName} - {item.currentStock} {item.unit}{item.currentStock === 1 ? '' : 's'}
            </span>
            <span className="text-amber-700 font-medium shrink-0 ml-2">
              {daysUntil <= 0 ? 'Expired' : `${daysUntil}d left`}
            </span>
          </div>
        )
      })}
      <p className="text-xs text-amber-700 pt-1">Consider a discount or priority sale.</p>
    </div>
  )
}
