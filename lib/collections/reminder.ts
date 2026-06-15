/**
 * FILE: lib/collections/reminder.ts
 *
 * WHAT THIS DOES:
 *   Pure helpers for WhatsApp udhaar reminders. renderTemplate fills the
 *   {name}/{amount}/{shop} placeholders; buildWhatsappUrl normalizes an Indian
 *   phone (+91) and builds a wa.me deep link. Kept DB-free so the messaging
 *   logic is unit-tested in isolation.
 *
 * CHANGES THIS SESSION:
 *   - Initial creation (Slice A collections)
 *
 * WHERE IT FITS:
 *   Used by components/customers/RemindButton.tsx and the Settings template
 *   editor. DEFAULT_REMINDER_TEMPLATE is the fallback when a store has not
 *   customized stores.reminder_template.
 *
 * CALLED BY / IMPORTS FROM:
 *   components/customers/RemindButton.tsx, app/(dashboard)/settings/page.tsx
 */

export const DEFAULT_REMINDER_TEMPLATE =
  'Namaste {name} ji, {shop} par aapke ₹{amount} baaki hain. Kripya jab ho sake de dijiye. Dhanyavaad.'

export interface ReminderVars {
  name?: string
  amount?: string | number
  shop?: string
}

/**
 * Replace {name}, {amount}, {shop} with the supplied values. A missing value
 * becomes an empty string so the message never shows a raw placeholder.
 */
export function renderTemplate(template: string, vars: ReminderVars): string {
  const map: Record<string, string> = {
    name: vars.name != null ? String(vars.name) : '',
    amount: vars.amount != null ? String(vars.amount) : '',
    shop: vars.shop != null ? String(vars.shop) : '',
  }
  return template.replace(/\{(name|amount|shop)\}/g, (_, key: string) => map[key] ?? '')
}

/**
 * Normalize an Indian phone and build a wa.me link. Rules:
 *   - strip everything that is not a digit
 *   - 10 digits -> prefix 91
 *   - 12 digits starting with 91 -> keep as is
 *   - anything else (empty, junk, wrong length) -> null
 * Returns null when there is no usable phone so callers never open a broken link.
 */
export function buildWhatsappUrl(phone: string | null | undefined, message: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  let normalized: string | null = null
  if (digits.length === 10) normalized = `91${digits}`
  else if (digits.length === 12 && digits.startsWith('91')) normalized = digits
  if (!normalized) return null
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}
