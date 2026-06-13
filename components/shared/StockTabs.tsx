/**
 * FILE: components/shared/StockTabs.tsx
 *
 * WHAT THIS DOES:
 *   Segmented [Stock | Products] tab switcher. Each tab is a link to its
 *   route; the active tab is derived from the current pathname. Gives the
 *   catalog a reachable home from the Stock area on both desktop and mobile.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Products discoverability via a Stock tab)
 *
 * WHERE IT FITS:
 *   Rendered at the top of /inventory (Stock) and /products (catalog) so the
 *   two read as one section the merchant can flip between.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/inventory/page.tsx, app/(dashboard)/products/page.tsx
 */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Boxes } from 'lucide-react'

const TABS = [
  { href: '/inventory', label: 'Stock', Icon: Boxes },
  { href: '/products', label: 'Products', Icon: Package },
]

export function StockTabs() {
  const pathname = usePathname()

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`btn-lift inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${
              active
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
