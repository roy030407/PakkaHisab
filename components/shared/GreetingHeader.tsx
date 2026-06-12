/**
 * FILE: components/shared/GreetingHeader.tsx
 *
 * WHAT THIS DOES:
 *   Dashboard header: time-of-day greeting + owner first name, store and
 *   date context line, and the brand ₹ avatar that links to /settings.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation for Khata Green redesign
 *   - Fix: handle Intl hour "24" at midnight
 *
 * WHERE IT FITS:
 *   Top of the dashboard page. Server component (time = server render time).
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/dashboard/page.tsx
 */

import Link from "next/link"

interface Props {
  ownerName: string
  storeName: string
}

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  )
  const adjusted = hour === 24 ? 0 : hour
  if (adjusted < 12) return "Good morning"
  if (adjusted < 17) return "Good afternoon"
  return "Good evening"
}

export function GreetingHeader({ ownerName, storeName }: Props) {
  const firstName = ownerName.trim().split(/\s+/)[0] || "ji"
  const dateLine = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date())

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
          {greeting()}, {firstName} 👋
        </h1>
        <p className="mt-0.5 text-xs text-gray-400">
          {storeName} · {dateLine}
        </p>
      </div>
      <Link
        href="/settings"
        aria-label="Settings"
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-base font-extrabold text-white shadow-md shadow-emerald-200 transition-transform hover:scale-105"
      >
        ₹
      </Link>
    </div>
  )
}
