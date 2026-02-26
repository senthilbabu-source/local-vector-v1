// ---------------------------------------------------------------------------
// 12-citations.spec.ts — Citations Page E2E (Sprint 60A)
//
// Tests the /dashboard/citations page.
// The dev@ golden tenant is on Growth plan, so the full page renders.
// If no citation data is seeded, empty state is expected.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('12 — Citations page', () => {

  test('page loads with correct heading', async ({ page }) => {
    await page.goto('/dashboard/citations');

    await expect(
      page.getByRole('heading', { name: /Citation Intelligence/i, level: 1 })
    ).toBeVisible();
  });

  test('shows either gap score data or empty state', async ({ page }) => {
    await page.goto('/dashboard/citations');

    // Either citation data is present or the empty state message shows
    const gapScoreVisible = await page.getByText(/Gap Score/i).isVisible().catch(() => false);
    const emptyStateVisible = await page.getByText(/Citation data is being collected/i).isVisible().catch(() => false);
    const noLocationVisible = await page.getByText(/Add a location first/i).isVisible().catch(() => false);

    expect(gapScoreVisible || emptyStateVisible || noLocationVisible).toBe(true);
  });

  test('can navigate to Citations from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-citations').click();
    await expect(page).toHaveURL(/\/dashboard\/citations/);
    await expect(
      page.getByRole('heading', { name: /Citation Intelligence/i, level: 1 })
    ).toBeVisible();
  });
});
