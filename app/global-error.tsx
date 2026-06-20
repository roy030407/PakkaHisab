/**
 * FILE: app/global-error.tsx
 *
 * WHAT THIS DOES:
 *   Global error boundary for the entire app. Catches unhandled errors
 *   in the root layout and shows a friendly recovery page.
 *   Must include its own <html> and <body> tags.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for production readiness
 *
 * WHERE IT FITS:
 *   Auto-rendered by Next.js when an unhandled error occurs at the root level.
 *
 * CALLED BY / IMPORTS FROM:
 *   Next.js App Router (auto-applied)
 */

"use client"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-5 text-center font-sans">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-3xl font-extrabold text-white">
          ₹
        </span>
        <h1 className="mt-6 text-2xl font-extrabold text-stone-900">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-sm text-sm text-stone-500">
          An unexpected error occurred. Your data is safe. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="mt-6 inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer"
        >
          Try again
        </button>
      </body>
    </html>
  )
}
