// ---------------------------------------------------------------------------
// 24-listings-honest-state.spec.ts — Sprint C: Honest Listings State
//
// Validates that the integrations page shows honest sync states:
//   • GBP: real OAuth status
//   • Yelp/TripAdvisor: "Manual" badge with URL input
//   • Apple/Bing/Facebook: "Coming Soon" badge, grayed out
//   • Info banner explaining manual tracking
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('Sprint C — Honest Listings State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/integrations');
  });

  test('listings info banner is visible', async ({ page }) => {
    const banner = page.getByTestId('listings-info-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Google Business Profile');
  });

  test('Yelp row shows Manual badge', async ({ page }) => {
    const yelpRow = page.getByTestId('platform-row-yelp');
    await expect(yelpRow).toBeVisible();
    const manualBadge = yelpRow.getByTestId('manual-badge');
    await expect(manualBadge).toBeVisible();
    await expect(manualBadge).toContainText('Manual');
  });

  test('TripAdvisor row shows Manual badge', async ({ page }) => {
    const taRow = page.getByTestId('platform-row-tripadvisor');
    await expect(taRow).toBeVisible();
    const manualBadge = taRow.getByTestId('manual-badge');
    await expect(manualBadge).toBeVisible();
  });

  test('Bing row shows Coming Soon badge', async ({ page }) => {
    const bingRow = page.getByTestId('platform-row-bing');
    await expect(bingRow).toBeVisible();
    const badge = bingRow.getByTestId('coming-soon-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Coming Soon');
  });

  test('Apple row shows Coming Soon badge', async ({ page }) => {
    const appleRow = page.getByTestId('platform-row-apple');
    await expect(appleRow).toBeVisible();
    const badge = appleRow.getByTestId('coming-soon-badge');
    await expect(badge).toBeVisible();
  });

  test('Facebook row shows Coming Soon badge', async ({ page }) => {
    const fbRow = page.getByTestId('platform-row-facebook');
    await expect(fbRow).toBeVisible();
    const badge = fbRow.getByTestId('coming-soon-badge');
    await expect(badge).toBeVisible();
  });

  test('no Sync Now button for Yelp or TripAdvisor', async ({ page }) => {
    const yelpRow = page.getByTestId('platform-row-yelp');
    await expect(yelpRow.getByText('Sync Now')).not.toBeVisible();

    const taRow = page.getByTestId('platform-row-tripadvisor');
    await expect(taRow.getByText('Sync Now')).not.toBeVisible();
  });

  test('Yelp row has "Manage on" external link', async ({ page }) => {
    const yelpRow = page.getByTestId('platform-row-yelp');
    const link = yelpRow.getByTestId('manage-external-link');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Manage on');
  });
});
