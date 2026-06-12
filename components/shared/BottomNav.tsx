/**
 * FILE: components/shared/BottomNav.tsx
 *
 * WHAT THIS DOES:
 *   Fixed bottom navigation bar for mobile (<768px). 5 primary tabs with
 *   Lucide icons and active-state pill indicator. Hidden on desktop (Sidebar
 *   takes over). Uses usePathname to highlight the current route.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Redesign: emoji → Lucide icons, active pill indicator, better active state
 *   - Khata Green: center elevated Scan FAB, emerald active states, new tab order
 *
 * WHERE IT FITS:
 *   Mounted in app/(dashboard)/layout.tsx. Hidden md+.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, PenLine, Package, Users } from 'lucide-react'

const LEFT_TABS = [
  { href: '/dashboard', label: 'Home',  Icon: Home    },
  { href: '/entry',     label: 'Entry', Icon: PenLine },
]
const RIGHT_TABS = [
  { href: '/inventory', label: 'Stock',     Icon: Package },
  { href: '/customers', label: 'Customers', Icon: Users   },
]

function Tab({ href, label, Icon, active }: {
  href: string; label: string; Icon: typeof Home; active: boolean
}) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center gap-0.5 relative">
      {active && <span className="absolute top-1.5 w-5 h-0.5 rounded-full bg-emerald-600" />}
      <Icon size={20} strokeWidth={active ? 2.2 : 1.7}
        className={active ? 'text-emerald-700' : 'text-gray-400'} />
      <span className={`text-[10px] leading-none ${active ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}>
        {label}
      </span>
    </Link>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {LEFT_TABS.map((t) => <Tab key={t.href} {...t} active={isActive(t.href)} />)}

        {/* Center elevated Scan FAB */}
        <div className="relative flex justify-center">
          <Link href="/scan" aria-label="Scan a bill"
            className={`absolute -top-6 flex h-[52px] w-[52px] items-center justify-center rounded-full
              bg-gradient-to-br from-emerald-500 to-emerald-700 text-white
              ring-4 ring-white shadow-lg shadow-emerald-300/50
              transition-transform active:scale-95 ${
                isActive('/scan') ? 'from-emerald-600 to-emerald-800' : ''
              }`}>
            <Camera size={22} />
          </Link>
          <span className={`self-end mb-1.5 text-[10px] leading-none ${
            isActive('/scan') ? 'text-emerald-700 font-semibold' : 'text-gray-400'
          }`}>Scan</span>
        </div>

        {RIGHT_TABS.map((t) => <Tab key={t.href} {...t} active={isActive(t.href)} />)}
      </div>
    </nav>
  )
}
