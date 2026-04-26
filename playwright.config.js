import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VerdictCouncil E2E tests.
 *
 * Covers:
 *   - Full user journey: login → cases → pipeline → gate review → verdict
 *   - Accessibility scanning (axe-core via @axe-core/playwright)
 *   - Visual regression snapshots (screenshot comparison)
 *   - Cross-browser: Chromium, Firefox, WebKit
 *   - Mobile viewports: Galaxy S21, iPhone 14 Pro
 *
 * CI usage:
 *   npx playwright test --reporter=html,github
 *
 * Local usage:
 *   npx playwright test --ui
 *   npx playwright test e2e/login.spec.js --headed
 *
 * Environment variables:
 *   BASE_URL          (default: http://localhost:5173)
 *   CI                If set, runs in CI mode (no headed, 1 worker)
 *   VC_TEST_EMAIL     judge email for login tests (default: judge@example.com)
 *   VC_TEST_PASSWORD  judge password (default: TestPassword123!)
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.spec.{js,ts}'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/reports', open: 'never' }],
    ...(process.env.CI ? [['github']] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Global timeout for each action
    actionTimeout: 10_000,
  },

  // Snapshot update mode for visual regression
  snapshotPathTemplate: '{testDir}/snapshots/{testFilePath}/{arg}{ext}',
  updateSnapshots: process.env.UPDATE_SNAPSHOTS ? 'all' : 'missing',

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14 Pro'] },
    },
  ],

  // Dev server — starts Vite before tests run if not already running
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL || 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
