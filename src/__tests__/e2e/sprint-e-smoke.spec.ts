import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Sprint E — E2E Smoke Tests
//
// Covers: Industry config sidebar rendering, GuidedTour new steps,
// FirstVisitTooltip visibility and dismissal on jargon-heavy pages.
// ---------------------------------------------------------------------------

test.describe('Sprint E — Sidebar nav data-testid attributes', () => {
  test('nav-share-of-voice data-testid exists on Share of Voice nav item', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="sidebar-group-label"]');
    const el = page.locator('[data-testid="nav-share-of-voice"]');
    await expect(el).toBeVisible();
  });

  test('nav-citations data-testid exists on Citations nav item', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="sidebar-group-label"]');
    const el = page.locator('[data-testid="nav-citations"]');
    await expect(el).toBeVisible();
  });

  test('nav-revenue-impact data-testid exists on Revenue Impact nav item', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="sidebar-group-label"]');
    const el = page.locator('[data-testid="nav-revenue-impact"]');
    await expect(el).toBeVisible();
  });

  test('restaurant org: Sidebar shows "Magic Menu" label', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="sidebar-group-label"]');
    const el = page.locator('[data-testid="nav-magic-menu"]');
    await expect(el).toBeVisible();
    await expect(el).toHaveText(/Magic Menu/);
  });
});

test.describe('Sprint E — FirstVisitTooltip on entity-health', () => {
  test('tooltip is visible on first visit to entity-health page', async ({ page }) => {
    // Clear any previous visit state
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.removeItem('lv_visited_pages'));

    await page.goto('/dashboard/entity-health');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-entity-health"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('clicking dismiss hides entity-health tooltip', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.removeItem('lv_visited_pages'));

    await page.goto('/dashboard/entity-health');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-entity-health"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });

    await page.locator('[data-testid="first-visit-dismiss-entity-health"]').click();
    await expect(tooltip).not.toBeVisible();
  });

  test('tooltip is NOT visible on second visit after dismiss', async ({ page }) => {
    await page.goto('/dashboard');
    // Simulate having already visited
    await page.evaluate(() => {
      localStorage.setItem('lv_visited_pages', JSON.stringify(['entity-health']));
    });

    await page.goto('/dashboard/entity-health');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-entity-health"]');
    await expect(tooltip).not.toBeVisible();
  });
});

test.describe('Sprint E — FirstVisitTooltip on other pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.removeItem('lv_visited_pages'));
  });

  test('agent-readiness tooltip visible on first visit', async ({ page }) => {
    await page.goto('/dashboard/agent-readiness');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-agent-readiness"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('cluster-map tooltip visible on first visit', async ({ page }) => {
    await page.goto('/dashboard/cluster-map');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-cluster-map"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('ai-sentiment tooltip visible on first visit', async ({ page }) => {
    await page.goto('/dashboard/sentiment');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-ai-sentiment"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('bot-activity tooltip visible on first visit', async ({ page }) => {
    await page.goto('/dashboard/crawler-analytics');
    const tooltip = page.locator('[data-testid="first-visit-tooltip-bot-activity"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Sprint E — GuidedTour step count', () => {
  test('tour shows at least 8 steps when triggered', async ({ page }) => {
    await page.goto('/dashboard');
    // Clear tour completion to trigger tour
    await page.evaluate(() => localStorage.removeItem('lv_tour_completed'));

    await page.reload();
    // Wait for tour overlay to appear (800ms delay + render)
    const stepIndicator = page.locator('text=/Step \\d+ of \\d+/');
    await expect(stepIndicator).toBeVisible({ timeout: 3000 });

    // Extract the total steps from "Step X of Y"
    const text = await stepIndicator.textContent();
    const match = text?.match(/of (\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(8);
  });
});
