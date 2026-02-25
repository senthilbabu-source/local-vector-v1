// ---------------------------------------------------------------------------
// 07-listings.spec.ts — Listings Page E2E (Sprint 42)
//
// Tests the /dashboard/integrations (Listings) page for the dev@ golden tenant.
// Verifies page structure, location cards, platform rows, and summary stats.
//
// Authentication: dev@ session (golden tenant with at least 1 location).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('07 — Listings page', () => {

  test('page loads with correct header', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Page header
    await expect(
      page.getByRole('heading', { name: /Listings/i, level: 1 })
    ).toBeVisible();

    // Description text
    await expect(
      page.getByText(/Big 6 platforms/i)
    ).toBeVisible();
  });

  test('location card renders with business name and platform rows', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // At least one location card should exist (dev@ has "Charcoal N Chill")
    await expect(
      page.getByRole('heading', { name: /Charcoal N Chill/i })
    ).toBeVisible();

    // Should show platform coverage badge
    await expect(
      page.getByText(/platforms connected/i).first()
    ).toBeVisible();

    // Should show at least one platform name in platform rows
    await expect(page.getByText('Google Business Profile').first()).toBeVisible();
    await expect(page.getByText('Yelp for Business').first()).toBeVisible();
    await expect(page.getByText('Tripadvisor').first()).toBeVisible();
  });

  test('summary strip shows location count', async ({ page }) => {
    await page.goto('/dashboard/integrations');

    // Wait for location data to load
    await expect(
      page.getByRole('heading', { name: /Charcoal N Chill/i })
    ).toBeVisible();

    // Summary strip should include a "Locations" stat card
    // Use the main content area to avoid matching sidebar nav
    const main = page.locator('main');
    await expect(main.getByText('Locations', { exact: true })).toBeVisible();
  });

  test('can navigate to Listings page from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Listings' }).click();
    await expect(page).toHaveURL(/\/dashboard\/integrations/);
    await expect(
      page.getByRole('heading', { name: /Listings/i, level: 1 })
    ).toBeVisible();
  });
});
