/**
 * FILE: components/dashboard/DashboardQuickSale.tsx
 *
 * WHAT THIS DOES:
 *   Mini quick-sale widget: sticky bar with item count, total, and a "Save sale"
 *   button that calls POST /api/entry/quick. Followed by a PaymentToggle after save.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Removed FrequentItems chip strip (no longer shown on dashboard)
 *   - Default payment changed from cash to upi
 *
 * WHERE IT FITS:
 *   Available for future use; currently not mounted on the dashboard page.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */
'use client'

// DashboardQuickSale is kept for future use but not currently rendered.
export function DashboardQuickSale() {
  return null
}
