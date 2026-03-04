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
      page.getByRole('heading', { name: /Who.*Talking About You/i, level: 1 })
    ).toBeVisible();
  });

  test('shows either gap score data or empty state', async ({ page }) => {
    await page.goto('/dashboard/citations');

    // Either citation data is present or the empty state message shows
    const gapScoreVisible = await page.getByText(/Missing Platforms/i).isVisible().catch(() => false);
    const emptyStateVisible = await page.getByText(/Citation data is being collected/i).isVisible().catch(() => false);
    const noLocationVisible = await page.getByText(/Add a location first/i).isVisible().catch(() => false);

    expect(gapScoreVisible || emptyStateVisible || noLocationVisible).toBe(true);
  });

  test('can navigate to Citations from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    // §200: Citations is in Content group (collapsed by default)
    const group = page.getByTestId('sidebar-group-label').filter({ hasText: /Content/i });
    if ((await group.getAttribute('aria-expanded')) !== 'true') {
      await group.click();
      await page.waitForTimeout(250);
    }
    await page.getByTestId('nav-citations').click();
    await expect(page).toHaveURL(/\/dashboard\/citations/);
    await expect(
      page.getByRole('heading', { name: /Who.*Talking About You/i, level: 1 })
    ).toBeVisible();
  });
});
