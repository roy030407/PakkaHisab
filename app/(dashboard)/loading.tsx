/**
 * FILE: app/(dashboard)/loading.tsx
 *
 * WHAT THIS DOES:
 *   Loading skeleton shown while any dashboard page is being loaded.
 *   Prevents blank screens during navigation between dashboard routes.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Auto-rendered by Next.js while any page under (dashboard)/ is loading.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router (auto-applied)
 */

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        <p className="text-sm text-stone-500">Loading...</p>
      </div>
    </div>
  )
}
