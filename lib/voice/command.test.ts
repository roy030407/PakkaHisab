import { describe, it, expect } from 'vitest'
import { decideCommandAction, buildBalanceSpeech } from '@/lib/voice/command'

describe('decideCommandAction', () => {
  it('next saves and keeps the session when the cart has items', () => {
    expect(decideCommandAction('next', 3)).toEqual({ save: true, closeSession: false, speakTotal: false })
  })

  it('next is a no-op when the cart is empty', () => {
    expect(decideCommandAction('next', 0)).toEqual({ save: false, closeSession: false, speakTotal: false })
  })

  it('close saves and ends the session when the cart has items', () => {
    expect(decideCommandAction('close', 2)).toEqual({ save: true, closeSession: true, speakTotal: false })
  })

  it('close still ends the session with an empty cart but does not save', () => {
    expect(decideCommandAction('close', 0)).toEqual({ save: false, closeSession: true, speakTotal: false })
  })

  it('read_balance only speaks the total', () => {
    expect(decideCommandAction('read_balance', 5)).toEqual({ save: false, closeSession: false, speakTotal: true })
  })

  it('is a no-op for stretch commands and null', () => {
    const noop = { save: false, closeSession: false, speakTotal: false }
    expect(decideCommandAction('remove_last', 5)).toEqual(noop)
    expect(decideCommandAction('set_qty', 5)).toEqual(noop)
    expect(decideCommandAction('attach_customer', 5)).toEqual(noop)
    expect(decideCommandAction(null, 5)).toEqual(noop)
  })
})

describe('buildBalanceSpeech', () => {
  it('reads a positive total in rupees', () => {
    expect(buildBalanceSpeech(250)).toBe('Total 250 rupees.')
  })

  it('says the cart is empty for a zero or negative total', () => {
    expect(buildBalanceSpeech(0)).toBe('Cart is empty.')
    expect(buildBalanceSpeech(-5)).toBe('Cart is empty.')
  })
})
