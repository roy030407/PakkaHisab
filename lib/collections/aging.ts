/**
 * FILE: lib/collections/aging.ts
 *
 * WHAT THIS DOES:
 *   Pure helper that turns two timestamps (oldest open credit sale, most recent
 *   payment) into a human "how old is this udhaar" pair of day counts. No DB,
 *   no threshold/overdue logic - we only show the age (per the Slice A spec).
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Used by the Customers "Udhaar due" tab to render the age line. The API
 *   (app/api/customers/route.ts) supplies oldestCreditAt and lastPaymentAt.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/customers/page.tsx
 */

type DateInput = string | Date | null | undefined

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysBetween(from: DateInput, now: Date): number | null {
  if (!from) return null
  const t = from instanceof Date ? from.getTime() : new Date(from).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / MS_PER_DAY))
}

export interface CustomerAge {
  /** Days since the oldest open credit sale. 0 when none recorded. */
  sinceDays: number
  /** Days since the most recent payment, or null if never paid. */
  lastPaidDays: number | null
}

export function customerAge(input: {
  oldestCreditAt: DateInput
  lastPaymentAt: DateInput
  now?: Date
}): CustomerAge {
  const now = input.now ?? new Date()
  return {
    sinceDays: daysBetween(input.oldestCreditAt, now) ?? 0,
    lastPaidDays: daysBetween(input.lastPaymentAt, now),
  }
}
