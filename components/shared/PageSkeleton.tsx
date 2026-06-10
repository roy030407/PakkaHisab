/**
 * FILE: components/shared/PageSkeleton.tsx
 *
 * WHAT THIS DOES:
 *   Skeleton loading layouts for the three main page shapes in the app:
 *   - DashboardSkeleton: stat cards + list rows (used on /dashboard)
 *   - ListPageSkeleton: header + N list-card rows (used on /inventory, /customers, /products)
 *   - ReportSkeleton: chart placeholder + summary rows (used on /reports)
 *   Uses shadcn Skeleton component. Drop-in replacements for <LoadingState />.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Replace any page's loading state with the matching skeleton variant.
 *
 * CALLED BY / IMPORTS FROM:
 *   Any dashboard page that has an async loading state
 */
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div className="px-4 py-5 space-y-5 animate-in fade-in duration-300">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      {/* Section heading */}
      <Skeleton className="h-4 w-32" />
      {/* List rows */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="px-4 py-5 space-y-4 animate-in fade-in duration-300">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-lg" />
      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReportSkeleton() {
  return (
    <div className="px-4 py-5 space-y-5 animate-in fade-in duration-300">
      {/* Period toggle */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-9 flex-1 rounded-full" />)}
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
      {/* Top products */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
