// ---------------------------------------------------------------------------
// hybrid-upload.spec.ts — Playwright E2E: Gold Standard CSV → Confidence Triage
//
// Prerequisites (run before `npx playwright test`):
//   1. npx supabase db reset   — seeds upload@localvector.ai (Section 12)
//   2. npx playwright test     — Playwright starts it via webServer config
//                                (global-setup.ts saves .playwright/upload-user.json)
//
// What this test proves:
//   • The magic-menus page shows the 3-tab upload UI (UploadState) for a user
//     who has a complete location but no existing magic menu.
//   • Clicking "Gold Standard CSV" and uploading a .csv file via setInputFiles()
//     triggers the uploadLocalVectorCsv Server Action.
//   • On success, the workspace transitions from UploadState → ReviewState
//     (Confidence Triage UI) and renders the extracted item names.
//
// ⚠️  NOT idempotent: the test writes a magic_menus record for upload@localvector.ai.
//     Run `npx supabase db reset` before each full E2E run to restore the
//     no-menu state so UploadState is shown again on the next run.
//
// Test user credentials (seeded in supabase/seed.sql Section 12):
//   Email    : upload@localvector.ai
//   Password : Password123!
//   Org      : Upload Test Org (c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22)
//   Location : Upload Test Restaurant (hours_data + amenities non-null → no onboarding redirect)
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

// Fixture CSV — 2 items, confidence = 1.0 each (CSV path always auto-approves)
const FIXTURE_CSV = path.join(__dirname, '../fixtures/sample-gold-menu.csv');

// Use the pre-authenticated upload user session saved by tests/global-setup.ts.
// This avoids an inline login race condition where waitForURL('/dashboard') could
// resolve mid-redirect (before the onboarding guard completes), making it appear
// login succeeded even if the user ends up at /onboarding. The storage state
// approach is also consistent with billing.spec.ts.
test.use({
  storageState: path.join(__dirname, '../../.playwright/upload-user.json'),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Hybrid Upload — Gold Standard CSV path', () => {

  // ── Tab visibility ─────────────────────────────────────────────────────────

  test('magic-menus page shows all 3 upload tabs', async ({ page }) => {
    await page.goto('/dashboard/magic-menus');

    // All three tab buttons must be visible in the tablist
    await expect(page.getByRole('tab', { name: /AI Magic Extract/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Gold Standard CSV/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /POS Export/ })).toBeVisible();
  });

  // ── CSV upload → Confidence Triage ─────────────────────────────────────────

  test('CSV upload transitions to Confidence Triage (ReviewState)', async ({ page }) => {
    await page.goto('/dashboard/magic-menus');

    // ── Step 1: Switch to the Gold Standard CSV tab ────────────────────────
    await page.getByRole('tab', { name: /Gold Standard CSV/ }).click();

    // The CSV tab panel should now be active and visible
    await expect(
      page.getByRole('tabpanel', { name: 'Gold Standard CSV' })
    ).toBeVisible();

    // ── Step 2: Upload the fixture CSV ─────────────────────────────────────
    // The file input is inside the active tab panel — only one is in the DOM
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_CSV);

    // ── Step 3: Submit the upload form ─────────────────────────────────────
    await page.getByRole('button', { name: /Import Gold Standard CSV/ }).click();

    // ── Step 4: Wait for ReviewState to appear ─────────────────────────────
    // ReviewState renders the "AI Extraction Results" heading once the Server
    // Action resolves and onParseComplete() transitions the workspace view.
    await expect(
      page.getByText('AI Extraction Results')
    ).toBeVisible({ timeout: 15_000 });

    // ── Step 5: Assert fixture items are present in the triage list ─────────
    await expect(page.getByText('Brisket Plate')).toBeVisible();
    await expect(page.getByText('Mac & Cheese')).toBeVisible();

    // ── Step 6: All items are auto-approved (confidence = 1.0 for CSV path) ─
    // The "Auto-Approved" section heading must be visible
    await expect(page.getByText(/Auto-Approved —/i)).toBeVisible();

    // No "Must Edit" blocked items — the Publish button should be enabled
    // once the certification checkbox is checked (blocked count = 0 already)
    await expect(page.getByText(/Must Edit —/i)).not.toBeVisible();
  });
});
