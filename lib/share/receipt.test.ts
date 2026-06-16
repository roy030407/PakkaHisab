import { describe, it, expect } from 'vitest'
import { buildReceiptText } from './receipt'

describe('buildReceiptText', () => {
  it('formats an itemised cash sale', () => {
    const out = buildReceiptText({
      shopName: 'Sharma Stores',
      date: '2026-06-15',
      items: [
        { name: 'Thums Up 500ml', quantity: 2, lineTotal: 60 },
        { name: 'Parle-G', quantity: 1, lineTotal: 10 },
      ],
      total: 70,
      paymentMethod: 'cash',
    })
    expect(out).toBe(
      [
        'Sharma Stores',
        '15 Jun 2026',
        '--------------------',
        '2 x Thums Up 500ml - ₹60',
        '1 x Parle-G - ₹10',
        '--------------------',
        'Total: ₹70',
        'Paid: ₹70 (cash)',
        '',
        'Dhanyavaad! - Sharma Stores',
      ].join('\n')
    )
  })

  it('formats a credit sale with an Udhaar line and a balance line', () => {
    const out = buildReceiptText({
      shopName: 'My Shop',
      date: '2026-06-15',
      items: [{ name: 'Rice 5kg', quantity: 1, lineTotal: 300 }],
      total: 300,
      paymentMethod: 'credit',
      customerName: 'Ramesh',
      balanceAfter: 800,
    })
    expect(out).toBe(
      [
        'My Shop',
        '15 Jun 2026',
        '--------------------',
        '1 x Rice 5kg - ₹300',
        '--------------------',
        'Total: ₹300',
        'Udhaar: ₹300',
        'Balance: ₹800',
        '',
        'Dhanyavaad! - My Shop',
      ].join('\n')
    )
  })

  it('omits the item block when there are no items', () => {
    const out = buildReceiptText({
      shopName: 'S',
      date: '2026-06-15',
      items: [],
      total: 50,
      paymentMethod: 'upi',
    })
    expect(out).toBe(
      ['S', '15 Jun 2026', 'Total: ₹50', 'Paid: ₹50 (upi)', '', 'Dhanyavaad! - S'].join('\n')
    )
  })

  it('groups large amounts the Indian way', () => {
    const out = buildReceiptText({
      shopName: 'S',
      date: '2026-06-15',
      items: [{ name: 'TV', quantity: 1, lineTotal: 150000 }],
      total: 150000,
      paymentMethod: 'cash',
    })
    expect(out).toContain('1 x TV - ₹1,50,000')
    expect(out).toContain('Total: ₹1,50,000')
  })

  it('parses an ISO timestamp date and renders DD Mon YYYY', () => {
    const out = buildReceiptText({
      shopName: 'S', date: '2026-01-09T10:00:00Z', items: [], total: 5, paymentMethod: 'cash',
    })
    expect(out.split('\n')[1]).toBe('9 Jan 2026')
  })

  it('renders an empty date line for a malformed date', () => {
    const out = buildReceiptText({
      shopName: 'S', date: 'not-a-date', items: [], total: 5, paymentMethod: 'cash',
    })
    expect(out.split('\n')[1]).toBe('')
  })

  it('omits the balance line when balanceAfter is null or missing', () => {
    const out = buildReceiptText({
      shopName: 'S', date: '2026-06-15', items: [], total: 5, paymentMethod: 'credit',
    })
    expect(out).not.toContain('Balance:')
  })
})
