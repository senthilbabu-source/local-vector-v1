// ---------------------------------------------------------------------------
// 14-sidebar-nav.spec.ts — Sidebar Navigation E2E (Sprint 60A)
//
// Tests the sidebar data-testid navigation links work correctly.
// Clicks each nav item and verifies the correct page loads.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('14 — Sidebar navigation', () => {

  const navTests = [
    { testId: 'nav-dashboard', url: '/dashboard', heading: /Dashboard/i },
    { testId: 'nav-alerts', url: '/dashboard/hallucinations', heading: /Alerts|Hallucination/i },
    { testId: 'nav-menu', url: '/dashboard/magic-menus', heading: /Menu/i },
    { testId: 'nav-share-of-voice', url: '/dashboard/share-of-voice', heading: /Share of Voice/i },
    { testId: 'nav-content', url: '/dashboard/content-drafts', heading: /Content/i },
    { testId: 'nav-listings', url: '/dashboard/integrations', heading: /Listings/i },
    { testId: 'nav-citations', url: '/dashboard/citations', heading: /Citation/i },
    { testId: 'nav-page-audits', url: '/dashboard/page-audits', heading: /Page Audits/i },
    { testId: 'nav-billing', url: '/dashboard/billing', heading: /Billing|Plan/i },
  ];

  for (const { testId, url, heading } of navTests) {
    test(`sidebar link ${testId} navigates to ${url}`, async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByTestId(testId).click();
      await expect(page).toHaveURL(new RegExp(url.replace(/\//g, '\\/')));
      await expect(
        page.getByRole('heading', { name: heading, level: 1 })
      ).toBeVisible();
    });
  }
});
