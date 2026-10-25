/**
 * Journey 6: voice page.
 *   - mic permission denied path
 *   - fake audio stream (Chromium --use-file-for-fake-audio-capture with a
 *     synthetic voiced burst) driving the real VAD + MediaRecorder; the
 *     /api/voice/parse response is mocked with a scripted conversation
 *   - every on-screen equivalent of the voice commands
 */
import { test, expect, type Page } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { merchant, listProducts, createCustomer, customerBalance, setStock, stockOf } from '../helpers/session'
import { mockVoice, voiceItems, voiceCommand, mockInsightOnly } from '../helpers/mocks'

async function captureSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] }
    w.__spoken = []
    if ('speechSynthesis' in window) {
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { w.__spoken.push(u.text) }
    }
  })
}
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)

test('J6 voice: mic denied', async ({ page }, info) => {
  const j = new Journey('j06-voice-denied', page, info)
  await mockInsightOnly(page)
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
  })
  await merchant(page, 'voice-denied')
  await j.step('voice page loads', async () => {
    await page.goto('/voice')
    await expect(page.getByText('Tap to start.')).toBeVisible()
  })
  await j.step('tap mic with permission denied shows guidance', async () => {
    await page.getByRole('button', { name: 'Start listening' }).click()
    await expect(page.getByText('Mic blocked. Allow microphone access in your browser to use voice.')).toBeVisible()
  })
  await j.step('page still usable without mic (popular items strip + Save)', async () => {
    await expect(page.getByText('Most popular items')).toBeVisible({ timeout: 20_000 })
  })
  j.save()
})

