// E2E Test — Onboarding Guard (incomplete@ user, Sprint 91 5-step wizard)
//
// Tests that the Dashboard Layout Guard correctly redirects an authenticated
// user whose primary location has hours_data=NULL and amenities=NULL to the
// /onboarding wizard, and that completing the 5-step wizard redirects to
// /dashboard.
//
// Authentication:
//   Uses the pre-authenticated storage state saved by global.setup.ts
//   for the incomplete@localvector.ai Playwright test user.
//
// DB state requirement:
//   global.setup.ts resets: hours_data=NULL, amenities=NULL,
//   onboarding_completed=false, competitors=[], target_queries=[].
//
// Sprint 91 Wizard Flow:
//   Wizard Step 1 — "Tell us about your business" → "Get Started" (manual)
//   Wizard Step 2 — TruthCalibrationForm (Business → Amenities → Hours)
//   Wizard Step 3 — Competitors (skippable)
//   Wizard Step 4 — SOV Queries → "Next → Launch"
//   Wizard Step 5 — Launch (audit poll mocked for speed)
//
// Guard logic (app/dashboard/layout.tsx):
//   if (primaryLocation && !primaryLocation.hours_data && !primaryLocation.amenities)
//     redirect('/onboarding')

import { test, expect } from '@playwright/test';
import path from 'path';

const INCOMPLETE_USER_STATE = path.join(
  __dirname,
  '../../.playwright/incomplete-user.json'
);

// Load the pre-authenticated session for every test in this file.
test.use({ storageState: INCOMPLETE_USER_STATE });

test.describe('Onboarding Guard — Dashboard redirect and wizard completion', () => {
  test('redirects to /onboarding and completes the 5-step wizard', async ({ page }) => {

    // ── Mock audit-status endpoint for Step 5 speed ──────────────────────────
    await page.route('**/api/onboarding/audit-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'complete', auditId: 'e2e-mock-audit' }),
      });
    });

    // ── 1. Navigate to a protected dashboard route ─────────────────────────
    // The authenticated incomplete user will NOT be sent to /login (they have a
    // valid session). Instead, the Dashboard Layout Onboarding Guard fires and
    // redirects to /onboarding because hours_data=NULL and amenities=NULL.
    await page.goto('/dashboard/magic-menus');

    // ── 2. Assert the guard redirected to /onboarding ──────────────────────
    await page.waitForURL('**/onboarding**', { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');

    // ── 3. Wizard Step 1 — "Tell us about your business" ──────────────────
    // The incomplete@ user has no GBP connection, so manual path shows.
    await expect(
      page.getByText(/Tell us about your business/i)
    ).toBeVisible({ timeout: 5_000 });

    // Click "Get Started" to advance to Wizard Step 2.
    await page.getByTestId('step1-next-btn').click();

    // ── 4. Wizard Step 2 — TruthCalibrationForm ───────────────────────────
    // Sub-step 1: Business name pre-filled from DB ("Test Restaurant").
    const businessInput = page.getByRole('textbox');
    await expect(businessInput).toBeVisible();
    await expect(businessInput).toHaveValue(/Test Restaurant/i);

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Sub-step 2: Amenities
    await expect(page.getByText('Serves alcohol')).toBeVisible();
    const alcoholCheckbox = page.getByLabel('Serves alcohol');
    await alcoholCheckbox.check();
    await expect(alcoholCheckbox).toBeChecked();

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Sub-step 3: Hours grid. Sunday defaults to "Closed" when hours_data=NULL.
    await expect(page.getByText('Sunday')).toBeVisible();
    const closedButtons = page.getByRole('button', { name: /Closed/i });
    await expect(closedButtons.first()).toBeVisible();

    // Submit hours → advances to Wizard Step 3 (Competitors).
    await page.getByRole('button', { name: /Save & Continue/i }).click();

    // ── 5. Wizard Step 3 — Competitors (skip) ─────────────────────────────
    await expect(
      page.getByText(/Who are your main competitors/i)
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('step3-skip-btn').click();

    // ── 6. Wizard Step 4 — SOV Queries ────────────────────────────────────
    await expect(
      page.getByText(/How will AI find you/i)
    ).toBeVisible({ timeout: 5_000 });

    await page.getByTestId('step4-next-btn').click();

    // ── 7. Wizard Step 5 — Launch ─────────────────────────────────────────
    // Mocked audit-status returns "complete" immediately.
    await expect(
      page.getByTestId('step5-complete-state')
        .or(page.getByTestId('step5-error-state'))
        .or(page.getByTestId('step5-launching-state'))
    ).toBeVisible({ timeout: 10_000 });

    // ── 8. Assert successful redirect to /dashboard ───────────────────────
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/onboarding');
  });
});
