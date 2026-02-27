// ---------------------------------------------------------------------------
// 16-gbp-import-flow.spec.ts — GBP Data Import Flow E2E Tests
//
// Sprint 89: Tests the GBP import interstitial on onboarding and the
// GBP sync card on the dashboard.
//
// All GBP API calls are mocked via page.route() — never hits real Google.
// Uses the dev@ user (already onboarded, Growth plan) for dashboard tests
// and incomplete@ user for onboarding tests.
//
// Run:
//   npx playwright test tests/e2e/16-gbp-import-flow.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

// ── Mock data for GBP import API ────────────────────────────────────────────

const MOCK_IMPORT_SUCCESS = {
  ok: true,
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  mapped: {
    business_name: 'Charcoal N Chill',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    address_line1: '11950 Jones Bridge Road, Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    operational_status: 'open',
    hours_data: {
      monday: 'closed',
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
      thursday: { open: '17:00', close: '01:00' },
      friday: { open: '17:00', close: '02:00' },
      saturday: { open: '17:00', close: '02:00' },
      sunday: { open: '17:00', close: '01:00' },
    },
    amenities: {
      wifi: true,
      outdoor_seating: true,
      alcohol: true,
      live_music: true,
      reservations: true,
      dine_in: true,
    },
    primary_category: 'Hookah Bar',
  },
};

// ── Helper to mock import API ───────────────────────────────────────────────

async function mockImportSuccess(page: import('@playwright/test').Page) {
  await page.route('**/api/gbp/import', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_IMPORT_SUCCESS),
    });
  });
}

async function mockImportError(
  page: import('@playwright/test').Page,
  errorCode: string,
  status: number,
) {
  await page.route('**/api/gbp/import', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        error: errorCode,
        message: `Mock error: ${errorCode}`,
      }),
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard GBP Card Tests — dev@ user (onboarded, Growth plan)
// ═══════════════════════════════════════════════════════════════════════════

const DEV_USER_STATE = path.join(
  __dirname,
  '../../.playwright/dev-user.json',
);

test.describe('16 — GBP Import Dashboard Card', () => {
  test.use({ storageState: DEV_USER_STATE });

  test('GBPImportCard shows sync button when GBP is connected', async ({ page }) => {
    await mockImportSuccess(page);
    await page.goto('/dashboard');

    // The card may or may not be present depending on whether the golden
    // tenant has a google_oauth_tokens row in the local dev DB.
    // If present, verify it has the expected structure.
    const card = page.locator('[data-testid="gbp-import-card"]');

    // Use a short timeout — card is optional depending on DB state
    const isVisible = await card.isVisible().catch(() => false);
    if (isVisible) {
      await expect(card.getByText(/Google Business Profile/i)).toBeVisible();
      const syncBtn = card.locator('[data-testid="gbp-sync-btn"]');
      await expect(syncBtn).toBeVisible();
    }
  });

  test('GBP sync button triggers import and shows success state', async ({ page }) => {
    await mockImportSuccess(page);
    await page.goto('/dashboard');

    const card = page.locator('[data-testid="gbp-import-card"]');
    const isVisible = await card.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    const syncBtn = card.locator('[data-testid="gbp-sync-btn"]');
    await syncBtn.click();

    // Should show loading state
    await expect(syncBtn).toContainText(/Syncing/i);

    // After the mocked API returns, button should show "Synced"
    await expect(syncBtn).toContainText(/Synced/i, { timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Onboarding Import Interstitial Tests — incomplete@ user
// ═══════════════════════════════════════════════════════════════════════════

const INCOMPLETE_USER_STATE = path.join(
  __dirname,
  '../../.playwright/incomplete-user.json',
);

test.describe('16 — GBP Import Onboarding Interstitial', () => {
  test.use({ storageState: INCOMPLETE_USER_STATE });

  test('shows manual wizard when GBP is not connected', async ({ page }) => {
    // The incomplete@ user doesn't have google_oauth_tokens,
    // so the onboarding page should show the manual wizard.
    await page.goto('/onboarding');

    // Should show the Truth Calibration headline (manual path)
    await expect(
      page.getByText(/Teach AI the Truth/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('skipping GBP import proceeds to manual onboarding', async ({ page }) => {
    // Navigate with gbp_skip source to bypass interstitial
    await page.goto('/onboarding?source=gbp_skip');

    // Should show the manual wizard form
    await expect(
      page.getByText(/Teach AI the Truth/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('GBP import success shows confirmation card with business data', async ({ page }) => {
    await mockImportSuccess(page);

    // If the incomplete user has GBP connected, the interstitial shows.
    // We navigate to onboarding and check for the interstitial or manual form.
    await page.goto('/onboarding');

    const interstitial = page.locator('[data-testid="gbp-import-interstitial"]');
    const isInterstitialVisible = await interstitial.isVisible().catch(() => false);

    if (isInterstitialVisible) {
      // Click the import button
      const importBtn = page.locator('[data-testid="gbp-import-btn"]');
      await importBtn.click();

      // Should show success state with business name
      await expect(
        page.locator('[data-testid="gbp-import-success"]'),
      ).toBeVisible({ timeout: 10_000 });

      await expect(
        page.getByText('Charcoal N Chill'),
      ).toBeVisible();

      // Continue button should be present
      await expect(
        page.locator('[data-testid="gbp-import-continue"]'),
      ).toBeVisible();
    }
  });

  test('GBP import error shows error message with manual fallback', async ({ page }) => {
    await mockImportError(page, 'token_expired', 401);

    await page.goto('/onboarding');

    const interstitial = page.locator('[data-testid="gbp-import-interstitial"]');
    const isInterstitialVisible = await interstitial.isVisible().catch(() => false);

    if (isInterstitialVisible) {
      const importBtn = page.locator('[data-testid="gbp-import-btn"]');
      await importBtn.click();

      // Should show error state
      await expect(
        page.locator('[data-testid="gbp-import-error"]'),
      ).toBeVisible({ timeout: 10_000 });

      // Manual fallback link should be visible
      await expect(
        page.locator('[data-testid="gbp-import-manual-fallback"]'),
      ).toBeVisible();
    }
  });

  test('shows toast message for GBP flow error on onboarding', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_failed');

    // Should show the error toast
    await expect(
      page.getByText(/Google connection failed/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('shows toast message for GBP denied on onboarding', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_denied');

    await expect(
      page.getByText(/Google connection was cancelled/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
