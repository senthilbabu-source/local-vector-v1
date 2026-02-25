// ---------------------------------------------------------------------------
// 10-truth-audit.spec.ts — AI Truth Audit E2E Tests
//
// Tests the multi-engine AI Truth Audit page (hallucinations page).
// Verifies TruthScoreCard, EngineComparisonGrid, 4-engine EvaluationCard.
//
// Uses the dev@ session (golden tenant: Charcoal N Chill, Growth plan).
// Seed data includes 4 evaluation rows (openai=95, perplexity=65,
// anthropic=90, gemini=88) → Truth Score = 84 (no consensus).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('10 — AI Truth Audit', () => {

  test('page renders with updated title', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    await expect(
      page.getByRole('heading', { name: 'AI Truth Audit', level: 1 }),
    ).toBeVisible();

    await expect(
      page.getByText(/multi-engine truth verification/i),
    ).toBeVisible();
  });

  test('TruthScoreCard displays score from seed data', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    const card = page.getByTestId('truth-score-card');
    await expect(card).toBeVisible();

    // Should show "Truth Score" heading
    await expect(card.getByText('Truth Score')).toBeVisible();

    // Should report 4 engines
    await expect(card.getByText(/4 engines/)).toBeVisible();
  });

  test('EngineComparisonGrid shows all 4 engines', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    const grid = page.getByTestId('engine-comparison-grid');
    await expect(grid).toBeVisible();

    // All 4 engine labels should be present
    await expect(grid.getByText('OpenAI')).toBeVisible();
    await expect(grid.getByText('Perplexity')).toBeVisible();
    await expect(grid.getByText('Anthropic')).toBeVisible();
    await expect(grid.getByText('Gemini')).toBeVisible();
  });

  test('EvaluationCard shows all 4 engine rows', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    // EvaluationCard should show all 4 engine labels
    // Use .first() to avoid strict mode violations with the hallucinations table
    await expect(page.getByText('OpenAI GPT-4o').first()).toBeVisible();
    await expect(page.getByText('Perplexity Sonar').first()).toBeVisible();
    await expect(page.getByText('Anthropic Claude').first()).toBeVisible();
    await expect(page.getByText('Google Gemini').first()).toBeVisible();
  });

  test('seed eval scores are displayed in engine rows', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    // Verify seed accuracy scores render as "X/100" badges
    await expect(page.getByText('95/100')).toBeVisible();
    await expect(page.getByText('65/100')).toBeVisible();
    await expect(page.getByText('90/100')).toBeVisible();
    await expect(page.getByText('88/100')).toBeVisible();
  });

  test('Run Audit buttons are present for all 4 engines', async ({ page }) => {
    await page.goto('/dashboard/hallucinations');

    // Each location gets 4 engine rows with Run Audit buttons.
    // Count must be a multiple of 4 (at least 4).
    const runButtons = page.getByRole('button', { name: /Run Audit/i });
    const count = await runButtons.count();
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count % 4).toBe(0);
  });
});
