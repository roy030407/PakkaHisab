import { describe, it, expect } from 'vitest'
import { customerAge } from './aging'

const now = new Date('2026-06-15T10:00:00Z')

describe('customerAge', () => {
  it('computes sinceDays from the oldest credit sale and lastPaidDays from the last payment', () => {
    const out = customerAge({
      oldestCreditAt: '2026-06-05T10:00:00Z', // 10 days ago
      lastPaymentAt: '2026-06-13T10:00:00Z',  // 2 days ago
      now,
    })
    expect(out.sinceDays).toBe(10)
    expect(out.lastPaidDays).toBe(2)
  })

  it('returns lastPaidDays = null when the customer has never paid', () => {
    const out = customerAge({ oldestCreditAt: '2026-06-08T10:00:00Z', lastPaymentAt: null, now })
    expect(out.sinceDays).toBe(7)
    expect(out.lastPaidDays).toBeNull()
  })

  it('returns 0 days for a balance opened today and a payment made today', () => {
    const out = customerAge({
      oldestCreditAt: '2026-06-15T01:00:00Z',
      lastPaymentAt: '2026-06-15T09:00:00Z',
      now,
    })
    expect(out.sinceDays).toBe(0)
    expect(out.lastPaidDays).toBe(0)
  })

  it('returns sinceDays = 0 when there is no recorded credit sale', () => {
    const out = customerAge({ oldestCreditAt: null, lastPaymentAt: null, now })
    expect(out.sinceDays).toBe(0)
    expect(out.lastPaidDays).toBeNull()
  })
})
