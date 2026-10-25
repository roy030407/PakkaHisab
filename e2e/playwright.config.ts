/**
 * Session D audit: Playwright config.
 *
 * Mobile is primary (Pixel 7, iPhone SE sizes), desktop is secondary.
 * iPhone SE runs on Chromium with the iPhone SE viewport/UA so we do not need
 * a WebKit download; the point is the 375x667 layout, not Safari quirks.
 *
 * Every spec creates its own audit-d-* user, so specs are independent.
 * The dev server is expected on :3001 (shared with other audit sessions),
 * so we never start or stop it from here.
 */
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const FAKE_WAV = path.resolve(__dirname, 'fixtures/voice/speech-burst.wav')

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/report.json' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 90_000, // dev server compiles routes on first hit
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${FAKE_WAV}`,
      ],
    },
  },
  projects: [
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
    {
      name: 'iphone-se',
      use: {
        ...devices['iPhone SE'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
  ],
})
