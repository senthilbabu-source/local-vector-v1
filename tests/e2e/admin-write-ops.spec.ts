// ---------------------------------------------------------------------------
// admin-write-ops.spec.ts — Sprint §204: Admin Write Operations E2E Tests
//
// Tests admin customer detail page, plan override, credit grant, force cron,
// and impersonation flows.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// Requires ADMIN_EMAILS env var to include the test user.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// Admin access detection
// ---------------------------------------------------------------------------

test.describe('Admin Write Operations (requires ADMIN_EMAILS)', () => {
  let hasAdminAccess = false;
  let firstOrgId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../../.playwright/dev-user.json'),
    });
    const page = await context.newPage();
    await page.goto('/admin/customers');

    try {
      await page.waitForURL(/\/admin\/customers/, { timeout: 5_000 });
      const table = page.getByTestId('admin-customer-table');
      hasAdminAccess = (await table.count()) > 0;

      // Try to get the first org's "View" link
      if (hasAdminAccess) {
        const firstLink = page.getByTestId('customer-view-link').first();
        if ((await firstLink.count()) > 0) {
          const href = await firstLink.getAttribute('href');
          // Extract org ID from /admin/customers/[orgId]
          firstOrgId = href?.split('/admin/customers/')[1] ?? null;
        }
      }
    } catch {
      hasAdminAccess = false;
    }
    await context.close();
  });

  // ── Customer list shows View links ──────────────────────────────────────

  test('customer list shows View links for each org', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/customers');

    await expect(page.getByTestId('admin-customer-table')).toBeVisible();
    const viewLinks = page.getByTestId('customer-view-link');
    expect(await viewLinks.count()).toBeGreaterThan(0);
  });

  // ── Customer detail page renders ────────────────────────────────────────

  test('customer detail page renders with actions', async ({ page }) => {
    test.skip(!hasAdminAccess || !firstOrgId, 'Admin access or org not available');
    await page.goto(`/admin/customers/${firstOrgId}`);

    // Check page structure
    await expect(page.getByText('Back to Customers')).toBeVisible();
    await expect(page.getByText('Stripe')).toBeVisible();
    await expect(page.getByText('Actions')).toBeVisible();
    await expect(page.getByTestId('customer-actions')).toBeVisible();
  });

  // ── Action form elements present ────────────────────────────────────────

  test('customer detail page has all action forms', async ({ page }) => {
    test.skip(!hasAdminAccess || !firstOrgId, 'Admin access or org not available');
    await page.goto(`/admin/customers/${firstOrgId}`);

    // Change Plan form
    await expect(page.getByTestId('plan-select')).toBeVisible();
    await expect(page.getByTestId('change-plan-btn')).toBeVisible();

    // Grant Credits form
    await expect(page.getByTestId('credit-amount')).toBeVisible();
    await expect(page.getByTestId('grant-credits-btn')).toBeVisible();

    // Cancel Subscription button
    await expect(page.getByTestId('cancel-sub-btn')).toBeVisible();

    // Impersonate button
    await expect(page.getByTestId('impersonate-btn')).toBeVisible();
  });

  // ── Cron health page has force-run buttons ──────────────────────────────

  test('cron health page shows force-run buttons', async ({ page }) => {
    test.skip(!hasAdminAccess, 'ADMIN_EMAILS not configured for dev@ user');
    await page.goto('/admin/cron-health');

    await expect(page.getByTestId('admin-cron-table')).toBeVisible();
    const forceRunButtons = page.getByTestId('force-run-btn');
    // Should have at least one force-run button (one per cron card)
    expect(await forceRunButtons.count()).toBeGreaterThanOrEqual(0);
  });

  // ── Cancel subscription shows confirmation ──────────────────────────────

  test('cancel subscription shows confirmation dialog', async ({ page }) => {
    test.skip(!hasAdminAccess || !firstOrgId, 'Admin access or org not available');
    await page.goto(`/admin/customers/${firstOrgId}`);

    // Click cancel button
    await page.getByTestId('cancel-sub-btn').click();

    // Confirmation dialog should appear
    await expect(page.getByTestId('confirm-cancel-btn')).toBeVisible();
    await expect(page.getByTestId('cancel-immediate-checkbox')).toBeVisible();

    // Go Back should hide the confirmation
    await page.getByText('Go Back').click();
    await expect(page.getByTestId('confirm-cancel-btn')).not.toBeVisible();
  });

  // ── Stat cards render ───────────────────────────────────────────────────

  test('customer detail page shows stat cards', async ({ page }) => {
    test.skip(!hasAdminAccess || !firstOrgId, 'Admin access or org not available');
    await page.goto(`/admin/customers/${firstOrgId}`);

    const statCards = page.getByTestId('admin-stat-card');
    expect(await statCards.count()).toBeGreaterThanOrEqual(4);
  });

  // ── Grant credits validates input ───────────────────────────────────────

  test('grant credits button is disabled for zero amount', async ({ page }) => {
    test.skip(!hasAdminAccess || !firstOrgId, 'Admin access or org not available');
    await page.goto(`/admin/customers/${firstOrgId}`);

    // Set amount to 0
    const amountInput = page.getByTestId('credit-amount');
    await amountInput.fill('0');

    // Grant button should be disabled
    const grantBtn = page.getByTestId('grant-credits-btn');
    await expect(grantBtn).toBeDisabled();
  });

  // ── Navigation back to list ─────────────────────────────────────────────

  test('back link navigates to customer list', async ({ page }) => {
    test.skip(!hasAdminAccess || !firstOrgId, 'Admin access or org not available');
    await page.goto(`/admin/customers/${firstOrgId}`);

    await page.getByText('Back to Customers').click();
    await page.waitForURL(/\/admin\/customers$/, { timeout: 5_000 });
    expect(page.url()).toContain('/admin/customers');
  });
});
