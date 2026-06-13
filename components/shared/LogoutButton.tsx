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

  if (variant === 'nav') {
    return (
      <button
        onClick={handleLogout}
        disabled={busy}
        className="btn-lift flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
      >
        <LogOut size={18} strokeWidth={1.7} />
        {busy ? 'Logging out...' : 'Logout'}
      </button>
    )
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      className="btn-lift inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      <LogOut size={16} />
      {busy ? 'Logging out...' : 'Logout'}
    </button>
  )
}
