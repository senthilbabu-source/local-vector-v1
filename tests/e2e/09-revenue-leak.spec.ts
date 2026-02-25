// ---------------------------------------------------------------------------
// 09-revenue-leak.spec.ts — Revenue Leak Scorecard E2E Tests
//
// Tests the Revenue Leak Scorecard on the main dashboard and the Revenue
// Config settings page.
//
// Uses the dev@ session (golden tenant: Charcoal N Chill, Growth plan).
// Seed data includes revenue_config and 3 revenue_snapshots.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('09 — Revenue Leak Scorecard', () => {

  test('RevenueLeakCard renders on dashboard with dollar range', async ({ page }) => {
    await page.goto('/dashboard');

    const card = page.getByTestId('revenue-leak-card');
    await expect(card).toBeVisible();

    // Should display "Revenue Leak Scorecard" label
    await expect(card.getByText('Revenue Leak Scorecard')).toBeVisible();

    // Should display "AI is costing you" text
    await expect(card.getByText('AI is costing you')).toBeVisible();

    // Should display a dollar range (e.g. "$X – $Y /month")
    const leakRange = card.getByTestId('leak-range');
    await expect(leakRange).toBeVisible();
    await expect(leakRange).toContainText('$');
    await expect(leakRange).toContainText('/month');
  });

  test('breakdown chips show three cost components', async ({ page }) => {
    await page.goto('/dashboard');

    const chips = page.getByTestId('breakdown-chip');
    await expect(chips).toHaveCount(3);

    // Verify the three labels
    await expect(page.getByText('Inaccuracies')).toBeVisible();
    await expect(page.getByText('SOV Gap')).toBeVisible();
    await expect(page.getByText('Competitor Steal')).toBeVisible();
  });

  test('Configure Revenue Inputs link navigates to settings page', async ({ page }) => {
    await page.goto('/dashboard');

    const link = page.getByRole('link', { name: /Configure Revenue Inputs/i });
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL('**/dashboard/settings/revenue**', { timeout: 10_000 });
    expect(page.url()).toContain('/dashboard/settings/revenue');
  });

  test('Revenue settings page renders with pre-filled values', async ({ page }) => {
    await page.goto('/dashboard/settings/revenue');

    // Page heading
    await expect(
      page.getByRole('heading', { name: 'Revenue Inputs', level: 1 })
    ).toBeVisible();

    // Form fields should be pre-filled from seed data
    const avgTicket = page.locator('#avg_ticket');
    await expect(avgTicket).toBeVisible();
    // Golden tenant config has avg_ticket = 47.50
    await expect(avgTicket).toHaveValue('47.5');

    const monthlySearches = page.locator('#monthly_searches');
    await expect(monthlySearches).toBeVisible();
    await expect(monthlySearches).toHaveValue('2400');
  });

  test('revenue settings form submits successfully', async ({ page }) => {
    await page.goto('/dashboard/settings/revenue');

    // Update avg_ticket
    const avgTicket = page.locator('#avg_ticket');
    await avgTicket.clear();
    await avgTicket.fill('50');

    // Submit the form
    await page.getByRole('button', { name: /Save revenue inputs/i }).click();

    // Success message should appear
    await expect(page.getByText('Revenue inputs saved')).toBeVisible({ timeout: 10_000 });

    // Reload to verify persistence
    await page.reload();
    await expect(page.locator('#avg_ticket')).toHaveValue('50');

    // Restore original value
    const avgTicketAgain = page.locator('#avg_ticket');
    await avgTicketAgain.clear();
    await avgTicketAgain.fill('47.5');
    await page.getByRole('button', { name: /Save revenue inputs/i }).click();
    await expect(page.getByText('Revenue inputs saved')).toBeVisible({ timeout: 10_000 });
  });
});
