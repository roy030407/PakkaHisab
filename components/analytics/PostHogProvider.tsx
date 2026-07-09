/**
 * FILE: components/analytics/PostHogProvider.tsx
 *
 * WHAT THIS DOES:
 *   Client component that initializes PostHog on mount and identifies the
 *   logged-in user. Wraps the app tree in the dashboard layout.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *   - Identify now sends store_name as a person property so a merchant's
 *     activity is findable by store name in PostHog
 *
 * WHERE IT FITS:
 *   Mounted once in the dashboard layout so all dashboard pages get
 *   automatic pageview tracking and access to track().
 *
 * CALLED BY / IMPORTS FROM:
 *   app/(dashboard)/layout.tsx
 */
'use client'

import { useEffect } from 'react'
import { initPostHog, identifyUser } from '@/lib/analytics/posthog'

export function PostHogProvider({
  userId,
  email,
  storeName,
  children,
}: {
  userId?: string
  email?: string
  storeName?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    initPostHog()
    if (userId) {
      identifyUser(userId, { email, store_name: storeName })
    }
  }, [userId, email, storeName])

  return <>{children}</>
}
