// ---------------------------------------------------------------------------
// 14-sidebar-nav.spec.ts — Sidebar Navigation E2E (Sprint 60A)
//
// Tests the sidebar data-testid navigation links work correctly.
// Clicks each nav item and verifies the correct page loads.
// Since §200 (collapsible sidebar groups), only "Overview" is expanded by
// default. Other groups must be expanded before clicking their items.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect, type Page } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// Helper: expand a sidebar group by clicking its header button
// ---------------------------------------------------------------------------

const NAV_TO_GROUP: Record<string, string> = {
  'nav-dashboard': 'Overview',
  'nav-alerts': 'Overview',
  'nav-share-of-voice': 'How AI Sees You',
  'nav-cluster-map': 'How AI Sees You',
  'nav-ai-says': 'How AI Sees You',
  'nav-ai-sentiment': 'How AI Sees You',
  'nav-ai-sources': 'How AI Sees You',
  'nav-bot-activity': 'How AI Sees You',
  'nav-menu': 'Content',
  'nav-magic-menu': 'Content',
  'nav-content': 'Content',
  'nav-content-calendar': 'Content',
  'nav-page-audits': 'Content',
  'nav-citations': 'Content',
  'nav-proof-timeline': 'Content',
  'nav-compete': 'Insights',
  'nav-revenue-impact': 'Insights',
  'nav-benchmarks': 'Insights',
  'nav-agent-readiness': 'Insights',
  'nav-entity-health': 'Insights',
  'nav-playbooks': 'Insights',
  'nav-intent-discovery': 'Insights',
  'nav-ai-assistant': 'Admin',
  'nav-listings': 'Admin',
  'nav-locations': 'Admin',
  'nav-system-health': 'Admin',
  'nav-settings': 'Admin',
  'nav-chat-widget': 'Admin',
  'nav-team': 'Admin',
  'nav-domain': 'Admin',
  'nav-billing': 'Admin',
};

export async function expandSidebarGroup(page: Page, testId: string) {
  const groupName = NAV_TO_GROUP[testId];
  if (!groupName || groupName === 'Overview') return; // Overview is expanded by default

  const groupButtons = page.getByTestId('sidebar-group-label');
  const count = await groupButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = groupButtons.nth(i);
    const text = await btn.textContent();
    // Content group has dynamic suffix like "Content & Dishes"
    if (text && (text.trim() === groupName || text.trim().startsWith(groupName))) {
      const expanded = await btn.getAttribute('aria-expanded');
      if (expanded !== 'true') {
        await btn.click();
        await page.waitForTimeout(250);
      }
      break;
    }
  }
}

test.describe('14 — Sidebar navigation', () => {

  const navTests = [
    // ── Overview ─────────────────────────────────────────────────────────
    { testId: 'nav-dashboard', url: '/dashboard', heading: /Welcome back/i },
    { testId: 'nav-alerts', url: '/dashboard/hallucinations', heading: /Things AI Gets Wrong/i },
    // ── How AI Sees You ─────────────────────────────────────────────────────
    { testId: 'nav-share-of-voice', url: '/dashboard/share-of-voice', heading: /How Often AI Recommends/i },
    { testId: 'nav-cluster-map', url: '/dashboard/cluster-map', heading: /Where You Stand/i },
    { testId: 'nav-ai-says', url: '/dashboard/ai-responses', heading: /AI Says|Responses/i },
    { testId: 'nav-ai-sentiment', url: '/dashboard/sentiment', heading: /How AI Describes/i },
    { testId: 'nav-ai-sources', url: '/dashboard/source-intelligence', heading: /What AI Reads/i },
    { testId: 'nav-bot-activity', url: '/dashboard/crawler-analytics', heading: /Who.*Checking.*Website/i },
    // ── Content ────────────────────────────────────────────────────
    { testId: 'nav-magic-menu', url: '/dashboard/magic-menus', heading: /Magic Menu|Magic Services/i },
    { testId: 'nav-content', url: '/dashboard/content-drafts', heading: /Posts Ready for Review/i },
    { testId: 'nav-content-calendar', url: '/dashboard/content-calendar', heading: /Upcoming Opportunities/i },
    { testId: 'nav-page-audits', url: '/dashboard/page-audits', heading: /Website Checkup/i },
    { testId: 'nav-citations', url: '/dashboard/citations', heading: /Who.*Talking About You/i },
    { testId: 'nav-proof-timeline', url: '/dashboard/proof-timeline', heading: /When AI Noticed/i },
    // ── Insights ──────────────────────────────────────────────────────
    { testId: 'nav-compete', url: '/dashboard/compete', heading: /You vs Competitors/i },
    { testId: 'nav-revenue-impact', url: '/dashboard/revenue-impact', heading: /What This Costs/i },
    { testId: 'nav-benchmarks', url: '/dashboard/benchmarks', heading: /How You Compare/i },
    { testId: 'nav-agent-readiness', url: '/dashboard/agent-readiness', heading: /Can AI Book/i },
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

      // Expand the sidebar group containing this nav item (§200: collapsible groups)
      await expandSidebarGroup(page, testId);

      await page.getByTestId(testId).click();
      await expect(page).toHaveURL(new RegExp(url.replace(/\//g, '\\/')));
      await expect(
        page.getByRole('heading', { name: heading, level: 1 })
      ).toBeVisible();
    });
  }
});
