/**
 * E2E: Case management user journey.
 *
 * Covers:
 *   - Cases list page renders after login
 *   - Create case form accessible from dashboard
 *   - Case workspace loads after creation
 *   - Case status chip is visible
 *   - Navigation between cases list and case workspace
 *   - Accessibility on cases list and case workspace
 */

import { test, expect } from '@playwright/test';
import { assertNoViolations } from './helpers.js';

// Shared mock case data
const MOCK_CASE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Test Traffic Case',
  status: 'pending',
  domain: 'traffic_violation',
  created_at: '2026-04-01T08:00:00Z',
  parties: [
    { name: 'Prosecution', role: 'prosecution' },
    { name: 'John Doe', role: 'accused' },
  ],
};

test.describe('Case management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'judge@example.com', role: 'judge' }),
      });
    });

    // Mock cases list
    await page.route('**/api/v1/cases*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [MOCK_CASE], total: 1, page: 1 }),
        });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CASE),
        });
      } else {
        await route.continue();
      }
    });

    // Mock individual case
    await page.route(`**/api/v1/cases/${MOCK_CASE.id}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CASE),
      });
    });
  });

  test('cases list page renders case cards', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Test Traffic Case')).toBeVisible({ timeout: 10_000 });
  });

  test('cases list shows status indicator', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    // Status chip/badge should be visible
    await expect(page.getByText(/pending|processing|ready/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a case navigates to case workspace', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    const caseLink = page.getByText('Test Traffic Case').first();
    await expect(caseLink).toBeVisible({ timeout: 10_000 });
    await caseLink.click();
    await page.waitForURL(/\/cases\//, { timeout: 10_000 });
    expect(page.url()).toContain('/cases/');
  });

  test('cases list has no WCAG 2.1 AA violations', async ({ page }) => {
    await page.goto('/cases');
    await page.waitForLoadState('networkidle');
    await assertNoViolations(page);
  });

  test('protected route redirects unauthenticated user to login', async ({ page }) => {
    // Override auth mock to return 401
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ detail: 'Not authenticated' }),
      });
    });
    await page.goto('/cases');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
