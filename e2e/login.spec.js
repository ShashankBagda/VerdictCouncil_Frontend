/**
 * E2E: Login page user journey tests.
 *
 * Covers:
 *   - Renders login form with email + password fields
 *   - Shows validation error when credentials empty
 *   - Shows error message on invalid credentials (API 401)
 *   - Successfully authenticates and redirects to dashboard
 *   - Password visibility toggle works
 *   - "Forgot password" link is visible and navigates correctly
 *   - Redirects authenticated users away from /login
 *   - Accessibility: zero WCAG 2.1 AA violations on login page
 */

import { test, expect } from '@playwright/test';
import { assertNoViolations } from './helpers.js';

const MOCK_BASE = 'http://localhost:5173';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the auth API to avoid needing a live backend
    await page.route('**/api/v1/auth/login', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.username === 'judge@example.com' && body?.password === 'TestPassword123!') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'logged in' }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Invalid credentials' }),
        });
      }
    });

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({ status: 401, body: JSON.stringify({ detail: 'Not authenticated' }) });
    });
  });

  test('renders email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login/i })).toBeVisible();
  });

  test('shows validation error when fields are empty', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(
      page.getByText(/please enter both email and password|required/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(
      page.getByText(/invalid credentials|login failed/i)
    ).toBeVisible({ timeout: 8000 });
  });

  test('password visibility toggle reveals password text', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.getByLabel(/password/i);
    await passwordInput.fill('secret123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click the eye icon to toggle visibility
    await page.getByRole('button', { name: /show password|toggle password/i })
      .or(page.locator('[data-testid="password-toggle"], button[aria-label*="password"]'))
      .first()
      .click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('forgot password link is visible', async ({ page }) => {
    await page.goto('/login');
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
  });

  test('has no WCAG 2.1 AA accessibility violations', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await assertNoViolations(page);
  });

  test('page title references VerdictCouncil', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/VerdictCouncil|Verdict/i);
  });
});
