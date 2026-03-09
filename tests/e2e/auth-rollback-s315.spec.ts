/**
 * E2E Tests — §315 Registration Rollback Hardening
 *
 * Verifies user-facing behavior when registration encounters rollback scenarios.
 * Uses page.route() to intercept API calls at the browser level.
 *
 * Run:
 *   npx playwright test tests/e2e/auth-rollback-s315.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('§315: Registration rollback E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to signup page (unauthenticated)
    await page.goto('/register');
  });

  test('shows rollback error message when server returns ROLLED_BACK', async ({ page }) => {
    // Intercept register API to return ROLLED_BACK response
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'User profile not found after creation — Account rolled back. Please try again.',
          code: 'ROLLED_BACK',
        }),
      }),
    );

    // Fill form
    await page.fill('input[name="email"]', 'rollback@test.com');
    await page.fill('input[name="password"]', 'SecureP@ss9');
    await page.fill('input[name="full_name"]', 'Test User');
    await page.fill('input[name="business_name"]', 'Test Biz');

    // Submit
    await page.click('button[type="submit"]');

    // Error banner should appear with retry message
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText('rolled back');
  });

  test('shows contact support message when server returns ROLLBACK_FAILED', async ({ page }) => {
    // Intercept register API to return ROLLBACK_FAILED response
    await page.route('**/api/auth/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'User profile not found — Rollback failed — please contact support.',
          code: 'ROLLBACK_FAILED',
        }),
      }),
    );

    // Fill form
    await page.fill('input[name="email"]', 'orphan@test.com');
    await page.fill('input[name="password"]', 'SecureP@ss9');
    await page.fill('input[name="full_name"]', 'Test User');
    await page.fill('input[name="business_name"]', 'Test Biz');

    // Submit
    await page.click('button[type="submit"]');

    // Error banner should appear with support message
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText('contact support');
  });

  test('successful registration still works after rollback improvements', async ({ page }) => {
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
          message: 'Account created. Please check your email to verify your account.',
        }),
      }),
    );

    // Intercept login API to return success
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

    // Should navigate away from /register (to /verify-email or /dashboard)
    await expect(page).not.toHaveURL(/\/register/, { timeout: 5000 });
  });
});
