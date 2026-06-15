import { describe, it, expect } from 'vitest'
import { renderTemplate, buildWhatsappUrl, DEFAULT_REMINDER_TEMPLATE } from './reminder'

describe('renderTemplate', () => {
  it('fills all three placeholders', () => {
    const out = renderTemplate('Namaste {name} ji, {shop} par {amount} baaki.', {
      name: 'Ramesh',
      amount: '1,200',
      shop: 'Sharma Stores',
    })
    expect(out).toBe('Namaste Ramesh ji, Sharma Stores par 1,200 baaki.')
  })

  it('replaces every occurrence of a placeholder', () => {
    expect(renderTemplate('{name} {name}', { name: 'A', amount: '0', shop: 'S' })).toBe('A A')
  })

  it('treats a missing value as an empty string', () => {
    expect(renderTemplate('Hi {name}{amount}', { name: 'A', shop: 'S' })).toBe('Hi A')
  })

  it('renders the seeded default without leftover braces', () => {
    const out = renderTemplate(DEFAULT_REMINDER_TEMPLATE, { name: 'Ravi', amount: '500', shop: 'My Shop' })
    expect(out).toContain('Ravi')
    expect(out).toContain('500')
    expect(out).toContain('My Shop')
    expect(out).not.toMatch(/\{(name|amount|shop)\}/)
  })
})

describe('buildWhatsappUrl', () => {
  it('prefixes a 10-digit number with 91 and encodes the message', () => {
    expect(buildWhatsappUrl('9876543210', 'Hi there')).toBe('https://wa.me/919876543210?text=Hi%20there')
  })

  it('keeps a number that already has the 91 country code', () => {
    expect(buildWhatsappUrl('919876543210', 'x')).toBe('https://wa.me/919876543210?text=x')
  })

  it('strips spaces, dashes and a +91 prefix before normalizing', () => {
    expect(buildWhatsappUrl('+91 98765-43210', 'x')).toBe('https://wa.me/919876543210?text=x')
  })

  it('returns null for empty / junk phones', () => {
    expect(buildWhatsappUrl('', 'x')).toBeNull()
    expect(buildWhatsappUrl(null, 'x')).toBeNull()
    expect(buildWhatsappUrl('abc', 'x')).toBeNull()
    expect(buildWhatsappUrl('12345', 'x')).toBeNull()
  })
})
