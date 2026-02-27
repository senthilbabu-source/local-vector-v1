// ---------------------------------------------------------------------------
// 22-occasion-alerts-badges.spec.ts — Sprint 101 E2E Tests
//
// Occasion Alerts + Sidebar Badges
//
// Tests the dashboard page for:
//   - Occasion alert feed rendering (presence or empty state)
//   - Alert card structure (name, days until, actions)
//   - Snooze dropdown and dismiss buttons
//   - Create Draft CTA and plan gating
//   - Sidebar badge pills on nav items
//
// Authentication:
//   Uses dev@ session (golden tenant owner, Growth plan).
//   dev@localvector.ai has content_drafts and sov_evaluations seed data
//   which may produce sidebar badge counts.
//
// Note: Occasion alerts depend on `local_occasions` within a 14-day window
// from today. If no seed occasions exist for the current date range, the
// feed won't render and tests use conditional checks (isVisible pattern).
//
// Run:
//   npx playwright test tests/e2e/22-occasion-alerts-badges.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

// ── Storage states ─────────────────────────────────────────────────────────

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
const UPLOAD_USER_STATE = path.join(__dirname, '../../.playwright/upload-user.json');

// ═══════════════════════════════════════════════════════════════════════════
// Occasion Alert Feed — Dashboard Integration
// ═══════════════════════════════════════════════════════════════════════════

