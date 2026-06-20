// lib/voice/parseGemini.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeVoiceParse } from '@/lib/voice/parseGemini'

describe('normalizeVoiceParse', () => {
  it('coerces a well-formed items payload', () => {
    const r = normalizeVoiceParse({
      transcript: '5 Parle-G, ek doodh',
      kind: 'items',
      items: [
        { name: 'Parle-G', quantity: 5, unit: null },
        { name: 'Milk', quantity: 1, unit: 'litre' },
      ],
      command: null,
      args: {},
    })
    expect(r.kind).toBe('items')
    expect(r.items).toHaveLength(2)
    expect(r.items[1]).toEqual({ name: 'Milk', quantity: 1, unit: 'litre' })
    expect(r.command).toBeNull()
  })

  it('defaults a missing or non-positive quantity to 1 and drops nameless items', () => {
    const r = normalizeVoiceParse({
      items: [
        { name: 'Bread' },
        { name: '  ', quantity: 3 },
        { name: 'Eggs', quantity: 0 },
        { name: 'Sugar', quantity: -2 },
      ],
    })
    expect(r.items.map(i => i.name)).toEqual(['Bread', 'Eggs', 'Sugar'])
    expect(r.items.map(i => i.quantity)).toEqual([1, 1, 1])
  })

  it('recognizes a known command and infers kind when kind is absent', () => {
    const r = normalizeVoiceParse({ transcript: 'agla', command: 'NEXT', items: [] })
    expect(r.kind).toBe('command')
    expect(r.command).toBe('next')
  })

  it('rejects an unknown command string', () => {
    const r = normalizeVoiceParse({ command: 'do_a_backflip', items: [{ name: 'Rice', quantity: 2 }] })
    expect(r.command).toBeNull()
    expect(r.kind).toBe('items')
  })

  it('never throws on garbage and returns safe defaults', () => {
    const r = normalizeVoiceParse(null)
    expect(r).toEqual({ transcript: '', kind: 'items', items: [], command: null, args: {} })
  })

  it('extracts numeric args.quantity and trimmed customerName', () => {
    const r = normalizeVoiceParse({ command: 'set_qty', args: { quantity: 3, customerName: '  Sharma ji  ' } })
    expect(r.args).toEqual({ quantity: 3, customerName: 'Sharma ji' })
  })

  it('recognizes customer_balance and keeps the customerName arg', () => {
    const r = normalizeVoiceParse({
      command: 'customer_balance',
      args: { customerName: 'Sharma Ji' },
      items: [],
    })
    expect(r.kind).toBe('command')
    expect(r.command).toBe('customer_balance')
    expect(r.args.customerName).toBe('Sharma Ji')
  })
})
