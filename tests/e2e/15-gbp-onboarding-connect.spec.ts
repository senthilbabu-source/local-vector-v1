// ---------------------------------------------------------------------------
// 15-gbp-onboarding-connect.spec.ts — GBP Onboarding Connect Interstitial
//
// Sprint 89: Tests the /onboarding/connect page and fallback paths.
// Does NOT test actual Google OAuth (requires live credentials).
// Tests the interstitial UI, manual fallback link, and toast messages.
//
// Uses the incomplete@ user who has hours_data=NULL and amenities=NULL.
//
// Run:
//   npx playwright test tests/e2e/15-gbp-onboarding-connect.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const INCOMPLETE_USER_STATE = path.join(
  __dirname,
  '../../.playwright/incomplete-user.json'
);
test.use({ storageState: INCOMPLETE_USER_STATE });

test.describe('15 — GBP Onboarding Connect Interstitial', () => {

  test('shows connect page with GBP button and manual fallback link', async ({ page }) => {
    await page.goto('/onboarding/connect');

    // Headline should be visible
    await expect(
      page.getByText(/Connect.*Google Business Profile/i)
    ).toBeVisible({ timeout: 5_000 });

    // Google connect button should be present
    await expect(
      page.getByRole('link', { name: /Sign in with Google|Connect Google/i })
        .or(page.getByRole('button', { name: /Sign in with Google|Connect Google/i }))
    ).toBeVisible();

    // Manual fallback link should be present
    await expect(
      page.getByRole('link', { name: /fill in manually|manually/i })
        .or(page.getByText(/manually/i))
    ).toBeVisible();
  });

  test('manual link navigates to /onboarding (original wizard)', async ({ page }) => {
    await page.goto('/onboarding/connect');

    // Click the manual fallback link
    const manualLink = page.getByRole('link', { name: /fill in manually|manually/i })
      .or(page.getByText(/manually/i).locator('a'));
    await manualLink.first().click();

    // Should land on the original onboarding wizard
    await page.waitForURL('**/onboarding', { timeout: 10_000 });
    expect(page.url()).toContain('/onboarding');
    expect(page.url()).not.toContain('/connect');

    // The Sprint 91 wizard Step 1 headline should be visible
    await expect(
      page.getByText(/Tell us about your business/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('displays fallback toast when redirected with ?source=gbp_failed', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_failed');

    // Toast or banner with failure message should be visible
    await expect(
      page.getByText(/Google connection failed|failed.*manually/i)
    ).toBeVisible({ timeout: 5_000 });

    // The wizard Step 1 should still be rendered below the toast
    await expect(
      page.getByText(/Tell us about your business/i)
    ).toBeVisible();
  });

  test('displays fallback toast when redirected with ?source=gbp_denied', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_denied');

    await expect(
      page.getByText(/cancelled|denied|No worries/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('displays fallback toast when redirected with ?source=gbp_no_accounts', async ({ page }) => {
    await page.goto('/onboarding?source=gbp_no_accounts');

    await expect(
      page.getByText(/No Google Business Profile|not found/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});
