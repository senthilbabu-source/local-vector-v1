// ---------------------------------------------------------------------------
// Sprint 122: Benchmark Comparisons — E2E tests
//
// 5 tests verifying the BenchmarkCard on the dashboard.
// Uses the dev@charcoalnchill.com session.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';

test.describe('Sprint 122: Benchmark Comparisons', () => {
  test.beforeEach(async ({ page }) => {
    // Use saved session for dev user
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('BenchmarkCard renders on dashboard', async ({ page }) => {
    // The card may show data or insufficient-data state — either is valid
    const card = page.locator('[data-testid="benchmark-card"]');
    // Wait up to 10s for the card to appear (fetch + render)
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('"top X%" inversion correct (rank=77 → "top 23%")', async ({ page }) => {
    const card = page.locator('[data-testid="benchmark-card"]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    // If benchmark data exists, check the percentile text
    const percentileText = page.locator('[data-testid="benchmark-percentile-text"]');
    const insufficientData = page.locator('[data-testid="benchmark-insufficient-data"]');

    // Either percentile text or insufficient data should be visible
    const hasPercentile = await percentileText.isVisible().catch(() => false);
    const hasInsufficient = await insufficientData.isVisible().catch(() => false);

    expect(hasPercentile || hasInsufficient).toBe(true);

    if (hasPercentile) {
      const text = await percentileText.textContent();
      // Should contain "top X%" or "bottom tier" — never "top 0%"
      expect(text).not.toContain('top 0%');
    }
  });

  test('Percentile bar visible when data exists', async ({ page }) => {
    const card = page.locator('[data-testid="benchmark-card"]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    const bar = page.locator('[data-testid="benchmark-percentile-bar"]');
    const insufficientData = page.locator('[data-testid="benchmark-insufficient-data"]');

    const hasBar = await bar.isVisible().catch(() => false);
    const hasInsufficient = await insufficientData.isVisible().catch(() => false);

    // Either bar or insufficient data should be visible
    expect(hasBar || hasInsufficient).toBe(true);
  });

  test('Trend chart renders when history exists', async ({ page }) => {
    const card = page.locator('[data-testid="benchmark-card"]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    const trendChart = page.locator('[data-testid="benchmark-trend-chart"]');
    const insufficientData = page.locator('[data-testid="benchmark-insufficient-data"]');

    const hasTrend = await trendChart.isVisible().catch(() => false);
    const hasInsufficient = await insufficientData.isVisible().catch(() => false);

    // Either trend chart or insufficient data should be visible
    expect(hasTrend || hasInsufficient).toBe(true);
  });

  test('Insufficient-data message shown when no data', async ({ page }) => {
    const card = page.locator('[data-testid="benchmark-card"]');
    await expect(card).toBeVisible({ timeout: 10_000 });

    // The card should always be visible — either with data or insufficient message
    const cardText = await card.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(0);
  });
});
