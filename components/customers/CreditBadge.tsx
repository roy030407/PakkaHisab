/**
 * FILE: components/customers/CreditBadge.tsx
 *
 * WHAT THIS DOES:
 *   Balance badge — green when zero/credit, red when customer owes money.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Customer list cards and CustomerLedger header.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx, components/customers/CustomerLedger.tsx
 */
interface Props { balance: number }

export function CreditBadge({ balance }: Props) {
  const fmt = Math.abs(balance).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (balance <= 0) {
    return <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">&#8377;{fmt} credit</span>
  }
  return <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">&#8377;{fmt} owes</span>
}
