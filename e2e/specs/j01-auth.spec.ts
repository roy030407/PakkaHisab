/**
 * Journey 1: sign up, log out, log in, wrong password, forgot password.
 * Also answers: is "confirm email" blocking signup?
 */
import { test, expect } from '@playwright/test'
import { Journey, assert } from '../helpers/journey'
import { auditEmail, admin, uiLogin, PASSWORD } from '../helpers/session'
import { mockInsightOnly } from '../helpers/mocks'

test('J1 auth', async ({ page }, info) => {
  const j = new Journey('j01-auth', page, info)
  await mockInsightOnly(page)
  const email = auditEmail('signup')
  let signedUpWithSession = false

  await j.step('landing page loads', async () => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })

  await j.step('signup form validates short password and mismatch', async () => {
    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill('123')
    await page.getByLabel('Confirm password').fill('123')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible()
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password').fill(PASSWORD + 'x')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
  })

  await j.step('signup with email + password', async () => {
    await page.getByLabel('Confirm password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    const onboard = page.waitForURL(/\/onboarding/, { timeout: 60_000 }).then(() => 'onboarding')
    const notice = page.getByText(/check your email to confirm/i).waitFor({ timeout: 60_000 }).then(() => 'confirm-email')
    const err = page.getByText(/Could not create account|already exists/).waitFor({ timeout: 60_000 }).then(() => 'error')
    const outcome = await Promise.race([onboard, notice, err])
    if (outcome === 'onboarding') { signedUpWithSession = true; return 'Signup created a session immediately and went to /onboarding. Confirm email is NOT blocking.' }
    if (outcome === 'confirm-email') throw new Error('Signup did not create a session: "check your email to confirm" shown. Confirm email IS blocking signup.')
    throw new Error(`Signup error shown: ${await page.locator('p.text-red-600').innerText()}`)
  })

  if (!signedUpWithSession) {
    // Unblock the rest of the journey: confirm the address via admin so login can be tested.
    const { data } = await admin().auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = data.users.find((x) => x.email === email)
    if (u) await admin().auth.admin.updateUserById(u.id, { email_confirm: true })
    j.note('signup unblock', 'Confirmed the signup email through the admin API so the rest of J1 could run.')
    await uiLogin(page, email, PASSWORD)
    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 60_000 })
  }

  await j.step('new user with no store lands on onboarding', async () => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/onboarding/)
  })

  await j.step('complete onboarding (kirana, start empty)', async () => {
    await page.getByLabel('Store name').fill('Audit D Signup Store')
    await page.getByLabel('Your name').fill('Audit Owner')
    await page.getByLabel('City').fill('Pune')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 90_000 })
  })

  await j.step('logout from the UI', async () => {
    // Mobile has no sidebar; Settings carries the logout button.
    const sidebarLogout = page.getByRole('button', { name: 'Logout' }).first()
    if (!(await sidebarLogout.isVisible().catch(() => false))) await page.goto('/settings')
    await page.getByRole('button', { name: 'Logout' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Logout' }).click()
    await page.waitForURL((u) => u.pathname === '/', { timeout: 60_000 })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  await j.step('login with wrong password shows a plain-language error', async () => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('totally-wrong-pass')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Wrong email or password. Try again.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  await j.step('login with correct password reaches dashboard', async () => {
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Log in' }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 90_000 })
  })

  await j.step('forgot password: link exists on login page', async () => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: /forgot|reset/i }).or(page.getByRole('button', { name: /forgot|reset/i }))
    const n = await link.count()
    assert(n > 0, 'No "Forgot password" link or button on /login. A merchant who forgets their password has no recovery path in the app.')
  })

  await j.step('existing email on signup gives a clear message', async () => {
    await page.context().clearCookies()
    await page.goto('/signup')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
    await page.getByLabel('Confirm password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()
    const r = await Promise.race([
      page.getByText(/already exists/).waitFor({ timeout: 30_000 }).then(() => 'clear'),
      page.getByText(/check your email/i).waitFor({ timeout: 30_000 }).then(() => 'silent-notice'),
      page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30_000 }).then(() => 'logged-in'),
    ]).catch(() => 'nothing')
    if (r !== 'clear') throw new Error(`Re-signup with an existing email resulted in: ${r} (Supabase hides existing users; the UI shows no "log in instead" guidance)`)
  })

  await j.step('rapid wrong-password attempts are rate limited (5/min/IP per CLAUDE.md)', async () => {
    await page.goto('/login')
    let lastMsg = ''
    for (let i = 0; i < 7; i++) {
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(`wrong-${i}`)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled({ timeout: 30_000 })
      lastMsg = await page.locator('p.text-red-600').innerText().catch(() => '')
    }
    assert(/too many|wait|limit/i.test(lastMsg), `After 7 wrong attempts the message is still "${lastMsg}". No app-level rate limit or lockout feedback on login.`)
  })

  j.save({ email, confirmEmailBlocking: !signedUpWithSession })
})
