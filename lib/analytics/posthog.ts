/**
 * FILE: lib/analytics/posthog.ts
 *
 * WHAT THIS DOES:
 *   Initializes PostHog client-side and exports typed tracking helpers.
 *   All analytics calls go through this file so the rest of the app
 *   never imports posthog-js directly.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation
 *
 * WHERE IT FITS:
 *   Imported by components that track user actions (voice, entry, scan,
 *   reports, dashboard). PostHogProvider wraps the app in layout.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/analytics/PostHogProvider.tsx, and any component that
 *   calls track().
 */

import posthog from 'posthog-js'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

let initialized = false

export function initPostHog() {
  if (initialized || !POSTHOG_KEY || typeof window === 'undefined') return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage',
  })
  initialized = true
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.identify(userId, properties)
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export function resetAnalytics() {
  if (!POSTHOG_KEY) return
  posthog.reset()
}
