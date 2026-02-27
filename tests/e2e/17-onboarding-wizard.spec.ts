// ---------------------------------------------------------------------------
// 17-onboarding-wizard.spec.ts — Sprint 91 Onboarding Wizard E2E
//
// Comprehensive E2E tests for the 5-step onboarding wizard.
// Uses the incomplete@ user (pre-reset by global.setup.ts).
//
// Tests the manual path (no GBP connection):
//   Step 1: "Tell us about your business" → "Get Started"
//   Step 2: TruthCalibrationForm (Business Name → Amenities → Hours)
//   Step 3: Competitors (add + skip paths)
//   Step 4: SOV Queries (review, optional custom)
//   Step 5: Launch (mocked audit-status, countdown redirect)
//
// Also tests:
//   - Progress indicator (WizardProgress) visible at each step
//   - GBP toast messages still work in new wizard
//   - Step 3 competitor add/remove UI
//   - Step 4 query display
//
// Run:
//   npx playwright test tests/e2e/17-onboarding-wizard.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const INCOMPLETE_USER_STATE = path.join(
  __dirname,
  '../../.playwright/incomplete-user.json',
);
test.use({ storageState: INCOMPLETE_USER_STATE });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function mockAuditStatusComplete(page: import('@playwright/test').Page) {
  await page.route('**/api/onboarding/audit-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'complete', auditId: 'e2e-mock-audit' }),
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Manual Path — Full 5-step wizard
// ═══════════════════════════════════════════════════════════════════════════

test.describe('17 — Onboarding Wizard (Manual Path)', () => {

  test('wizard progress indicator is visible on Step 1', async ({ page }) => {
    await page.goto('/onboarding');

    // WizardProgress has role="progressbar" and data-testid="wizard-progress"
    await expect(
      page.getByTestId('wizard-progress'),
    ).toBeVisible({ timeout: 5_000 });

    // Step 1 indicator should be active
    await expect(
      page.getByTestId('step-indicator-1'),
    ).toBeVisible();

    // All 5 step indicators should exist
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByTestId(`step-indicator-${i}`)).toBeVisible();
    }
  });

  test('Step 1: manual path shows "Tell us about your business"', async ({ page }) => {
    await page.goto('/onboarding');

    // Heading for manual users (no GBP connection)
    await expect(
      page.getByText(/Tell us about your business/i),
    ).toBeVisible({ timeout: 5_000 });

    // "Get Started" button should be visible
    await expect(
      page.getByTestId('step1-next-btn'),
    ).toBeVisible();

    // Link to connect GBP should be present
    await expect(
      page.getByText(/Google Business Profile.*Connect/i),
    ).toBeVisible();
  });

  test('Step 2: TruthCalibrationForm loads after "Get Started"', async ({ page }) => {
    await page.goto('/onboarding');

    // Advance to Step 2
    await page.getByTestId('step1-next-btn').click();

    // TruthCalibrationForm sub-step 1: Business Name
    await expect(
      page.getByText(/Business Name/i),
    ).toBeVisible({ timeout: 5_000 });

    // Business name input should be pre-filled from DB
    const businessInput = page.getByRole('textbox');
    await expect(businessInput).toBeVisible();
    await expect(businessInput).toHaveValue(/.+/); // Non-empty pre-fill
  });

  test('Step 3: add and remove competitors', async ({ page }) => {
    await mockAuditStatusComplete(page);
    await page.goto('/onboarding');

    // ── Step 1 → Step 2 ──────────────────────────────────────────────────
    await page.getByTestId('step1-next-btn').click();

    // ── Step 2: complete TruthCalibrationForm quickly ────────────────────
    await page.getByRole('button', { name: 'Next', exact: true }).click(); // Business → Amenities
    await page.getByRole('button', { name: 'Next', exact: true }).click(); // Amenities → Hours
    await page.getByRole('button', { name: /Save & Continue/i }).click(); // Hours → Step 3

    // ── Step 3: Competitors ──────────────────────────────────────────────
    await expect(
      page.getByText(/Who are your main competitors/i),
    ).toBeVisible({ timeout: 10_000 });

    // Type a competitor name and add it
    const input = page.getByTestId('step3-competitor-input');
    await input.fill('Cloud 9 Lounge');
    await page.getByTestId('step3-add-btn').click();

    // Competitor should appear in the list
    await expect(
      page.getByTestId('step3-competitor-list'),
    ).toBeVisible();
    await expect(
      page.getByText('Cloud 9 Lounge'),
    ).toBeVisible();

    // Add a second competitor
    await input.fill('Hookah Palace');
    await page.getByTestId('step3-add-btn').click();
    await expect(page.getByText('Hookah Palace')).toBeVisible();

    // Remove the first competitor
    await page.getByRole('button', { name: /Remove Cloud 9 Lounge/i }).click();
    await expect(page.getByText('Cloud 9 Lounge')).not.toBeVisible();

    // Hookah Palace should still be there
    await expect(page.getByText('Hookah Palace')).toBeVisible();
  });

  test('Step 3: skip competitors advances to Step 4', async ({ page }) => {
    await mockAuditStatusComplete(page);
    await page.goto('/onboarding');

    // Fast-forward through Steps 1-2
    await page.getByTestId('step1-next-btn').click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: /Save & Continue/i }).click();

    // Step 3: Skip
    await expect(
      page.getByText(/Who are your main competitors/i),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('step3-skip-btn').click();

    // Step 4 should be visible
    await expect(
      page.getByText(/How will AI find you/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Step 4: SOV queries are displayed and Next → Launch works', async ({ page }) => {
    await mockAuditStatusComplete(page);
    await page.goto('/onboarding');

    // Fast-forward through Steps 1-3
    await page.getByTestId('step1-next-btn').click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: /Save & Continue/i }).click();
    await page.getByTestId('step3-skip-btn').click();

    // Step 4: SOV Queries
    await expect(
      page.getByText(/How will AI find you/i),
    ).toBeVisible({ timeout: 5_000 });

    // Query list section should be present (auto-generated or empty state)
    await expect(
      page.getByTestId('step4-query-list'),
    ).toBeVisible();

    // Custom query input should be present
    await expect(
      page.getByTestId('step4-custom-input'),
    ).toBeVisible();

    // Click "Next → Launch" to go to Step 5
    await page.getByTestId('step4-next-btn').click();

    // Step 5 should be visible
    await expect(
      page.getByTestId('step5-launching-state')
        .or(page.getByTestId('step5-complete-state'))
        .or(page.getByTestId('step5-error-state')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Step 5: launch completes and redirects to /dashboard', async ({ page }) => {
    await mockAuditStatusComplete(page);
    await page.goto('/onboarding');

    // Fast-forward through Steps 1-4
    await page.getByTestId('step1-next-btn').click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: /Save & Continue/i }).click();
    await page.getByTestId('step3-skip-btn').click();
    await page.getByTestId('step4-next-btn').click();

    // Step 5 should show launching or complete state
    await expect(
      page.getByTestId('step5-complete-state')
        .or(page.getByTestId('step5-error-state'))
        .or(page.getByTestId('step5-launching-state')),
    ).toBeVisible({ timeout: 10_000 });

    // The "Go to My Dashboard →" button should appear (complete or error state)
    await expect(
      page.getByTestId('step5-dashboard-btn'),
    ).toBeVisible({ timeout: 15_000 });

    // Auto-redirect countdown should be visible
    await expect(
      page.getByTestId('step5-countdown'),
    ).toBeVisible();

    // Wait for redirect to /dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard');
    expect(page.url()).not.toContain('/onboarding');
  });

  test('full wizard: adds competitor, completes all 5 steps', async ({ page }) => {
    await mockAuditStatusComplete(page);
    await page.goto('/onboarding');

    // ── Step 1: Get Started ──────────────────────────────────────────────
    await expect(
      page.getByText(/Tell us about your business/i),
    ).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('step1-next-btn').click();

    // ── Step 2: TruthCalibrationForm ─────────────────────────────────────
    // Sub-step 1: Business Name → Next
    const bizInput = page.getByRole('textbox');
    await expect(bizInput).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Sub-step 2: Amenities → check one + Next
    await expect(page.getByText('Serves alcohol')).toBeVisible();
    await page.getByLabel('Serves alcohol').check();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Sub-step 3: Hours → Save & Continue
    await expect(page.getByText('Sunday')).toBeVisible();
    await page.getByRole('button', { name: /Save & Continue/i }).click();

    // ── Step 3: Add one competitor ───────────────────────────────────────
    await expect(
      page.getByText(/Who are your main competitors/i),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('step3-competitor-input').fill('Test Competitor');
    await page.getByTestId('step3-add-btn').click();
    await expect(page.getByText('Test Competitor')).toBeVisible();
    await page.getByTestId('step3-next-btn').click();

    // ── Step 4: Review queries → Next → Launch ───────────────────────────
    await expect(
      page.getByText(/How will AI find you/i),
    ).toBeVisible({ timeout: 5_000 });
    await page.getByTestId('step4-next-btn').click();

    // ── Step 5: Launch → redirect to /dashboard ──────────────────────────
    await expect(
      page.getByTestId('step5-complete-state')
        .or(page.getByTestId('step5-error-state'))
        .or(page.getByTestId('step5-launching-state')),
    ).toBeVisible({ timeout: 10_000 });

    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    expect(page.url()).toContain('/dashboard');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GBP Toast Messages (Sprint 91 wizard renders toasts on Step 1)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('17 — Onboarding Wizard GBP Toast Messages', () => {

  test('shows toast for ?source=gbp_failed', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_failed');

    await expect(
      page.getByText(/Google connection failed/i),
    ).toBeVisible({ timeout: 5_000 });

    // Wizard Step 1 should still be visible below the toast
    await expect(
      page.getByText(/Tell us about your business/i),
    ).toBeVisible();
  });

  test('shows toast for ?source=gbp_denied', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_denied');

    await expect(
      page.getByText(/cancelled|No worries/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('shows toast for ?source=gbp_no_accounts', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_no_accounts');

    await expect(
      page.getByText(/No Google Business Profile/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('shows toast for ?source=gbp_no_locations', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_no_locations');

    await expect(
      page.getByText(/No business locations found/i),
    ).toBeVisible({ timeout: 5_000 });
  });
});
