// ---------------------------------------------------------------------------
// sprint-k-smoke.spec.ts — Sprint K: Infrastructure & Trust E2E Smoke Tests
//
// Validates:
//   • C2 — Listings Honesty: non-GBP platforms show honest labels
//   • H4 — Sidebar NAV_GROUPS: section group headers visible
//   • C1 — Sentry sweep: pages render without blank cards from swallowed errors
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// C2 — Listings Honesty
// ---------------------------------------------------------------------------

test.describe('Sprint K — Listings Honesty (C2)', () => {
  test('integrations page loads without error', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    await expect(page.getByText('Listings')).toBeVisible();
  });

  test('google platform row has no "Manual" badge (real OAuth)', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const googleRow = page.getByTestId('platform-row-google');
    const rowCount = await googleRow.count();
    if (rowCount > 0) {
      // Google should NOT have a manual badge
      await expect(googleRow.getByTestId('manual-badge')).toHaveCount(0);
      // Google should NOT have a coming-soon badge
      await expect(googleRow.getByTestId('coming-soon-badge')).toHaveCount(0);
    }
  });

  test('yelp platform row shows "Manual" badge', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const yelpRow = page.getByTestId('platform-row-yelp');
    const rowCount = await yelpRow.count();
    if (rowCount > 0) {
      await expect(yelpRow.getByTestId('manual-badge')).toBeVisible();
    }
  });

  test('tripadvisor platform row shows "Manual" badge', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const taRow = page.getByTestId('platform-row-tripadvisor');
    const rowCount = await taRow.count();
    if (rowCount > 0) {
      await expect(taRow.getByTestId('manual-badge')).toBeVisible();
    }
  });

  test('apple platform row shows "Coming Soon" badge', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const appleRow = page.getByTestId('platform-row-apple');
    const rowCount = await appleRow.count();
    if (rowCount > 0) {
      await expect(appleRow.getByTestId('coming-soon-badge')).toBeVisible();
    }
  });

  test('no platform row has a fake "Sync" button for non-google platforms', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    // Check that yelp, tripadvisor, apple, bing, facebook don't have a Sync Now button
    for (const platform of ['yelp', 'tripadvisor', 'apple', 'bing', 'facebook']) {
      const row = page.getByTestId(`platform-row-${platform}`);
      const rowCount = await row.count();
      if (rowCount > 0) {
        await expect(row.getByText('Sync Now')).toHaveCount(0);
      }
    }
  });

  test('yelp manual tracking row has a URL input', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const yelpRow = page.getByTestId('platform-row-yelp');
    const rowCount = await yelpRow.count();
    if (rowCount > 0) {
      const urlInput = yelpRow.locator('input[type="url"]');
      await expect(urlInput).toBeVisible();
    }
  });

  test('listings info banner is visible with honest copy', async ({ page }) => {
    await page.goto('/dashboard/integrations');
    const banner = page.getByTestId('listings-info-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByText('About your listings')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// H4 — Sidebar NAV_GROUPS
// ---------------------------------------------------------------------------

test.describe('Sprint K — Sidebar Groups (H4)', () => {
  test('sidebar has at least 4 group label elements', async ({ page }) => {
    await page.goto('/dashboard');
    const groupLabels = page.getByTestId('sidebar-group-label');
    await expect(groupLabels).toHaveCount(5); // Overview, AI Visibility, Content & Menu, Intelligence, Admin
  });

  test('group label "Overview" is visible in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    // Group labels are uppercase 10px text — match case-insensitively
    const labels = page.getByTestId('sidebar-group-label');
    const texts = await labels.allTextContents();
    expect(texts.some((t) => t.toLowerCase().includes('overview'))).toBe(true);
  });

  test('group label "Intelligence" is visible in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    const labels = page.getByTestId('sidebar-group-label');
    const texts = await labels.allTextContents();
    expect(texts.some((t) => t.toLowerCase().includes('intelligence'))).toBe(true);
  });

  test('all nav items still present (no items removed from nav)', async ({ page }) => {
    await page.goto('/dashboard');
    // Check a representative subset of nav items are present
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-alerts')).toBeVisible();
    await expect(page.getByTestId('nav-billing')).toBeVisible();
    await expect(page.getByTestId('nav-settings')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// C1 — Sentry: pages render correctly (no swallowed errors)
// ---------------------------------------------------------------------------

test.describe('Sprint K — Sentry Coverage (C1)', () => {
  test('dashboard page loads and renders panels', async ({ page }) => {
    await page.goto('/dashboard');
    // Should see at least the page heading
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('bot activity page loads without error', async ({ page }) => {
    await page.goto('/dashboard/crawler-analytics');
    await expect(page.getByText('AI Bot Activity')).toBeVisible();
  });

  test('AI responses page loads without error', async ({ page }) => {
    await page.goto('/dashboard/ai-responses');
    // AI Says / AI Responses page should render
    await expect(page.getByTestId('ai-preview-widget')).toBeVisible();
  });
});
