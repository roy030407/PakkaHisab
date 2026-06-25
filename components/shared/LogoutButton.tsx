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
 *   - Confirm modal now uses the native <dialog> top layer (showModal). The
 *     top layer always paints above page content, so it no longer mis-layered
 *     behind dashboard cards on the Home page (z-index / stacking could not
 *     win there). Backdrop click and Esc close it; both are blocked while busy.
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

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { track, resetAnalytics } from '@/lib/analytics/posthog'

interface Props {
  variant?: 'nav' | 'button'
}

export function LogoutButton({ variant = 'button' }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  function openConfirm() {
    dialogRef.current?.showModal()
  }

  function closeConfirm() {
    if (busy) return
    dialogRef.current?.close()
  }

  async function handleLogout() {
    if (busy) return
    setBusy(true)
    track('logout')
    try {
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      resetAnalytics()
    } finally {
      // Always return home, even if sign-out hiccups, so the merchant is never stuck.
      router.replace('/')
      router.refresh()
    }
  }

  const trigger =
    variant === 'nav' ? (
      <button
        onClick={openConfirm}
        className="btn-lift flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut size={18} strokeWidth={1.7} />
        Logout
      </button>
    ) : (
      <button
        onClick={openConfirm}
        className="btn-lift inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        <LogOut size={16} />
        Logout
      </button>
    )

  return (
    <>
      {trigger}

      <dialog
        ref={dialogRef}
        // A click whose coordinates fall outside the dialog box is a backdrop click.
        onClick={(e) => {
          const rect = dialogRef.current?.getBoundingClientRect()
          if (!rect) return
          const inside =
            e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom
          if (!inside) closeConfirm()
        }}
        // Esc fires "cancel"; block it while signing out.
        onCancel={(e) => {
          if (busy) e.preventDefault()
        }}
        className="m-auto w-full max-w-xs rounded-2xl border-0 bg-white p-5 shadow-xl backdrop:bg-black/40"
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
            onClick={closeConfirm}
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
      </dialog>
    </>
  )
}
