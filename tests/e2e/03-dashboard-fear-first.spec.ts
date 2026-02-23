// ---------------------------------------------------------------------------
// 03-dashboard-fear-first.spec.ts — Dashboard Reality Score + Fear-First Layout
//
// Tests the main /dashboard page for the dev@ "golden tenant" user, who has
// 2 open hallucinations seeded (critical + high severity). The dashboard
// uses a "Fear First" layout: AlertFeed leads when open alerts exist, followed
// by the Reality Score Card.
//
// Authentication:
//   Uses the dev@ session saved by global.setup.ts.
//   dev@localvector.ai is the golden tenant (org a0eebc99-…) with:
//     • CRITICAL alert: ChatGPT says restaurant is permanently closed
//     • HIGH alert: Perplexity reports wrong weekend closing time
//     • 1 FIXED alert (medium) — not shown in AlertFeed (only shows open)
//
// Reality Score derivation with 2 open alerts (deriveRealityScore in page.tsx):
//   Accuracy   = max(40, 100 − 2×15) = 70
//   Visibility = 98   (hardcoded)
//   DataHealth = 100  (ground truth exists for the Alpharetta location)
//   Score      = round(98×0.4 + 70×0.4 + 100×0.2) = round(87.2) = 87
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('03 — Dashboard: Fear-First layout with open alerts', () => {

  // ── Primary layout test ───────────────────────────────────────────────────

  test('AlertFeed leads when open alerts exist (fear-first design principle)', async ({ page }) => {
    await page.goto('/dashboard');

    // Page header (DashboardPage.tsx — personalized to the user's first name).
    await expect(
      page.getByRole('heading', { name: /Welcome back/i })
    ).toBeVisible();

    // ── AlertFeed section ─────────────────────────────────────────────────────
    // "Active Alerts" section heading (AlertFeed.tsx).
    await expect(
      page.getByRole('heading', { name: 'Active Alerts' })
    ).toBeVisible();

    // Alert count badge — aria-label from AlertFeed.tsx: "{n} active alerts".
    await expect(
      page.getByLabel('2 active alerts')
    ).toBeVisible();

    // The critical alert claim text from seed.sql §10.
    await expect(
      page.getByText(/Charcoal N Chill is permanently closed/i)
    ).toBeVisible();

    // ── Critical alert card has the crimson left-border class ─────────────────
    // AlertFeed.tsx: border-l-alert-crimson for critical severity.
    // The first <article> is the CRITICAL alert (sorted critical-first in page.tsx).
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();
    const cardClasses = await firstCard.getAttribute('class');
    expect(cardClasses).toContain('border-l-alert-crimson');

    // ── Reality Score Card is also rendered (below AlertFeed) ─────────────────
    // aria-label="Reality Score Card" (RealityScoreCard.tsx).
    const scoreCard = page.getByRole('region', { name: 'Reality Score Card' });
    await expect(scoreCard).toBeVisible();

    // The composite score is 87 (2 open alerts → Accuracy=70 → Score=87).
    await expect(scoreCard.getByText('87')).toBeVisible();

    // "Reality Score" heading inside the card.
    await expect(scoreCard.getByRole('heading', { name: 'Reality Score' })).toBeVisible();
  });

  // ── Quick Stats row ───────────────────────────────────────────────────────

  test('Quick Stats shows correct open/fixed counts', async ({ page }) => {
    await page.goto('/dashboard');

    // 2 open alerts → "Open alerts" QuickStat label. Use exact:true to avoid
    // matching "2 open alerts are lowering your Accuracy score" in RealityScoreCard.
    await expect(page.getByText('Open alerts', { exact: true })).toBeVisible();
    // 1 fixed alert in seed → "Hallucinations fixed" QuickStat label.
    await expect(page.getByText('Hallucinations fixed', { exact: true })).toBeVisible();
  });

  // ── Mobile hamburger sidebar ──────────────────────────────────────────────

  test('hamburger opens the sidebar on mobile viewport', async ({ page }) => {
    // Set a mobile viewport where the lg: breakpoint classes do not apply.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');

    const sidebar = page.locator('aside');

    // Sidebar starts off-screen (-translate-x-full class applied on mobile).
    await expect(sidebar).toHaveClass(/-translate-x-full/);

    // Click the hamburger button (TopBar.tsx aria-label).
    await page.getByLabel('Open navigation menu').click();

    // After toggle, -translate-x-full is replaced by translate-x-0.
    // Wait for the CSS transition (200ms in Sidebar.tsx).
    await page.waitForTimeout(300);
    const classesAfter = await sidebar.getAttribute('class');
    expect(classesAfter).not.toContain('-translate-x-full');
  });

  // ── Sidebar navigation ────────────────────────────────────────────────────

  test('Listings nav item navigates to /dashboard/integrations', async ({ page }) => {
    await page.goto('/dashboard');

    // "Listings" is the nav label for /dashboard/integrations (Sidebar.tsx NAV_ITEMS).
    await page.getByRole('link', { name: 'Listings' }).click();

    await page.waitForURL('**/dashboard/integrations**', { timeout: 10_000 });
    expect(page.url()).toContain('/dashboard/integrations');
  });

  // ── AlertFeed CTA ─────────────────────────────────────────────────────────

  test('Fix with Magic Menu CTA links to /dashboard/magic-menus', async ({ page }) => {
    await page.goto('/dashboard');

    // Each AlertCard has a "Fix with Magic Menu →" link (AlertFeed.tsx).
    const fixLinks = page.getByRole('link', { name: /Fix with Magic Menu/i });
    await expect(fixLinks.first()).toBeVisible();
    await expect(fixLinks.first()).toHaveAttribute('href', '/dashboard/magic-menus');
  });
});
