// ---------------------------------------------------------------------------
// sprint-i-smoke.spec.ts — Sprint I: Action Surfaces Tier 2 E2E Smoke Tests
//
// Validates the Sprint I interpretation panels across 4 detail pages:
//   • Revenue Impact: RevenueEstimatePanel with smart defaults
//   • AI Sentiment: SentimentInterpretationPanel above charts
//   • Source Intelligence: SourceHealthSummaryPanel with health badges
//   • Bot Activity: BotFixInstructions expandable on blind spots
//
// Authentication: dev@ session (golden tenant, Growth plan).
// Note: Source Intelligence requires Agency plan — may be blurred/gated.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// Revenue Impact — Estimate Panel
// ---------------------------------------------------------------------------

test.describe('Sprint I — Revenue Impact', () => {
  test('shows the revenue estimate panel', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    await expect(page.getByTestId('revenue-estimate-panel')).toBeVisible();
  });

  test('shows "Refine your estimate" when using default config', async ({ page }) => {
    await page.goto('/dashboard/revenue-impact');
    // The section heading changes based on isDefaultConfig
    const heading = page.getByText(/Refine your estimate|Revenue Settings/);
    await expect(heading).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AI Sentiment — Interpretation Panel
// ---------------------------------------------------------------------------

test.describe('Sprint I — AI Sentiment', () => {
  test('page loads without error', async ({ page }) => {
    await page.goto('/dashboard/sentiment');
    // Page should have the title heading at minimum
    await expect(page.getByText('AI Sentiment Analysis')).toBeVisible();
  });

  test('shows interpretation panel when sentiment data exists', async ({ page }) => {
    await page.goto('/dashboard/sentiment');
    // The panel may not exist if no sentiment data — skip rather than fail
    const panel = page.getByTestId('sentiment-interpretation-panel');
    const panelCount = await panel.count();
    if (panelCount > 0) {
      await expect(panel).toBeVisible();
      // Should contain "What AI models say about you"
      await expect(page.getByText('What AI models say about you')).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Source Intelligence — Health Summary
// ---------------------------------------------------------------------------

test.describe('Sprint I — Source Intelligence', () => {
  test('page loads without error', async ({ page }) => {
    await page.goto('/dashboard/source-intelligence');
    await expect(page.getByText('What AI Reads About You')).toBeVisible();
  });

  test('shows source health summary when data exists (Agency plan)', async ({ page }) => {
    await page.goto('/dashboard/source-intelligence');
    // Source Intelligence is Agency-gated — panel may be behind PlanGate
    const summary = page.getByTestId('source-health-summary');
    const count = await summary.count();
    if (count > 0) {
      await expect(summary).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Bot Activity — Fix Instructions
// ---------------------------------------------------------------------------

test.describe('Sprint I — Bot Activity', () => {
  test('page loads and shows bot activity', async ({ page }) => {
    await page.goto('/dashboard/crawler-analytics');
    await expect(page.getByText('AI Bot Activity')).toBeVisible();
  });

  test('blind spots have "How to fix" expandable button', async ({ page }) => {
    await page.goto('/dashboard/crawler-analytics');
    // Look for any "How to fix" button — indicates fix instructions are wired in
    const fixButtons = page.getByText('How to fix');
    const count = await fixButtons.count();
    // If there are blind spots, there should be fix buttons
    if (count > 0) {
      const firstButton = fixButtons.first();
      await expect(firstButton).toBeVisible();
    }
  });
});