test('J6 voice: fake audio stream + scripted parse', async ({ page }, info) => {
  const j = new Journey('j06-voice-stream', page, info)
  await mockInsightOnly(page)
  await captureSpeech(page)
  await merchant(page, 'voice')
  const [p1, p2] = (await listProducts(page.request)).filter((p) => !p.parent_product_id).sort((a, b) => a.name.localeCompare(b.name))
  await setStock(page.request, p1.id, 30)
  const cust = await createCustomer(page.request, 'Sharma ji', '9811122233')
  const stockBefore = await stockOf(page.request, p1.id)

  const script = [
    voiceItems(`do ${p1.name}`, [{ productId: p1.id, name: p1.name, quantity: 2, unitPrice: Number(p1.selling_price) }]),
    voiceItems('ek pudina chutney', [{ productId: 'new:Pudina chutney', name: 'Pudina chutney', quantity: 1, unitPrice: 30, addedAsNew: true }]),
    voiceCommand('galat, hata do', 'remove_last'),
    voiceCommand('teen kar do', 'set_qty', { quantity: 3 }),
    voiceCommand('balance batao', 'read_balance'),
    voiceCommand('Sharma ji ke khate mein', 'attach_customer', { customerName: 'Sharma ji' }, { id: cust.id, name: cust.name, currentBalance: 0 }),
    voiceCommand('agla', 'next'),
  ]
  const log = await mockVoice(page, script)

  await j.step('start listening with the fake mic', async () => {
    await page.goto('/voice')
    await page.getByRole('button', { name: 'Start listening' }).click()
    await expect(page.getByText('Listening - speak now.').or(page.getByText('Listening...'))).toBeVisible()
  })

  await j.step('VAD finalizes a clip and the parsed item lands in the cart', async () => {
    await expect(page.getByText(`"do ${p1.name}"`).or(page.getByText(`“do ${p1.name}”`))).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(p1.name).last()).toBeVisible()
  })

  await j.step('add-as-new item, then "remove_last" removes it', async () => {
    await expect.poll(() => log.count, { timeout: 45_000 }).toBeGreaterThanOrEqual(3)
    await expect(page.getByText('Pudina chutney')).toBeHidden({ timeout: 20_000 })
  })

  await j.step('"set_qty 3" sets the last row to 3', async () => {
    await expect.poll(() => log.count, { timeout: 45_000 }).toBeGreaterThanOrEqual(4)
    await expect(page.getByRole('button', { name: new RegExp(`₹${3 * Number(p1.selling_price)}`) })).toBeVisible({ timeout: 20_000 })
  })

  await j.step('"balance batao" speaks the total', async () => {
    await expect.poll(() => log.count, { timeout: 45_000 }).toBeGreaterThanOrEqual(5)
    await expect.poll(async () => (await spoken(page)).length, { timeout: 15_000 }).toBeGreaterThan(0)
    return `spoken: ${JSON.stringify((await spoken(page)).at(-1))}`
  })

  await j.step('"attach_customer" shows the udhaar chip', async () => {
    await expect(page.getByText('Udhaar: Sharma ji (credit)')).toBeVisible({ timeout: 45_000 })
  })

  await j.step('"agla" saves the udhaar sale', async () => {
    await expect(page.getByText(/Sale saved - ₹/)).toBeVisible({ timeout: 45_000 })
  })

  await j.step('stop the session', async () => {
    await page.getByRole('button', { name: 'Stop listening' }).click().catch(() => {})
    await expect(page.getByText('Tap to start.')).toBeVisible()
  })

  await j.step('customer balance and stock updated by the voice sale', async () => {
    const bal = await customerBalance(page.request, cust.id)
    const st = await stockOf(page.request, p1.id)
    assert(bal === 3 * Number(p1.selling_price), `Sharma ji balance ₹${bal}, expected ₹${3 * Number(p1.selling_price)}`)
    assert(st === (stockBefore ?? 0) - 3, `stock ${stockBefore} -> ${st}`)
  })

  // ─── On-screen equivalents (no mic) ───
  await j.step('on-screen: popular-items strip adds to the cart (+) and removes (-)', async () => {
    await page.goto('/voice')
    await page.getByRole('button', { name: `Add one ${p2.name}` }).click()
    await page.getByRole('button', { name: `Add one ${p2.name}` }).click()
    await page.getByRole('button', { name: `Remove one ${p2.name}` }).click()
    await expect(page.getByRole('button', { name: new RegExp(`Save & agla - ₹${Number(p2.selling_price)}`) })).toBeVisible()
  })
  await j.step('on-screen: cart +/- (set_qty equivalent)', async () => {
    await page.getByRole('button', { name: 'Increase quantity' }).first().click()
    await expect(page.getByRole('button', { name: new RegExp(`₹${2 * Number(p2.selling_price)}`) })).toBeVisible()
  })
  await j.step('on-screen: "Total batao" (read_balance equivalent)', async () => {
    const n = (await spoken(page)).length
    await page.getByRole('button', { name: 'Read the total aloud' }).click()
    await expect.poll(async () => (await spoken(page)).length).toBe(n + 1)
    return JSON.stringify((await spoken(page)).at(-1))
  })
  await j.step('on-screen: remove_last equivalent exists', async () => {
    const btn = page.getByRole('button', { name: /remove last|undo|hata/i })
    assert(await btn.count() > 0, 'No on-screen equivalent for "remove_last" (galat / hata do). The only way is - on each row.')
  })
  await j.step('on-screen: attach_customer equivalent exists', async () => {
    const btn = page.getByRole('button', { name: /customer|udhaar/i })
    assert(await btn.count() > 0, 'No on-screen way to attach a customer (udhaar) on /voice; only the spoken "X ke khate mein" works.')
  })
  await j.step('on-screen: "Save & agla" (next equivalent) saves', async () => {
    await page.getByRole('button', { name: /Save & agla/ }).click()
    await expect(page.getByText(/Sale saved - ₹/)).toBeVisible()
  })
  await j.step('on-screen: "Khatam" (close equivalent) with an empty cart is disabled', async () => {
    await expect(page.getByRole('button', { name: 'Khatam' })).toBeDisabled()
  })
  await j.step('voice page title renders (mixed-script heading)', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bolकर बेचो')
  })

  j.save({ parseCalls: log.count })
})
