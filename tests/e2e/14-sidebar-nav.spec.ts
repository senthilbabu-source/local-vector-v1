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
  // Today (expanded by default)
  'nav-dashboard':          'Today',
  'nav-alerts':             'Today',
  'nav-ai-sentiment':       'Today',
  // How AI Sees You
  'nav-share-of-voice':     'How AI Sees You',
  'nav-ai-says':            'How AI Sees You',
  'nav-ai-assistant':       'How AI Sees You',
  'nav-voice-readiness':    'How AI Sees You',
  // Grow Your Presence
  'nav-menu':               'Grow Your Presence',
  'nav-magic-menu':         'Grow Your Presence',
  'nav-content':            'Grow Your Presence',
  'nav-content-calendar':   'Grow Your Presence',
  'nav-revenue-impact':     'Grow Your Presence',
  // Competitive Edge
  'nav-compete':            'Competitive Edge',
  'nav-benchmarks':         'Competitive Edge',
  'nav-listings':           'Competitive Edge',
  // Advanced
  'nav-page-audits':        'Advanced',
  'nav-citations':          'Advanced',
  'nav-ai-sources':         'Advanced',
  'nav-cluster-map':        'Advanced',
  'nav-bot-activity':       'Advanced',
  'nav-proof-timeline':     'Advanced',
  'nav-entity-health':      'Advanced',
  'nav-agent-readiness':    'Advanced',
  'nav-system-health':      'Advanced',
  'nav-playbooks':          'Advanced',
  'nav-intent-discovery':   'Advanced',
  // Account
  'nav-settings':           'Account',
  'nav-team':               'Account',
  'nav-domain':             'Account',
  'nav-billing':            'Account',
  'nav-locations':          'Account',
  'nav-chat-widget':        'Account',
};

export async function expandSidebarGroup(page: Page, testId: string) {
  const groupName = NAV_TO_GROUP[testId];
  if (!groupName || groupName === 'Today') return; // Today is expanded by default

  const groupButtons = page.getByTestId('sidebar-group-label');
  const count = await groupButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = groupButtons.nth(i);
    const text = await btn.textContent();
    // "Grow Your Presence" renders as "Grow with [noun]" for different industries
    const t = text.trim();
    const matches = t === groupName || (groupName === 'Grow Your Presence' && t.startsWith('Grow'));
    if (text && matches) {
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
    // ── Today ────────────────────────────────────────────────────────────
    { testId: 'nav-dashboard', url: '/dashboard', heading: /Welcome back/i },
    { testId: 'nav-alerts', url: '/dashboard/hallucinations', heading: /Things AI Gets Wrong/i },
    { testId: 'nav-ai-sentiment', url: '/dashboard/sentiment', heading: /How AI Describes/i },
    // ── How AI Sees You ──────────────────────────────────────────────────
    { testId: 'nav-share-of-voice', url: '/dashboard/share-of-voice', heading: /How Often AI Recommends/i },
    { testId: 'nav-ai-says', url: '/dashboard/ai-responses', heading: /AI Says|Responses/i },
    { testId: 'nav-ai-assistant', url: '/dashboard/ai-assistant', heading: /Assistant/i },
    // ── Grow Your Presence ────────────────────────────────────────────────
    { testId: 'nav-magic-menu', url: '/dashboard/magic-menus', heading: /Magic Menu|Magic Services/i },
    { testId: 'nav-content', url: '/dashboard/content-drafts', heading: /Posts Ready for Review/i },
    { testId: 'nav-content-calendar', url: '/dashboard/content-calendar', heading: /Upcoming Opportunities/i },
    { testId: 'nav-revenue-impact', url: '/dashboard/revenue-impact', heading: /What This Costs/i },
    // ── Competitive Edge ──────────────────────────────────────────────────
    { testId: 'nav-compete', url: '/dashboard/compete', heading: /You vs Competitors/i },
    { testId: 'nav-benchmarks', url: '/dashboard/benchmarks', heading: /How You Compare/i },
    { testId: 'nav-listings', url: '/dashboard/integrations', heading: /Listings/i },
    // ── Advanced ──────────────────────────────────────────────────────────
    { testId: 'nav-page-audits', url: '/dashboard/page-audits', heading: /Website Checkup/i },
    { testId: 'nav-citations', url: '/dashboard/citations', heading: /Who.*Talking About You/i },
    { testId: 'nav-bot-activity', url: '/dashboard/crawler-analytics', heading: /Who.*Checking.*Website/i },
    { testId: 'nav-proof-timeline', url: '/dashboard/proof-timeline', heading: /When AI Noticed/i },
    { testId: 'nav-entity-health', url: '/dashboard/entity-health', heading: /Know Your Business|Entity Health/i },
    // ── Account ───────────────────────────────────────────────────────────
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
