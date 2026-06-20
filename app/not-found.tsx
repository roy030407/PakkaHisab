/**
 * FILE: app/not-found.tsx
 *
 * WHAT THIS DOES:
 *   Custom 404 page shown when a route is not found.
 *   Friendly, on-brand design instead of the default Next.js 404.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Auto-rendered by Next.js when no route matches.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router (auto-applied)
 */

import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-3xl font-extrabold text-white">
        ₹
      </span>
      <h1 className="mt-6 text-2xl font-extrabold text-stone-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="btn-lift mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Go home
      </Link>
    </div>
  )
}
