// E2E Test 2 — The Onboarding Guard (Phase 12 Dashboard Layout Guard)
//
// Tests that the Dashboard Layout Guard correctly redirects an authenticated
// user whose primary location has hours_data=NULL and amenities=NULL to the
// /onboarding wizard, and that completing the wizard redirects to /dashboard.
//
// Authentication:
//   Uses the pre-authenticated storage state saved by tests/global-setup.ts
//   for the incomplete@localvector.ai Playwright test user.
//
// DB state requirement:
//   The incomplete test user's location must have hours_data=NULL and
//   amenities=NULL for the guard to fire. Run `npx supabase db reset` before
//   each full E2E run to restore this condition.
//
// Onboarding form (TruthCalibrationForm.tsx) — 3-step wizard:
//   Step 1 — Business name (pre-filled from DB as "Test Restaurant")
//   Step 2 — Amenity checkboxes (6 core amenities)
//   Step 3 — Hours grid (7 days); Sunday defaults to "Closed" when hours_data=NULL
//
// The "Closed" toggle for Sunday passes the literal string "closed" to the
// saveGroundTruth Server Action, satisfying the Doc 03 §15.1 requirement.
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
  test('redirects to /onboarding and completes the 3-step wizard', async ({ page }) => {

    // ── 1. Navigate to a protected dashboard route ─────────────────────────
    // The authenticated incomplete user will NOT be sent to /login (they have a
    // valid session). Instead, the Dashboard Layout Onboarding Guard fires and
    // redirects to /onboarding because hours_data=NULL and amenities=NULL.
    await page.goto('/dashboard/magic-menus');

    // ── 2. Assert the guard redirected to /onboarding ──────────────────────
    await page.waitForURL('**/onboarding**', { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');

    // The onboarding page headline (from Doc 06 §7)
    await expect(
      page.getByText(/Teach AI the Truth About Your Business/i)
    ).toBeVisible({ timeout: 5_000 });

    // ── 3. Step 1 — Business Name ──────────────────────────────────────────
    // The business name is pre-filled from the DB ("Test Restaurant").
    // Just verify it's present and advance to Step 2.
    const businessInput = page.getByRole('textbox');
    await expect(businessInput).toBeVisible();
    await expect(businessInput).toHaveValue(/Test Restaurant/i);

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // ── 4. Step 2 — Amenities ─────────────────────────────────────────────
    // The "Serves alcohol" checkbox label comes from AMENITY_FIELDS in
    // TruthCalibrationForm.tsx.
    await expect(page.getByText('Serves alcohol')).toBeVisible();

    // Toggle one amenity to produce a non-default state.
    const alcoholCheckbox = page.getByLabel('Serves alcohol');
    await alcoholCheckbox.check();
    await expect(alcoholCheckbox).toBeChecked();

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // ── 5. Step 3 — Hours ─────────────────────────────────────────────────
    // The hours grid shows all 7 days. Sunday defaults to "Closed" when
    // hours_data=NULL (see initHours() in TruthCalibrationForm.tsx).
    // This satisfies the "pass the literal string 'closed' for at least one day"
    // requirement from Doc 03 §15.1 without any extra interaction.
    await expect(page.getByText('Sunday')).toBeVisible();

    // Verify that at least one "Closed" button is visible in the grid
    // (confirms the default closed-day state is rendered correctly).
    const closedButtons = page.getByRole('button', { name: /Closed/i });
    await expect(closedButtons.first()).toBeVisible();

    // ── 6. Submit the wizard ───────────────────────────────────────────────
    // On Step 3 the navigation button reads "Save & Continue" (TruthCalibrationForm.tsx).
    // This calls saveGroundTruth(), which:
    //   - Updates locations.hours_data and locations.amenities
    //   - Sends router.push('/dashboard') on success
    await page.getByRole('button', { name: /Save & Continue/i }).click();

    // ── 7. Assert successful redirect to /dashboard ────────────────────────
    // After saveGroundTruth succeeds, TruthCalibrationForm calls router.push('/dashboard').
    // The layout guard will no longer fire because hours_data+amenities are now set.
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');
    // Verify the dashboard content (not redirected back to /onboarding)
    expect(page.url()).not.toContain('/onboarding');
  });
});
