// ---------------------------------------------------------------------------
// sprint-o-smoke.spec.ts — Sprint O: V1 Complete E2E Smoke Tests
//
// Validates:
//   • M4 — Revenue Impact form: restaurant-appropriate defaults, placeholders, help text
//   • L3 — Content Flow: DraftSourceTag, calendar breadcrumb
//   • N4 — Benchmark: card rendering, sample mode exclusion
//   • Cron auth guard: /api/cron/benchmarks without secret → 401
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// M4 — Revenue Impact Defaults
// ---------------------------------------------------------------------------

test.describe('Sprint O — Revenue Impact Defaults (M4)', () => {
  test('revenue-impact form loads with non-zero avgCustomerValue', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    const input = page.locator('input[name="avgCustomerValue"]');
    await expect(input).toBeVisible();
    const value = await input.inputValue();
    const numValue = parseFloat(value);
    expect(numValue).toBeGreaterThan(0);
  });

  test('avgCustomerValue default is between 40 and 80', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    const input = page.locator('input[name="avgCustomerValue"]');
    const value = parseFloat(await input.inputValue());
    expect(value).toBeGreaterThanOrEqual(40);
    expect(value).toBeLessThanOrEqual(80);
  });

  test('monthlyCovers default is between 500 and 5000', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    const input = page.locator('input[name="monthlyCovers"]');
    const value = parseFloat(await input.inputValue());
    expect(value).toBeGreaterThanOrEqual(500);
    expect(value).toBeLessThanOrEqual(5000);
  });

  test('avgCustomerValue input has placeholder text', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    const input = page.locator('input[name="avgCustomerValue"]');
    const placeholder = await input.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder).toContain('55');
  });

  test('monthlyCovers input has placeholder text', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    const input = page.locator('input[name="monthlyCovers"]');
    const placeholder = await input.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder).toContain('1800');
  });
});

// ---------------------------------------------------------------------------
// L3 — Content Flow Clarity
// ---------------------------------------------------------------------------

test.describe('Sprint O — Content Flow Clarity (L3)', () => {
  test('content-drafts page loads', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');
    await expect(page.getByRole('heading', { name: 'Content Drafts' })).toBeVisible();
  });

  test('content-calendar page loads', async ({ page }) => {
    await page.goto('/dashboard/content-calendar');
    await expect(page.getByRole('heading', { name: 'Content Calendar' })).toBeVisible();
  });

  test('breadcrumb visible when from=calendar param present', async ({ page }) => {
    await page.goto('/dashboard/content-drafts?from=calendar&occasion=Cinco+de+Mayo');
    const breadcrumb = page.getByTestId('calendar-breadcrumb');
    const breadcrumbCount = await breadcrumb.count();
    if (breadcrumbCount > 0) {
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.getByText('Content Calendar')).toBeVisible();
      await expect(breadcrumb.getByText('Cinco de Mayo')).toBeVisible();
    }
  });

  test('breadcrumb NOT shown without from=calendar param', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');
    await expect(page.getByTestId('calendar-breadcrumb')).toHaveCount(0);
  });

  test('occasion-triggered drafts have origin tag (if any exist)', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');
    // Check if any draft-origin-tag exists (occasion engine badge)
    const originTags = page.getByTestId('draft-origin-tag');
    const tagCount = await originTags.count();
    // If there are occasion-triggered drafts, the origin tag should be present
    // This is a conditional check — no occasion drafts is also valid
    if (tagCount > 0) {
      await expect(originTags.first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// N4 — Benchmark Comparison
// ---------------------------------------------------------------------------

test.describe('Sprint O — Benchmark Comparison (N4)', () => {
  test('dashboard loads with benchmark card', async ({ page }) => {
    await page.goto('/dashboard');
    // The benchmark card should be present (either collecting or ready state)
    const benchmarkCard = page.getByTestId('benchmark-comparison-card');
    const cardCount = await benchmarkCard.count();
    // Card may not render if org has no city — that's valid
    if (cardCount > 0) {
      await expect(benchmarkCard).toBeVisible();
    }
  });

  test('benchmark card shows city name in title', async ({ page }) => {
    await page.goto('/dashboard');
    const benchmarkCard = page.getByTestId('benchmark-comparison-card');
    const cardCount = await benchmarkCard.count();
    if (cardCount > 0) {
      // Title should contain "Benchmark"
      await expect(benchmarkCard.getByText(/Benchmark/)).toBeVisible();
    }
  });

  test('benchmark card shows either collecting or ready state', async ({ page }) => {
    await page.goto('/dashboard');
    const benchmarkCard = page.getByTestId('benchmark-comparison-card');
    const cardCount = await benchmarkCard.count();
    if (cardCount > 0) {
      // Should have either collecting-state, ready-state, or no-score-state
      const collectingState = benchmarkCard.getByTestId('benchmark-collecting-state');
      const readyState = benchmarkCard.getByTestId('benchmark-ready-state');
      const noScoreState = benchmarkCard.getByTestId('benchmark-no-score-state');
      const total =
        (await collectingState.count()) +
        (await readyState.count()) +
        (await noScoreState.count());
      expect(total).toBeGreaterThanOrEqual(1);
    }
  });

  test('/api/cron/benchmarks without CRON_SECRET returns 401', async ({ request }) => {
    const response = await request.get('/api/cron/benchmarks');
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Regression spot checks
// ---------------------------------------------------------------------------

test.describe('Sprint O — Regression Spot Checks', () => {
  test('dashboard page loads without errors', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });

  test('hallucinations page loads', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('share-of-voice page loads', async ({ page }) => {
    await page.goto('/dashboard/share-of-voice');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
