// ---------------------------------------------------------------------------
// 24-admin-dashboard.spec.ts — Sprint D: Admin Dashboard E2E Tests
//
// Tests admin layout auth guard, navigation, and page rendering.
//
// NOTE: Admin access requires ADMIN_EMAILS env var to include the test user.
// Tests that require admin access use test.skip() when env is not configured.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// Helper — check if admin access is likely available
// ---------------------------------------------------------------------------

// We detect admin access by trying to navigate to /admin and checking
// if we stay there (admin) or get redirected (non-admin).

// ---------------------------------------------------------------------------
// Auth guard tests — these work regardless of ADMIN_EMAILS config
// ---------------------------------------------------------------------------

test.describe('Admin auth guard', () => {
  test('unauthenticated user is redirected away from /admin', async ({ browser }) => {
    // Create a context with NO storage state (unauthenticated)
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/admin');
    // Should redirect to /login (no auth)
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 10_000 });

    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);

    await context.close();
  });

  test('non-admin user is redirected to /dashboard from /admin', async ({ page }) => {
    // With default env (ADMIN_EMAILS not including dev@), this should redirect
    await page.goto('/admin');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    expect(page.url()).toContain('/dashboard');
  });

  test('non-admin user is redirected from /admin/customers', async ({ page }) => {
    await page.goto('/admin/customers');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    expect(page.url()).toContain('/dashboard');
  });

  test('non-admin user is redirected from /admin/api-usage', async ({ page }) => {
    await page.goto('/admin/api-usage');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    expect(page.url()).toContain('/dashboard');
  });

  test('non-admin user is redirected from /admin/cron-health', async ({ page }) => {
    await page.goto('/admin/cron-health');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    expect(page.url()).toContain('/dashboard');
  });

  test('non-admin user is redirected from /admin/revenue', async ({ page }) => {
    await page.goto('/admin/revenue');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    expect(page.url()).toContain('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// Admin page rendering — requires ADMIN_EMAILS to include dev@localvector.ai
// These tests skip when admin access is not configured.
// ---------------------------------------------------------------------------

test.describe('Admin pages (requires ADMIN_EMAILS)', () => {
  // Check once if admin access is available
  let hasAdminAccess = false;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../../.playwright/dev-user.json'),
    });
    const page = await context.newPage();
    await page.goto('/admin');

    // Wait for either /admin content or redirect
    try {
      await page.waitForURL(/\/admin/, { timeout: 5_000 });
      // If we're still on /admin, check if we have the nav
      const heading = page.getByText('Customers');
      hasAdminAccess = (await heading.count()) > 0;
    } catch {
      hasAdminAccess = false;
    }
    await context.close();
  });

  test('admin nav renders with correct links', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/customers');

    await expect(page.getByTestId('admin-nav')).toBeVisible();
    await expect(page.getByRole('link', { name: /Customers/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /API Usage/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cron Health/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Revenue/i })).toBeVisible();
  });

  test('customers page shows customer table', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/customers');

    await expect(page.getByRole('heading', { name: /Customers/i, level: 1 })).toBeVisible();
    await expect(page.getByTestId('admin-customer-table')).toBeVisible();
  });

  test('api-usage page shows usage table', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/api-usage');

    await expect(page.getByRole('heading', { name: /API Usage/i, level: 1 })).toBeVisible();
    await expect(page.getByTestId('admin-api-usage-table')).toBeVisible();
  });

  test('cron-health page shows cron table', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/cron-health');

    await expect(page.getByRole('heading', { name: /Cron Health/i, level: 1 })).toBeVisible();
    await expect(page.getByTestId('admin-cron-table')).toBeVisible();
  });

  test('revenue page shows revenue summary', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/revenue');

    await expect(page.getByRole('heading', { name: /Revenue Summary/i, level: 1 })).toBeVisible();
    // Should show MRR card
    await expect(page.getByText('MRR')).toBeVisible();
    await expect(page.getByText('ARR')).toBeVisible();
  });

  test('/admin redirects to /admin/customers', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin');

    await page.waitForURL(/\/admin\/customers/, { timeout: 5_000 });
    expect(page.url()).toContain('/admin/customers');
  });
});
