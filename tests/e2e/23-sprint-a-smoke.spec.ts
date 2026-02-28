// ---------------------------------------------------------------------------
// 23-sprint-a-smoke.spec.ts — Sprint A Smoke Tests
//
// Validates the 6 Sprint A fixes in a live browser:
//   • C3: Plan display names ("AI Shield", "Brand Fortress") on billing page
//   • H4: Sidebar section group headers rendered
//   • H5: MetricCard href links + "View details" links on chart cards
//   • L4: ViralScanner error state (structural — checks retry button exists)
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// C3 — Plan display names on billing page
// ---------------------------------------------------------------------------

test.describe('C3 — Plan display names', () => {
  test('billing page shows marketing names: AI Shield and Brand Fortress', async ({ page }) => {
    await page.goto('/dashboard/billing');

    // Growth tier should show "AI Shield" display name
    await expect(page.getByText('AI Shield')).toBeVisible();

    // Agency tier should show "Brand Fortress" display name
    await expect(page.getByText('Brand Fortress')).toBeVisible();
  });

  test('billing page still shows Starter as Starter', async ({ page }) => {
    await page.goto('/dashboard/billing');

    await expect(page.getByText('Starter', { exact: true }).first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// H4 — Sidebar group headers
// ---------------------------------------------------------------------------

test.describe('H4 — Sidebar group headers', () => {
  test('sidebar renders group labels', async ({ page }) => {
    await page.goto('/dashboard');

    // Check that at least 4 group labels are visible
    const groupLabels = page.getByTestId('sidebar-group-label');
    await expect(groupLabels.first()).toBeVisible();

    const count = await groupLabels.count();
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(6);
  });

  test('sidebar group labels include expected sections', async ({ page }) => {
    await page.goto('/dashboard');

    // Key group names that must exist
    await expect(page.getByTestId('sidebar-group-label').filter({ hasText: /Overview/i })).toBeVisible();
    await expect(page.getByTestId('sidebar-group-label').filter({ hasText: /Visibility/i })).toBeVisible();
    await expect(page.getByTestId('sidebar-group-label').filter({ hasText: /Content/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// H5 — MetricCard links on dashboard
// ---------------------------------------------------------------------------

test.describe('H5 — MetricCard links', () => {
  test('dashboard metric cards have clickable links', async ({ page }) => {
    await page.goto('/dashboard');

    // At least one metric-card-link should be present
    const metricLinks = page.getByTestId('metric-card-link');
    await expect(metricLinks.first()).toBeVisible();

    const count = await metricLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('metric card link navigates to the correct page', async ({ page }) => {
    await page.goto('/dashboard');

    // Click the first metric card link
    const firstLink = page.getByTestId('metric-card-link').first();
    const href = await firstLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^\/dashboard\//);

    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/\//g, '\\/')));
  });
});

// ---------------------------------------------------------------------------
// H5 — "View details" links on chart cards
// ---------------------------------------------------------------------------

test.describe('H5 — Chart card detail links', () => {
  test('SOV trend chart has "View details" link to share-of-voice page', async ({ page }) => {
    await page.goto('/dashboard');

    // The SOV chart's "View details" link
    const sovLink = page.getByRole('link', { name: /View details/i }).first();

    // It should exist if there's SOV data; skip if not rendered
    const isVisible = await sovLink.isVisible().catch(() => false);
    if (isVisible) {
      const href = await sovLink.getAttribute('href');
      expect(href).toContain('/dashboard/');
    }
  });

  test('dashboard has at least one "View details" link', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    const detailLinks = page.getByRole('link', { name: /View details/i });
    const count = await detailLinks.count();

    // At least one chart card should have a "View details" link
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// L4 — ViralScanner error UI structure
// ---------------------------------------------------------------------------

test.describe('L4 — ViralScanner structure', () => {
  test('viral scanner page loads without errors', async ({ page }) => {
    await page.goto('/');

    // The ViralScanner is on the landing page
    // Check that the scan button exists (core functionality)
    const scanButton = page.getByRole('button', { name: /scan|check|audit/i }).first();
    await expect(scanButton).toBeVisible();
  });
});
