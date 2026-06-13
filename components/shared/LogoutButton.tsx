/**
 * FILE: components/shared/LogoutButton.tsx
 *
 * WHAT THIS DOES:
 *   Signs the merchant out of Supabase and sends them back to the landing
 *   page. Rendered in two styles via the `variant` prop: a quiet sidebar row
 *   ("nav") and a standalone bordered button ("button") for the settings page.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (logout + return-to-home support)
 *   - Added an in-app confirmation modal before signing out
 *
 * WHERE IT FITS:
 *   Mounted in the desktop Sidebar (bottom) and on the Settings page so logout
 *   is reachable on both desktop and mobile (Settings opens from the dashboard
 *   greeting avatar on mobile).
 *
 * CALLED BY / IMPORTS FROM:
 *   components/shared/Sidebar.tsx, app/(dashboard)/settings/page.tsx
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

interface Props {
  variant?: 'nav' | 'button'
}

export function LogoutButton({ variant = 'button' }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleLogout() {
    if (busy) return
    setBusy(true)
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
    } finally {
      // Always return home, even if sign-out hiccups, so the merchant is never stuck.
      router.replace('/')
      router.refresh()
    }
  }

  const trigger =
    variant === 'nav' ? (
      <button
        onClick={() => setConfirming(true)}
        className="btn-lift flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut size={18} strokeWidth={1.7} />
        Logout
      </button>
    ) : (
      <button
        onClick={() => setConfirming(true)}
        className="btn-lift inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <LogOut size={16} />
        Logout
      </button>
    )

  return (
    <>
      {trigger}

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <LogOut size={18} className="text-red-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Logout of PakkaHisab?</h2>
            <p className="mt-1 text-sm text-gray-500">
              Aapko dobara login karna padega. Aapka data safe rahega.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="btn-lift flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={busy}
                className="btn-lift flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? 'Logging out...' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
