/**
 * FILE: components/shared/Sidebar.tsx
 *
 * WHAT THIS DOES:
 *   Fixed left sidebar for desktop (md+). Shows icon + label for all 8 nav
 *   items. Active state uses a bg pill. Hidden on mobile - BottomNav takes over.
 *   Logo/brand name at top, Settings at bottom.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Khata Green: emerald brand mark + emerald active pill states
 *   - Added Logout row at the bottom (returns to landing page)
 *   - Nav items lift on hover (btn-lift)
 *
 * WHERE IT FITS:
 *   Mounted in app/(dashboard)/layout.tsx. Visible md+, hidden on mobile.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx
 */
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Camera, PenLine, Package, Users,
  BarChart2, Bot, Settings,
} from 'lucide-react'
import { LogoutButton } from './LogoutButton'

const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Home',      Icon: Home      },
  { href: '/scan',      label: 'Scan Bill', Icon: Camera    },
  { href: '/entry',     label: 'Entry',     Icon: PenLine   },
  { href: '/inventory', label: 'Stock',     Icon: Package   },
  { href: '/customers', label: 'Customers', Icon: Users     },
  { href: '/reports',   label: 'Reports',   Icon: BarChart2 },
  { href: '/advisor',   label: 'Advisor',   Icon: Bot       },
]

export function Sidebar() {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-white border-r border-gray-100 py-4 px-3">
      {/* Brand */}
      <div className="px-3 mb-6 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-extrabold text-white">₹</span>
        <span className="text-lg font-bold text-gray-900 tracking-tight">PakkaHisab</span>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {PRIMARY_NAV.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className={`btn-lift flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                active
                  ? 'bg-emerald-50 text-emerald-800 shadow-[inset_2px_0_0_#047857]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Settings + Logout at bottom */}
      <div className="flex flex-col gap-0.5">
        <Link href="/settings"
          className={`btn-lift flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
            isActive('/settings')
              ? 'bg-emerald-50 text-emerald-800 shadow-[inset_2px_0_0_#047857]'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}>
          <Settings size={18} strokeWidth={isActive('/settings') ? 2.2 : 1.7} />
          Settings
        </Link>
        <LogoutButton variant="nav" />
      </div>
    </aside>
  )
}
