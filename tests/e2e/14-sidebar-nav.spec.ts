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
    // ── Overview ─────────────────────────────────────────────────────────
    { testId: 'nav-dashboard', url: '/dashboard', heading: /Welcome back/i },
    { testId: 'nav-alerts', url: '/dashboard/hallucinations', heading: /Truth Audit/i },
    // ── AI Visibility ─────────────────────────────────────────────────────
    { testId: 'nav-share-of-voice', url: '/dashboard/share-of-voice', heading: /Share of Voice/i },
    { testId: 'nav-cluster-map', url: '/dashboard/cluster-map', heading: /Where Does AI Place You/i },
    { testId: 'nav-ai-says', url: '/dashboard/ai-responses', heading: /AI Says|Responses/i },
    { testId: 'nav-ai-sentiment', url: '/dashboard/sentiment', heading: /Sentiment/i },
    { testId: 'nav-ai-sources', url: '/dashboard/source-intelligence', heading: /What AI Reads/i },
    { testId: 'nav-bot-activity', url: '/dashboard/crawler-analytics', heading: /Bot|Crawler/i },
    // ── Content & Menu ────────────────────────────────────────────────────
    { testId: 'nav-magic-menu', url: '/dashboard/magic-menus', heading: /Magic Menu|Magic Services/i },
    { testId: 'nav-content', url: '/dashboard/content-drafts', heading: /Content/i },
    { testId: 'nav-content-calendar', url: '/dashboard/content-calendar', heading: /Calendar/i },
    { testId: 'nav-page-audits', url: '/dashboard/page-audits', heading: /Page Audits/i },
    { testId: 'nav-citations', url: '/dashboard/citations', heading: /Citation/i },
    { testId: 'nav-proof-timeline', url: '/dashboard/proof-timeline', heading: /Before.*After|Visibility Journey/i },
    // ── Intelligence ──────────────────────────────────────────────────────
    { testId: 'nav-compete', url: '/dashboard/compete', heading: /Competitor Intercept/i },
    { testId: 'nav-revenue-impact', url: '/dashboard/revenue-impact', heading: /Revenue/i },
    { testId: 'nav-agent-readiness', url: '/dashboard/agent-readiness', heading: /Take Action|Agent Readiness/i },
    { testId: 'nav-entity-health', url: '/dashboard/entity-health', heading: /Know Your Business|Entity Health/i },
    // ── Admin ─────────────────────────────────────────────────────────────
    { testId: 'nav-ai-assistant', url: '/dashboard/ai-assistant', heading: /Assistant/i },
    { testId: 'nav-listings', url: '/dashboard/integrations', heading: /Listings/i },
    { testId: 'nav-locations', url: '/dashboard/settings/locations', heading: /Locations/i },
    { testId: 'nav-settings', url: '/dashboard/settings', heading: /Settings/i },
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
