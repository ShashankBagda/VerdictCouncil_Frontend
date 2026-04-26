/**
 * E2E helpers shared across all Playwright test specs.
 *
 * Provides:
 *   - login(page) — authenticate using test credentials
 *   - createCase(page, title?) — create a minimal case via the UI
 *   - withAxe(page) — run axe accessibility scan and return results
 */

import { expect } from '@playwright/test';

const TEST_EMAIL = process.env.VC_TEST_EMAIL || 'judge@example.com';
const TEST_PASSWORD = process.env.VC_TEST_PASSWORD || 'TestPassword123!';

/**
 * Navigate to /login and authenticate with judge credentials.
 * Waits for successful redirect to the dashboard.
 */
export async function login(page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

/**
 * Create a case via the UI and return the case ID extracted from the URL.
 */
export async function createCase(page, title = 'E2E Test Case') {
  await page.goto('/cases/new');
  const titleInput = page.getByLabel(/title/i).or(page.getByPlaceholder(/case title/i));
  await titleInput.fill(title);
  await page.getByRole('button', { name: /create|submit/i }).first().click();
  // Wait for redirect to the case workspace
  await page.waitForURL(/\/cases\/[0-9a-f-]{36}/, { timeout: 15_000 });
  const url = new URL(page.url());
  const parts = url.pathname.split('/');
  return parts[parts.length - 1];
}

/**
 * Inject axe-core and run an accessibility scan on the current page.
 * Returns the axe results object.
 * Requires @axe-core/playwright to be installed.
 */
export async function runAxe(page, options = {}) {
  const { AxeBuilder } = await import('@axe-core/playwright');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  return results;
}

/**
 * Assert zero WCAG violations, printing a readable failure message.
 */
export async function assertNoViolations(page, options = {}) {
  const results = await runAxe(page, options);
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => `  [${v.impact}] ${v.id}: ${v.description}\n    Nodes: ${v.nodes.length}`)
      .join('\n');
    throw new Error(`Accessibility violations found:\n${summary}`);
  }
}
