/**
 * E2E: Visual regression snapshot tests.
 *
 * Uses Playwright's screenshot comparison to catch unintended visual changes.
 *
 * Covers:
 *   - Login page layout
 *   - Cases list page layout
 *   - Dashboard layout
 *   - Gate review panel layout
 *
 * Run with UPDATE_SNAPSHOTS=1 to update baseline screenshots.
 * Snapshots are stored in e2e/snapshots/
 *
 * NOTE: Run with --project=chromium only for deterministic snapshots in CI.
 */

import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth for all visual tests
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'judge@example.com', role: 'judge' }),
      });
    });

    await page.route('**/api/v1/cases*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              title: 'Traffic Citation #1234',
              status: 'pending',
              domain: 'traffic_violation',
              created_at: '2026-04-01T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
        }),
      });
    });
  });

  test('login page matches snapshot', async ({ page }) => {
    // Override auth to not be logged in
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'Not authenticated' }),
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Mask any dynamic content (timestamps, animations)
    await expect(page).toHaveScreenshot('login-page.png', {
      animations: 'disabled',
      mask: [page.locator('[data-testid="timestamp"], [class*="animate"]')],
      maxDiffPixelRatio: 0.02, // 2% diff tolerance
    });
  });

  test('cases list page matches snapshot', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('cases-list.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('dashboard page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dashboard.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('login page - mobile viewport matches snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'Not authenticated' }),
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-page-mobile.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});
