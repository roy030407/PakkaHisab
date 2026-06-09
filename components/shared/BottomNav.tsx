/**
 * FILE: components/shared/BottomNav.tsx
 *
 * WHAT THIS DOES:
 *   Fixed bottom navigation bar. 5 tabs: Home, Scan, Entry, Stock, Customers.
 *   Active tab highlighted based on current pathname.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Mounted in app/(dashboard)/layout.tsx. Visible on all dashboard routes.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/scan', label: 'Scan', icon: '📷' },
  { href: '/entry', label: 'Entry', icon: '✏️' },
  { href: '/inventory', label: 'Stock', icon: '📦' },
  { href: '/customers', label: 'Customers', icon: '👥' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
        {NAV.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active ? 'text-slate-900 font-semibold' : 'text-gray-400 hover:text-gray-600'
              }`}>
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
