/**
 * Journey 11: advisor. A question returns an answer (mocked stream), the
 * daily tip renders on the advisor page and the dashboard, and an AI failure
 * degrades gracefully.
 */
import { test, expect } from '@playwright/test'
import { Journey } from '../helpers/journey'
import { merchant } from '../helpers/session'
import { mockAdvisor, INSIGHT_TEXT, CHAT_ANSWER } from '../helpers/mocks'

test('J11 advisor', async ({ page }, info) => {
  const j = new Journey('j11-advisor', page, info)
  await mockAdvisor(page)
  await merchant(page, 'adv')

  await j.step('dashboard shows the daily insight card', async () => {
    await page.goto('/dashboard')
    await expect(page.getByText(INSIGHT_TEXT)).toBeVisible({ timeout: 30_000 })
  })

  await j.step('"Tell me more" opens the advisor', async () => {
    await page.getByRole('link', { name: /tell me more|ask more/i }).or(page.getByRole('button', { name: /tell me more|ask more/i })).first().click()
    await page.waitForURL(/\/advisor/)
  })

  await j.step('advisor page renders the daily tip banner', async () => {
    await page.goto('/advisor')
    await expect(page.getByRole('heading', { name: 'Your business advisor' })).toBeVisible()
    await expect(page.getByText(INSIGHT_TEXT).first()).toBeVisible()
  })

  await j.step('typed question streams an answer', async () => {
    await page.getByPlaceholder('Ask anything about your business…').fill('Why is cash low?')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Why is cash low?')).toBeVisible()
    await expect(page.getByText(CHAT_ANSWER.slice(0, 60))).toBeVisible({ timeout: 30_000 })
  })

  await j.step('quick prompt chip sends a question', async () => {
    await page.getByRole('button', { name: 'Which customer owes the most?' }).click().catch(() => { throw new Error('quick prompts hidden after the first message') })
    await expect(page.getByText('Which customer owes the most?').last()).toBeVisible()
  })

  await j.step('AI failure (500) shows a friendly message, not a crash', async () => {
    await page.unroute('**/api/ai/chat')
    await page.route('**/api/ai/chat', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }))
    await page.getByPlaceholder('Ask anything about your business…').fill('Is this month better than last?')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible()
  })

  await j.step('insight API failure hides the card quietly', async () => {
    await page.unroute('**/api/ai/insight')
    await page.route('**/api/ai/insight', (r) => r.fulfill({ status: 500, body: '{}' }))
    await page.goto('/dashboard')
    await expect(page.getByText(INSIGHT_TEXT)).toBeHidden()
    await expect(page.locator('body')).not.toContainText(/error|undefined/i)
  })

  j.save()
})
