import { describe, it, expect } from 'vitest'
import { matchCustomer, buildBalanceByNameSpeech, type CustomerEntry } from '@/lib/voice/customer'

const customers: CustomerEntry[] = [
  { id: 'c1', name: 'Sharma Ji', currentBalance: 250 },
  { id: 'c2', name: 'Verma Store', currentBalance: 0 },
  { id: 'c3', name: 'Anil Kumar', currentBalance: 80 },
]

describe('matchCustomer', () => {
  it('matches an exact name', () => {
    expect(matchCustomer('Sharma Ji', customers)?.id).toBe('c1')
  })

  it('matches a fuzzy / partial name', () => {
    expect(matchCustomer('sharma', customers)?.id).toBe('c1')
  })

  it('returns null when nothing is close', () => {
    expect(matchCustomer('Zzxqq', customers)).toBeNull()
  })

  it('returns null for an empty name or empty list', () => {
    expect(matchCustomer('', customers)).toBeNull()
    expect(matchCustomer('Sharma', [])).toBeNull()
  })
})

describe('buildBalanceByNameSpeech', () => {
  it('reads what a customer owes', () => {
    expect(buildBalanceByNameSpeech({ id: 'c1', name: 'Sharma Ji', currentBalance: 250 }))
      .toBe('Sharma Ji owes 250 rupees.')
  })

  it('says no balance due when nothing is owed', () => {
    expect(buildBalanceByNameSpeech({ id: 'c2', name: 'Verma Store', currentBalance: 0 }))
      .toBe('Verma Store has no balance due.')
  })

  it('says not found for a null customer', () => {
    expect(buildBalanceByNameSpeech(null)).toBe('Customer not found.')
  })
})
