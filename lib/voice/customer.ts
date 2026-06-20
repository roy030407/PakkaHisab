/**
 * FILE: lib/voice/customer.ts
 *
 * WHAT THIS DOES:
 *   Pure customer helpers for voice udhaar. matchCustomer fuzzy-matches a spoken
 *   name against the store's customers (Fuse.js), buildBalanceByNameSpeech turns
 *   a matched customer (or null) into the phrase read aloud for "X ka kitna baaki".
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Voice Layer 4)
 *
 * WHERE IT FITS:
 *   matchCustomer runs server-side in app/api/voice/parse/route.ts,
 *   buildBalanceByNameSpeech runs on the /voice page for the spoken balance.
 *
 * CALLED BY / IMPORTS FROM:
 *   app/api/voice/parse/route.ts, app/(dashboard)/voice/page.tsx ,
 *   uses fuse.js and VoiceCustomerMatch from lib/voice/types
 */
import Fuse from 'fuse.js'
import type { VoiceCustomerMatch } from './types'

export interface CustomerEntry {
  id: string
  name: string
  currentBalance: number
}

export function matchCustomer(name: string, customers: CustomerEntry[]): CustomerEntry | null {
  const query = name.trim()
  if (!query || customers.length === 0) return null
  const fuse = new Fuse(customers, {
    keys: ['name'],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.45,
  })
  const results = fuse.search(query)
  return results.length > 0 ? results[0].item : null
}

export function buildBalanceByNameSpeech(customer: VoiceCustomerMatch | null): string {
  if (!customer) return 'Customer not found.'
  if (customer.currentBalance > 0) return `${customer.name} owes ${customer.currentBalance} rupees.`
  return `${customer.name} has no balance due.`
}
