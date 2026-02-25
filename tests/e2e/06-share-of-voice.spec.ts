// ---------------------------------------------------------------------------
// 06-share-of-voice.spec.ts — Share of Voice Page E2E (Sprint 42)
//
// Tests the /dashboard/share-of-voice page for the dev@ golden tenant.
// Verifies page structure, SOV Score Ring, Query Library, and query management.
//
// Authentication: dev@ session (golden tenant, trial plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('06 — Share of Voice page', () => {

  test('page loads with correct header and sections', async ({ page }) => {
    await page.goto('/dashboard/share-of-voice');

    // Page header
    await expect(
      page.getByRole('heading', { name: /AI Share of Voice/i, level: 1 })
    ).toBeVisible();

    // SOV Score Ring should render (either with data or calculating state)
    await expect(page.getByTestId('sov-score-ring')).toBeVisible();

    // Query Library section heading
    await expect(
      page.getByRole('heading', { name: /Query Library/i })
    ).toBeVisible();
  });

  test('SOV Score Ring renders in calculating or data state', async ({ page }) => {
    await page.goto('/dashboard/share-of-voice');

    const ring = page.getByTestId('sov-score-ring');
    await expect(ring).toBeVisible();

    // Either shows a percentage (data) or the calculating message (no data)
    const hasPercentage = await page.getByTestId('sov-percentage').isVisible().catch(() => false);
    if (!hasPercentage) {
      // Calculating state — should show the Sunday scan message
      await expect(ring.getByText(/First AI visibility scan runs Sunday/i)).toBeVisible();
    }
  });

  test('Quick Stats section shows location and query counts', async ({ page }) => {
    await page.goto('/dashboard/share-of-voice');

    await expect(page.getByText('Queries Tracked')).toBeVisible();
    await expect(page.getByText('Locations')).toBeVisible();
    await expect(page.getByText('Last Scan')).toBeVisible();
  });

  test('can navigate to SOV page from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Share of Voice' }).click();
    await expect(page).toHaveURL(/\/dashboard\/share-of-voice/);
    await expect(
      page.getByRole('heading', { name: /AI Share of Voice/i, level: 1 })
    ).toBeVisible();
  });
});
