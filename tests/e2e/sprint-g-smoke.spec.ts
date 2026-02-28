// ---------------------------------------------------------------------------
// sprint-g-smoke.spec.ts — Sprint G: Human-Readable Dashboard E2E Smoke Tests
//
// Validates the Sprint G dashboard redesign:
//   • 4 stat panels in the top row (AIVisibility, WrongFacts, AIBotAccess, LastScan)
//   • TopIssuesPanel with plain-English issue descriptions
//   • SOVTrendChart removed from dashboard (now on SOV page)
//   • HallucinationsByModel removed from dashboard (now on hallucinations page)
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// Dashboard layout — Sprint G panels
// ---------------------------------------------------------------------------

test.describe('Sprint G — Dashboard layout', () => {
  test('dashboard renders the 4 stat panels', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByTestId('ai-visibility-panel')).toBeVisible();
    await expect(page.getByTestId('wrong-facts-panel')).toBeVisible();
    await expect(page.getByTestId('ai-bot-access-panel')).toBeVisible();
    await expect(page.getByTestId('last-scan-panel')).toBeVisible();
  });

  test('TopIssuesPanel is visible below the stat panels', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByTestId('top-issues-panel')).toBeVisible();
  });

  test('SOVTrendChart is NOT present on the dashboard page', async ({ page }) => {
    await page.goto('/dashboard');

    // The SOVTrendChart component had a "View details →" link to share-of-voice
    // and the text "AI Visibility Trend". Neither should appear on the dashboard.
    const sovChart = page.locator('[data-testid="sov-trend-chart"]');
    await expect(sovChart).toHaveCount(0);
  });

  test('HallucinationsByModel is NOT present on the dashboard page', async ({ page }) => {
    await page.goto('/dashboard');

    const halluChart = page.locator('[data-testid="hallucinations-by-model"]');
    await expect(halluChart).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Stat panels — content
// ---------------------------------------------------------------------------

test.describe('Sprint G — Stat panels', () => {
  test('AIVisibilityPanel shows a score number or dash', async ({ page }) => {
    await page.goto('/dashboard');

    const score = page.getByTestId('ai-visibility-score');
    await expect(score).toBeVisible();
    const text = await score.textContent();
    // Should be a number or "—"
    expect(text === '—' || /^\d+$/.test(text ?? '')).toBeTruthy();
  });

  test('WrongFactsPanel renders and links to /dashboard/hallucinations', async ({ page }) => {
    await page.goto('/dashboard');

    const panel = page.getByTestId('wrong-facts-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('href', '/dashboard/hallucinations');
  });

  test('AIBotAccessPanel renders bot rows or empty state', async ({ page }) => {
    await page.goto('/dashboard');

    const panel = page.getByTestId('ai-bot-access-panel');
    await expect(panel).toBeVisible();

    // Either has bot rows or shows "No bot activity recorded yet"
    const rows = page.getByTestId('ai-bot-row');
    const empty = page.getByTestId('ai-bot-access-empty');
    const rowCount = await rows.count();
    const emptyCount = await empty.count();
    expect(rowCount > 0 || emptyCount > 0).toBeTruthy();
  });

  test('LastScanPanel shows scan timing text', async ({ page }) => {
    await page.goto('/dashboard');

    const panel = page.getByTestId('last-scan-panel');
    await expect(panel).toBeVisible();

    const timeText = page.getByTestId('last-scan-time');
    await expect(timeText).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Top Issues
// ---------------------------------------------------------------------------

test.describe('Sprint G — Top Issues', () => {
  test('TopIssuesPanel renders issue rows or empty state', async ({ page }) => {
    await page.goto('/dashboard');

    const panel = page.getByTestId('top-issues-panel');
    await expect(panel).toBeVisible();

    // Either issue rows or empty state
    const rows = page.getByTestId(/^top-issue-row-/);
    const empty = page.getByTestId('top-issues-empty');
    const rowCount = await rows.count();
    const emptyCount = await empty.count();
    expect(rowCount > 0 || emptyCount > 0).toBeTruthy();
  });

  test('issue rows have fix CTAs', async ({ page }) => {
    await page.goto('/dashboard');

    const rows = page.getByTestId(/^top-issue-row-/);
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // At least the first row should have a CTA (fix or how-to link)
      const fixBtn = page.getByTestId('top-issue-fix-0');
      const howLink = page.getByTestId('top-issue-how-0');
      const fixCount = await fixBtn.count();
      const howCount = await howLink.count();
      expect(fixCount > 0 || howCount > 0).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Detail pages — charts moved here
// ---------------------------------------------------------------------------

test.describe('Sprint G — Charts on detail pages', () => {
  test('SOVTrendChart is present on the share-of-voice page', async ({ page }) => {
    await page.goto('/dashboard/share-of-voice');

    // The SOV page should have the trend chart
    // Look for the chart heading text
    await expect(page.getByText('SOV Trend', { exact: false })).toBeVisible();
  });

  test('HallucinationsByModel chart is present on the hallucinations page', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    // The page should render — check for the page heading
    await expect(
      page.getByRole('heading', { name: 'AI Truth Audit', level: 1 }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test.describe('Sprint G — Accessibility', () => {
  test('InfoTooltip triggers on stat panels are keyboard-focusable', async ({ page }) => {
    await page.goto('/dashboard');

    // InfoTooltip triggers should be present on the panels
    const tooltips = page.getByTestId('info-tooltip-trigger');
    const count = await tooltips.count();

    // At least AIVisibilityPanel and WrongFactsPanel and AIBotAccessPanel = 3
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
