/**
 * FILE: components/ai/TipBanner.tsx
 *
 * WHAT THIS DOES:
 *   Fetches today's cached AI insight and renders it as a banner at the top
 *   of the advisor page. Uses the same /api/ai/insight endpoint (cached per
 *   day, no extra AI call). Includes an "Ask about this" button that sends
 *   the tip into the chat.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Rendered at the top of app/(dashboard)/advisor/page.tsx, above ChatInterface.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/advisor/page.tsx
 */
'use client'

import { useEffect, useState } from 'react'

interface Props {
  onAskAboutTip?: (tip: string) => void
}

export function TipBanner({ onAskAboutTip }: Props) {
  const [tip, setTip] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai/insight')
      .then(r => r.json())
      .then(d => { if (d.insight) setTip(d.insight) })
      .catch(() => {})
  }, [])

  if (!tip) return null

  return (
    <div className="border-b border-gray-100 bg-emerald-50/60 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 mb-1">
        <span aria-hidden>✨</span> Aaj ki salah
      </p>
      <p className="text-sm leading-relaxed text-gray-800">{tip}</p>
      {onAskAboutTip && (
        <button
          type="button"
          onClick={() => onAskAboutTip(tip)}
          className="btn-lift mt-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 cursor-pointer"
        >
          Ask about this tip
        </button>
      )}
    </div>
  )
}
