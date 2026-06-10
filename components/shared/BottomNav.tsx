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

const TABS = [
  { href: '/dashboard', label: 'Home',      Icon: Home    },
  { href: '/scan',      label: 'Scan',      Icon: Camera  },
  { href: '/entry',     label: 'Entry',     Icon: PenLine },
  { href: '/inventory', label: 'Stock',     Icon: Package },
  { href: '/customers', label: 'Customers', Icon: Users   },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className="flex flex-col items-center justify-center gap-0.5 relative">
              {active && (
                <span className="absolute top-1.5 w-5 h-0.5 rounded-full bg-slate-800" />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.2 : 1.7}
                className={active ? 'text-slate-900' : 'text-gray-400'}
              />
              <span className={`text-[10px] leading-none ${active ? 'text-slate-900 font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
