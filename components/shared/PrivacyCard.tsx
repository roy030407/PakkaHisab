/**
 * FILE: components/shared/PrivacyCard.tsx
 *
 * WHAT THIS DOES:
 *   Small, dismissible reassurance card on the dashboard: tells the merchant
 *   their data is private and links to the /privacy page. Dismissal is
 *   remembered in localStorage so it does not nag on every visit.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Model A: honest cloud-privacy messaging)
 *
 * WHERE IT FITS:
 *   Rendered on the dashboard home (right rail on desktop, inline on mobile).
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, X } from "lucide-react"

const STORAGE_KEY = "pakkahisab.privacyCardDismissed"

export function PrivacyCard() {
  // Start hidden; reveal after mount so SSR and first client render match.
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setShow(true)
    } catch {
      setShow(true) // storage unavailable - just show it
    }
  }, [])

  function dismiss() {
    setShow(false)
    try {
      localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  if (!show) return null

  return (
    <div className="relative rounded-2xl border border-gray-100 border-l-[3px] border-l-emerald-500 bg-white p-4 shadow-sm">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="btn-lift absolute right-2 top-2 text-gray-300 hover:text-gray-500"
      >
        <X size={15} />
      </button>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        <ShieldCheck size={13} /> Private to you
      </p>
      <p className="mt-1 pr-4 text-sm leading-relaxed text-gray-800">
        We never sell your data.
      </p>
      <Link
        href="/privacy"
        className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800"
      >
        How we handle your data →
      </Link>
    </div>
  )
}
