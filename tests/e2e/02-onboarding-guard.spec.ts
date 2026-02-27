// ---------------------------------------------------------------------------
// 02-onboarding-guard.spec.ts — Dashboard Onboarding Guard + Wizard Completion
//
// Tests that the Dashboard Layout Guard correctly intercepts an authenticated
// user whose primary location has hours_data=NULL and amenities=NULL, redirects
// them to /onboarding, and that completing the 5-step wizard (Sprint 91)
// redirects back to /dashboard.
//
// Authentication:
//   Uses the e2e-tester@ session provisioned by global.setup.ts (Supabase
//   admin API). The user's primary location always starts with NULL hours/
//   amenities because global.setup.ts deletes and recreates the user fresh
//   before each full E2E run — no `supabase db reset` needed for this test.
//
// Sprint 91 Wizard Flow:
//   Step 1 — "Tell us about your business" → "Get Started" (manual path)
//   Step 2 — TruthCalibrationForm (Business Name → Amenities → Hours)
//   Step 3 — Competitors (skippable)
//   Step 4 — SOV Queries → "Next → Launch"
//   Step 5 — Launch (audit poll + redirect). Mocked for speed.
//
// Guard logic (app/dashboard/layout.tsx):
//   if (primaryLocation && !primaryLocation.hours_data && !primaryLocation.amenities)
//     redirect('/onboarding')
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

// Pre-authenticated e2e-tester session (provisioned by global.setup.ts).
const E2E_TESTER_STATE = path.join(__dirname, '../../.playwright/e2e-tester.json');
test.use({ storageState: E2E_TESTER_STATE });

test.describe('02 — Onboarding Guard: redirect + wizard completion', () => {

  test('guard fires, wizard completes 5 steps, redirects to /dashboard', async ({ page }) => {

    // ── Mock the audit-status polling endpoint for Step 5 speed ────────────
    await page.route('**/api/onboarding/audit-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'complete', auditId: 'e2e-mock-audit' }),
      });
    });

    // ── 1. Navigate to a protected dashboard route ───────────────────────────
    // The guard fires for e2e-tester@ because hours_data=NULL & amenities=NULL.
    await page.goto('/dashboard/magic-menus');

    // ── 2. Assert the guard redirected to /onboarding ────────────────────────
    await page.waitForURL('**/onboarding**', { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');

    // ── 3. Wizard Step 1 — "Tell us about your business" ─────────────────────
    // Manual path (no GBP connection for e2e-tester@).
    await expect(
      page.getByText(/Tell us about your business/i),
    ).toBeVisible({ timeout: 5_000 });

    // Click "Get Started" to advance to Step 2.
    await page.getByTestId('step1-next-btn').click();

    // ── 4. Wizard Step 2 — TruthCalibrationForm ──────────────────────────────
    // Sub-step 1: Business name pre-filled with "E2E Test Restaurant".
    const businessInput = page.getByRole('textbox');
    await expect(businessInput).toBeVisible();
    await expect(businessInput).toHaveValue(/E2E Test Restaurant/i);

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Sub-step 2: Amenities
    await expect(page.getByText('Serves alcohol')).toBeVisible();
    const alcoholCheckbox = page.getByLabel('Serves alcohol');
    await alcoholCheckbox.check();
    await expect(alcoholCheckbox).toBeChecked();

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Sub-step 3: Hours grid
    await expect(page.getByText('Sunday')).toBeVisible();
    const closedButtons = page.getByRole('button', { name: /Closed/i });
    await expect(closedButtons.first()).toBeVisible();

    // Submit hours → advances to Wizard Step 3.
    await page.getByRole('button', { name: /Save & Continue/i }).click();

    // ── 5. Wizard Step 3 — Competitors (skip) ────────────────────────────────
    await expect(
      page.getByText(/Who are your main competitors/i),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('step3-skip-btn').click();

    // ── 6. Wizard Step 4 — SOV Queries ───────────────────────────────────────
    await expect(
      page.getByText(/How will AI find you/i),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('step4-next-btn').click();

    // ── 7. Wizard Step 5 — Launch ────────────────────────────────────────────
    // The mocked audit-status returns "complete" immediately, so the
    // component transitions from launching → complete → countdown → redirect.
    await expect(
      page.getByTestId('step5-complete-state')
        .or(page.getByTestId('step5-error-state'))
        .or(page.getByTestId('step5-launching-state')),
    ).toBeVisible({ timeout: 10_000 });

    // ── 8. Assert successful redirect to /dashboard ──────────────────────────
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/onboarding');
  });
});
