/**
 * FILE: components/ai/InsightCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows today's AI-generated business insight on the dashboard.
 *   Fetches from /api/ai/insight on mount. "Ask more" navigates to /advisor.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *
 * WHERE IT FITS:
 *   Rendered at the top of the dashboard page below the header.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export function InsightCard() {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ai/insight")
      .then((r) => r.json())
      .then((d) => {
        if (d.insight) setInsight(d.insight)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 animate-pulse">
        <div className="h-3 w-24 rounded bg-violet-200 mb-2" />
        <div className="h-4 w-full rounded bg-violet-100 mb-1" />
        <div className="h-4 w-3/4 rounded bg-violet-100" />
      </div>
    )
  }

  if (!insight) return null

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-1">
        Today&apos;s insight
      </p>
      <p className="text-sm text-gray-800 leading-relaxed">{insight}</p>
      <Link
        href="/advisor"
        className="mt-3 inline-block text-xs font-medium text-violet-700 underline underline-offset-2"
      >
        Ask your advisor
      </Link>
    </div>
  )
}