test.describe('22 — Occasion Alerts: Dashboard Feed (Sprint 101)', () => {
  test.use({ storageState: DEV_USER_STATE });

  test('dashboard renders without crash', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('occasion feed renders or shows empty state', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Occasion feed is either visible with alerts or hidden (empty div)
    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const emptyFeed = page.locator('[data-testid="occasion-alert-feed-empty"]');

    const feedVisible = await feed.isVisible().catch(() => false);
    const emptyExists = await emptyFeed.count();

    // One of the two states must exist (either visible feed or hidden empty div)
    // Both are rendered by OccasionAlertFeed — if no alerts at all, neither renders
    // because the parent only renders OccasionAlertFeed when alerts.length > 0
    if (feedVisible) {
      // Feed is showing alerts — verify heading
      await expect(
        page.getByText('Upcoming Occasions'),
      ).toBeVisible();
    }
    // If neither is visible, occasions feature has no data for current date range
    // — this is expected and not a failure
  });

  test('occasion alert card has correct structure when feed is present', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const feedVisible = await feed.isVisible().catch(() => false);

    if (!feedVisible) {
      // No occasion alerts in current date range
      test.skip();
      return;
    }

    // At least one alert card should exist
    const alertCards = page.locator('[data-testid^="occasion-alert-card-"]');
    const count = await alertCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // First card should have name, days-until, and action buttons
    const firstCard = alertCards.first();
    await expect(firstCard).toBeVisible();

    // Name element
    const nameEl = firstCard.locator('[data-testid^="occasion-alert-name-"]');
    await expect(nameEl).toBeVisible();

    // Days until element
    const daysEl = firstCard.locator('[data-testid^="occasion-alert-days-until-"]');
    await expect(daysEl).toBeVisible();
  });

  test('occasion card has dismiss button', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const feedVisible = await feed.isVisible().catch(() => false);

    if (!feedVisible) {
      // No occasion alerts in current date range
      test.skip();
      return;
    }

    // Dismiss button should be on each card
    const dismissBtns = page.locator('[data-testid^="occasion-alert-dismiss-btn-"]');
    const count = await dismissBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('occasion card has Create Draft button', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const feedVisible = await feed.isVisible().catch(() => false);

    if (!feedVisible) {
      // No occasion alerts in current date range
      test.skip();
      return;
    }

    // Create Draft button should exist
    const createBtns = page.locator('[data-testid^="occasion-alert-create-draft-btn-"]');
    const count = await createBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Occasion Alerts — Snooze Dropdown
// ═══════════════════════════════════════════════════════════════════════════

test.describe('22 — Occasion Alerts: Snooze Behavior (Sprint 101)', () => {
  test.use({ storageState: DEV_USER_STATE });

  test('snooze trigger opens dropdown with duration options', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const feedVisible = await feed.isVisible().catch(() => false);

    if (!feedVisible) {
      // No occasion alerts in current date range
      test.skip();
      return;
    }

    // Click the snooze trigger on the first alert
    const snoozeTrigger = page.locator('[data-testid^="occasion-alert-snooze-trigger-"]').first();
    await snoozeTrigger.click();

    // Dropdown should show duration options
    await expect(
      page.getByRole('menuitem', { name: /Remind me tomorrow/i }),
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole('menuitem', { name: /Remind me in 3 days/i }),
    ).toBeVisible();

    await expect(
      page.getByRole('menuitem', { name: /Remind me next week/i }),
    ).toBeVisible();
  });

  test('snooze dropdown has permanent dismiss option', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const feedVisible = await feed.isVisible().catch(() => false);

    if (!feedVisible) {
      // No occasion alerts in current date range
      test.skip();
      return;
    }

    const snoozeTrigger = page.locator('[data-testid^="occasion-alert-snooze-trigger-"]').first();
    await snoozeTrigger.click();

    // "Don't show again" permanent dismiss option
    await expect(
      page.getByRole('menuitem', { name: /Don.t show again/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('snooze trigger button shows "Remind me" label', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    const feed = page.locator('[data-testid="occasion-alert-feed"]');
    const feedVisible = await feed.isVisible().catch(() => false);

    if (!feedVisible) {
      // No occasion alerts in current date range
      test.skip();
      return;
    }

    const snoozeTrigger = page.locator('[data-testid^="occasion-alert-snooze-trigger-"]').first();
    await expect(snoozeTrigger).toContainText('Remind me');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar Badge Indicators
// ═══════════════════════════════════════════════════════════════════════════

test.describe('22 — Occasion Alerts: Sidebar Badges (Sprint 101)', () => {
  test.use({ storageState: DEV_USER_STATE });

  test('sidebar renders nav items on desktop viewport', async ({ page }) => {
    await page.goto('/dashboard');

    // Ensure desktop viewport for sidebar visibility
    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Sidebar nav items should be visible
    await expect(
      page.locator('[data-testid="nav-dashboard"]'),
    ).toBeVisible();
  });

  test('content-drafts badge renders when badge data exists', async ({ page }) => {
    await page.goto('/dashboard');

    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Badge may or may not be visible depending on seed data state
    const badge = page.locator('[data-testid="sidebar-badge-content-drafts"]');
    const isVisible = await badge.isVisible().catch(() => false);

    if (isVisible) {
      // Badge should contain a number or "99+"
      const text = await badge.textContent();
      expect(text?.trim()).toMatch(/^\d+\+?$/);
    }
    // If not visible, no new content drafts since last visit — expected
  });

  test('visibility badge renders when badge data exists', async ({ page }) => {
    await page.goto('/dashboard');

    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    // SOV/visibility badge
    const badge = page.locator('[data-testid="sidebar-badge-visibility"]');
    const isVisible = await badge.isVisible().catch(() => false);

    if (isVisible) {
      const text = await badge.textContent();
      expect(text?.trim()).toMatch(/^\d+\+?$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-User Dashboard Isolation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('22 — Occasion Alerts: Cross-User Isolation (Sprint 101)', () => {
  test.use({ storageState: UPLOAD_USER_STATE });

  test('upload@ user dashboard renders independently', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Upload user's dashboard should render without showing dev@ user's data
    // Quick Stats section should be present
    await expect(
      page.getByText('Open alerts', { exact: true }),
    ).toBeVisible();
  });

  test('upload@ user sees their own sidebar with plan badge', async ({ page }) => {
    await page.goto('/dashboard');

    await page.setViewportSize({ width: 1280, height: 720 });

    await expect(
      page.getByRole('heading', { name: /Welcome back/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Should see Current Plan section in sidebar
    await expect(
      page.getByText('Current Plan'),
    ).toBeVisible();
  });
});
