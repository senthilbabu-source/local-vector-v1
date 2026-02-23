// ---------------------------------------------------------------------------
// 02-onboarding-guard.spec.ts — Dashboard Onboarding Guard + Wizard Completion
//
// Tests that the Dashboard Layout Guard correctly intercepts an authenticated
// user whose primary location has hours_data=NULL and amenities=NULL, redirects
// them to /onboarding, and that completing the 3-step wizard redirects back
// to /dashboard.
//
// Authentication:
//   Uses the e2e-tester@ session provisioned by global.setup.ts (Supabase
//   admin API). The user's primary location always starts with NULL hours/
//   amenities because global.setup.ts deletes and recreates the user fresh
//   before each full E2E run — no `supabase db reset` needed for this test.
//
// Onboarding wizard (TruthCalibrationForm.tsx) — 3-step flow:
//   Step 1 — Business name (pre-filled from DB as "E2E Test Restaurant")
//   Step 2 — Amenity checkboxes (6 core amenities)
//   Step 3 — Hours grid (7 days, all default to "closed" when hours_data=NULL)
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

  test('guard fires, wizard completes, redirects to /dashboard', async ({ page }) => {

    // ── 1. Navigate to a protected dashboard route ───────────────────────────
    // The guard fires for e2e-tester@ because hours_data=NULL & amenities=NULL.
    // The user will NOT be sent to /login (they have a valid session).
    await page.goto('/dashboard/magic-menus');

    // ── 2. Assert the guard redirected to /onboarding ────────────────────────
    await page.waitForURL('**/onboarding**', { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');

    // Onboarding page headline (app/onboarding/page.tsx — Doc 06 §7).
    await expect(
      page.getByText(/Teach AI the Truth About Your Business/i)
    ).toBeVisible({ timeout: 5_000 });

    // ── 3. Step 1 — Business Name ─────────────────────────────────────────────
    // Pre-filled with the location's business_name ("E2E Test Restaurant").
    // Verify the input is visible and advance.
    const businessInput = page.getByRole('textbox');
    await expect(businessInput).toBeVisible();
    await expect(businessInput).toHaveValue(/E2E Test Restaurant/i);

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // ── 4. Step 2 — Amenities ─────────────────────────────────────────────────
    // AMENITY_FIELDS in TruthCalibrationForm.tsx includes "Serves alcohol".
    await expect(page.getByText('Serves alcohol')).toBeVisible();

    // Check one amenity to produce a non-default payload.
    const alcoholCheckbox = page.getByLabel('Serves alcohol');
    await alcoholCheckbox.check();
    await expect(alcoholCheckbox).toBeChecked();

    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // ── 5. Step 3 — Operating Hours ───────────────────────────────────────────
    // All 7 days default to "closed" when hours_data=NULL (initHours()).
    // Verify the grid is rendered.
    await expect(page.getByText('Sunday')).toBeVisible();

    // At least one "Closed" state indicator is present (one per closed day).
    const closedButtons = page.getByRole('button', { name: /Closed/i });
    await expect(closedButtons.first()).toBeVisible();

    // ── 6. Submit the wizard ──────────────────────────────────────────────────
    // "Save & Continue" calls saveGroundTruth() and then router.push('/dashboard').
    // Submitting with all days = 'closed' sets hours_data to a non-null JSONB
    // object so the Onboarding Guard will no longer fire on the next render.
    await page.getByRole('button', { name: /Save & Continue/i }).click();

    // ── 7. Assert successful redirect to /dashboard ───────────────────────────
    await page.waitForURL('**/dashboard**', { timeout: 20_000 });
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/onboarding');

    // The dashboard renders the "Welcome back" heading (from DashboardPage).
    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  });
});
