/**
 * FILE: components/analytics/PostHogProvider.tsx
 *
 * WHAT THIS DOES:
 *   Client component that initializes PostHog on mount and identifies the
 *   logged-in user. Wraps the app tree in the dashboard layout.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
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
  children,
}: {
  userId?: string
  email?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    initPostHog()
    if (userId) {
      identifyUser(userId, { email })
    }
  }, [userId, email])

  return <>{children}</>
}
