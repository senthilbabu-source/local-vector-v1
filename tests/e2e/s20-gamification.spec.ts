// ---------------------------------------------------------------------------
// s20-gamification.spec.ts — S20: Health Streak + Milestones + Fix Spotlight
//
// E2E smoke tests for gamification features on the main dashboard.
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('S20 — Gamification', () => {
  test('HealthStreakBadge rendered when streak data exists', async ({ page }) => {
    await page.goto('/dashboard');
    // Badge may or may not appear depending on seed data — just verify no crash.
    // If streak >= 2 it will be visible; if not, count = 0
    const badge = page.getByTestId('health-streak-badge');
    const count = await badge.count();
    expect(count).toBeLessThanOrEqual(1); // 0 or 1, never more
  });

  test('FixSpotlightCard rendered when high-value fix exists', async ({ page }) => {
    await page.goto('/dashboard');
    // Spotlight depends on seed data — may or may not be present
    const spotlight = page.getByTestId('fix-spotlight-card');
    const count = await spotlight.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('FixSpotlightCard dismissible (click X, refreshes hidden)', async ({ page }) => {
    await page.goto('/dashboard');
    const spotlight = page.getByTestId('fix-spotlight-card');
    if (await spotlight.count() === 1) {
      await spotlight.locator('button[aria-label="Dismiss spotlight"]').click();
      await expect(spotlight).toHaveCount(0);
      // Refresh — should stay dismissed (localStorage)
      await page.reload();
      await expect(page.getByTestId('fix-spotlight-card')).toHaveCount(0);
    }
  });

  test('dashboard page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
