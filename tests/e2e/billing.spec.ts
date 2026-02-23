// ---------------------------------------------------------------------------
// billing.spec.ts — Phase 17: Billing UI E2E Tests
//
// Uses upload@localvector.ai storage state (complete location, no magic menu).
// This user passes the dashboard onboarding guard and can access /dashboard/billing.
//
// Tests:
//   1. Billing page shows all three pricing tiers; Growth tier has electric-indigo
//      highlight (border-electric-indigo class on the card).
//   2. Clicking the "Upgrade" button triggers the demo checkout action and
//      shows the "Demo mode" banner (STRIPE_SECRET_KEY absent in local dev).
//
// Prerequisites:
//   npx supabase db reset    — ensures upload@localvector.ai is seeded
//   npx playwright test      — Playwright starts the dev server automatically
//
// Run: npx playwright test tests/e2e/billing.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

// Use the pre-authenticated upload user session (complete location, no guard).
test.use({
  storageState: path.join(__dirname, '../../.playwright/upload-user.json'),
});

// ---------------------------------------------------------------------------
// Test 1 — Three pricing tiers + electric-indigo highlight on Pro
// ---------------------------------------------------------------------------

test('billing page shows three pricing tiers with Growth highlighted', async ({
  page,
}) => {
  await page.goto('/dashboard/billing');

  // All three tier names are visible
  await expect(page.getByText('Starter')).toBeVisible();
  await expect(page.getByText('Growth')).toBeVisible();
  await expect(page.getByText('Agency')).toBeVisible();

  // The Growth tier card uses border-electric-indigo for the highlight ring.
  // billing/page.tsx sets `border-2 border-electric-indigo` on the highlighted card.
  const growthCard = page.locator('.border-electric-indigo');
  await expect(growthCard).toBeVisible();

  // The "Most popular" badge appears on the Growth card
  await expect(page.getByText('Most popular')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test 2 — Upgrade button → demo checkout action
// ---------------------------------------------------------------------------

test('clicking Upgrade shows demo mode banner when Stripe is not configured', async ({
  page,
}) => {
  await page.goto('/dashboard/billing');

  // Click the Pro tier "Upgrade" button
  const upgradeButton = page.getByRole('button', { name: 'Upgrade' });
  await expect(upgradeButton).toBeVisible();
  await upgradeButton.click();

  // In local dev STRIPE_SECRET_KEY is absent so createCheckoutSession returns
  // { url: null, demo: true } and the UI swaps the button for a demo banner.
  await expect(
    page.getByText(/Demo mode — Stripe not configured/i)
  ).toBeVisible({ timeout: 10_000 });
});
