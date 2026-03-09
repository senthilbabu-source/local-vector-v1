/**
 * E2E Tests — §317 Cloudflare Turnstile CAPTCHA
 *
 * Verifies user-facing behavior when CAPTCHA verification fails or succeeds.
 * Uses page.route() to intercept API calls at the browser level.
 *
 * Run:
 *   npx playwright test tests/e2e/auth-captcha-s317.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('§317: CAPTCHA on registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('shows CAPTCHA error when server returns CAPTCHA_FAILED', async ({ page }) => {
    // Intercept register API to return CAPTCHA failure
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'CAPTCHA verification failed. Please try again.',
          code: 'CAPTCHA_FAILED',
        }),
      }),
    );

    // Fill form
    await page.fill('input[name="email"]', 'captcha@test.com');
    await page.fill('input[name="password"]', 'SecureP@ss9');
    await page.fill('input[name="full_name"]', 'Test User');
    await page.fill('input[name="business_name"]', 'Test Biz');

    // Submit
    await page.click('button[type="submit"]');

    // Error banner should appear with CAPTCHA message
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText('CAPTCHA');
  });

  test('registration succeeds when CAPTCHA passes', async ({ page }) => {
    // Intercept register API to return success
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 'test-uuid',
          org_id: 'org-uuid',
          org_name: 'Test Biz',
          email_verification_required: true,
          message: 'Account created.',
        }),
      }),
    );

    // Intercept login API
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user_id: 'test-uuid',
          email: 'success@test.com',
          email_verified: false,
          session: { access_token: 'tok', refresh_token: 'rt', expires_at: 9999 },
        }),
      }),
    );

    // Fill form
    await page.fill('input[name="email"]', 'success@test.com');
    await page.fill('input[name="password"]', 'SecureP@ss9');
    await page.fill('input[name="full_name"]', 'Success User');
    await page.fill('input[name="business_name"]', 'Success Biz');

    // Submit
    await page.click('button[type="submit"]');

    // Should navigate away from /register
    await expect(page).not.toHaveURL(/\/register/, { timeout: 5000 });
  });
});
