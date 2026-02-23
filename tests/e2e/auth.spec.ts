// ---------------------------------------------------------------------------
// auth.spec.ts — Phase 17: Auth UI E2E Tests
//
// Tests:
//   1. /login — split-screen layout + Fear/Greed marketing copy visible
//   2. /login — invalid credentials → alert-crimson error banner
//   3. /signup — registration form renders with all 4 required fields
//
// No auth storage state needed — all tests hit public (unauthenticated) pages.
//
// Run: npx playwright test tests/e2e/auth.spec.ts
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// /login — split-screen layout and Fear/Greed marketing copy
// ---------------------------------------------------------------------------

test('login page shows split-screen layout with Fear/Greed marketing copy', async ({
  page,
}) => {
  await page.goto('/login');

  // Left panel is a <section aria-label="LocalVector marketing">
  // Visible on lg+ viewports (Playwright default: 1280×720 → qualifies as lg).
  const marketingPanel = page.getByRole('region', {
    name: /localvector marketing/i,
  });
  await expect(marketingPanel).toBeVisible();

  // Fear block — crimson label + stat copy
  await expect(page.getByText('The Fear')).toBeVisible();
  await expect(
    page.getByText(/72% of diners trust AI answers/i)
  ).toBeVisible();

  // Greed block — emerald label + stat copy
  await expect(page.getByText('The Greed')).toBeVisible();
  await expect(
    page.getByText(/3.+more AI-driven reservations/i)
  ).toBeVisible();

  // Login form is on the right
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();
});

// ---------------------------------------------------------------------------
// /login — invalid credentials → alert-crimson error
// ---------------------------------------------------------------------------

test('login page shows alert-crimson error on invalid credentials', async ({
  page,
}) => {
  await page.goto('/login');

  await page.fill('#email', 'nobody@example.com');
  await page.fill('#password', 'wrong-password-99');
  await page.click('button[type="submit"]');

  // Wait for our error banner to appear (API round-trip to local Supabase).
  // Filter by text to avoid the hidden Next.js route announcer
  // (<div role="alert" id="__next-route-announcer__">) which also has role=alert.
  const errorAlert = page
    .getByRole('alert')
    .filter({ hasText: /invalid|unable to sign in|credentials/i });
  await expect(errorAlert).toBeVisible({ timeout: 10_000 });

  // The error banner must use alert-crimson design token classes
  // (bg-alert-crimson/10 and text-alert-crimson are set in login/page.tsx)
  await expect(errorAlert).toHaveClass(/alert-crimson/);
});

// ---------------------------------------------------------------------------
// /signup — registration form renders
// ---------------------------------------------------------------------------

test('/signup renders the registration form with all required fields', async ({
  page,
}) => {
  await page.goto('/signup');

  // 4 required fields match those in register/page.tsx
  await expect(page.locator('#full_name')).toBeVisible();
  await expect(page.locator('#business_name')).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#password')).toBeVisible();

  // Submit button present
  await expect(
    page.getByRole('button', { name: /create account/i })
  ).toBeVisible();

  // Password hint text present
  await expect(
    page.getByText(/Must be 8\+ characters/i)
  ).toBeVisible();
});
