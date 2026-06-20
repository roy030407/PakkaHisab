import { describe, it, expect } from 'vitest'
import { decideCommandAction, buildBalanceSpeech } from '@/lib/voice/command'

const NOOP = { save: false, closeSession: false, speakTotal: false, removeLast: false, setQty: null }

describe('decideCommandAction', () => {
  it('next saves and keeps the session when the cart has items', () => {
    expect(decideCommandAction('next', 3)).toEqual({ ...NOOP, save: true })
  })

  it('next is a no-op when the cart is empty', () => {
    expect(decideCommandAction('next', 0)).toEqual(NOOP)
  })

  it('close saves and ends the session when the cart has items', () => {
    expect(decideCommandAction('close', 2)).toEqual({ ...NOOP, save: true, closeSession: true })
  })

  it('close still ends the session with an empty cart but does not save', () => {
    expect(decideCommandAction('close', 0)).toEqual({ ...NOOP, closeSession: true })
  })

  it('read_balance only speaks the total', () => {
    expect(decideCommandAction('read_balance', 5)).toEqual({ ...NOOP, speakTotal: true })
  })

  it('remove_last drops the last row when the cart has items', () => {
    expect(decideCommandAction('remove_last', 3)).toEqual({ ...NOOP, removeLast: true })
  })

  it('remove_last is a no-op on an empty cart', () => {
    expect(decideCommandAction('remove_last', 0)).toEqual(NOOP)
  })

  it('set_qty carries the spoken quantity from args', () => {
    expect(decideCommandAction('set_qty', 3, { quantity: 5 })).toEqual({ ...NOOP, setQty: 5 })
  })

  it('set_qty is a no-op when no valid quantity was heard', () => {
    expect(decideCommandAction('set_qty', 3, {})).toEqual(NOOP)
    expect(decideCommandAction('set_qty', 3, { quantity: 0 })).toEqual(NOOP)
    expect(decideCommandAction('set_qty', 3)).toEqual(NOOP)
  })

  it('is a no-op for attach_customer and null', () => {
    expect(decideCommandAction('attach_customer', 5)).toEqual(NOOP)
    expect(decideCommandAction(null, 5)).toEqual(NOOP)
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
