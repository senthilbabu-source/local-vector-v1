// ---------------------------------------------------------------------------
// 13-page-audits.spec.ts — Page Audits Page E2E (Sprint 60A)
//
// Tests the /dashboard/page-audits page.
// The dev@ golden tenant is on Growth plan, so the full page renders.
// If no page_audits rows are seeded, empty state is expected.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('13 — Page Audits page', () => {

  test('page loads with correct heading', async ({ page }) => {
    await page.goto('/dashboard/page-audits');

    await expect(
      page.getByRole('heading', { name: /Page Audits/i, level: 1 })
    ).toBeVisible();
  });

  test('shows either audit cards or empty state', async ({ page }) => {
    await page.goto('/dashboard/page-audits');

    // Either audit data renders or the empty state
    const auditCardsVisible = await page.getByText(/Audited Pages/i).isVisible().catch(() => false);
    const emptyStateVisible = await page.getByText(/No page audits yet/i).isVisible().catch(() => false);

    expect(auditCardsVisible || emptyStateVisible).toBe(true);
  });

  test('can navigate to Page Audits from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('nav-page-audits').click();
    await expect(page).toHaveURL(/\/dashboard\/page-audits/);
    await expect(
      page.getByRole('heading', { name: /Page Audits/i, level: 1 })
    ).toBeVisible();
  });
});
