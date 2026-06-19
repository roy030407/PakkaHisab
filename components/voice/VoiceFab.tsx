/**
 * FILE: components/voice/VoiceFab.tsx
 *
 * WHAT THIS DOES:
 *   Mobile-only floating mic button that links to /voice from any dashboard
 *   screen, so the merchant can start a hands-free sale in one tap. Hidden on
 *   desktop (the Sidebar has a Voice item) and hidden on /voice itself.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 1)
 *
 * WHERE IT FITS:
 *   Mounted in app/(dashboard)/layout.tsx, sits above the BottomNav on mobile.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Mic } from 'lucide-react'

export function VoiceFab() {
  const pathname = usePathname()
  if (pathname.startsWith('/voice')) return null

  return (
    <Link
      href="/voice"
      aria-label="Speak to sell"
      className="btn-lift md:hidden fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-300/50 cursor-pointer"
    >
      <Mic size={24} />
    </Link>
  )
}
