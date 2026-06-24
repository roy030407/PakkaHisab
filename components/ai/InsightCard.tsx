/**
 * FILE: components/ai/InsightCard.tsx
 *
 * WHAT THIS DOES:
 *   Shows today's AI-generated business insight on the dashboard.
 *   Fetches from /api/ai/insight on mount. "Ask more" navigates to /advisor.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Phase 5 AI Advisor
 *   - Khata Green restyle: emerald left-border card, Aaj ki salah header
 *   - "Tell me more" passes the insight text to /advisor via query param
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
      <div className="rounded-2xl border border-gray-100 border-l-[3px] border-l-emerald-500 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-3 w-32 rounded bg-emerald-100 mb-2" />
        <div className="h-4 w-full rounded bg-gray-100 mb-1" />
        <div className="h-4 w-3/4 rounded bg-gray-100" />
      </div>
    )
  }

  if (!insight) return null

  return (
    <div className="rounded-2xl border border-gray-100 border-l-[3px] border-l-emerald-500 bg-white p-4 shadow-sm">
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        <span aria-hidden>✨</span> Aaj ki salah · Today&apos;s tip
      </p>
      <p className="text-sm leading-relaxed text-gray-800">{insight}</p>
      <Link
        href={`/advisor?tip=${encodeURIComponent(insight)}`}
        className="mt-3 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800"
      >
        Tell me more →
      </Link>
    </div>
  )
}
