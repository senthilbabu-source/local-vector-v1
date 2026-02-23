// E2E Test 1 — The Viral Wedge (Phase 16 Free Hallucination Scanner)
//
// Tests the complete public scanner flow on the marketing landing page (/).
// No authentication required — this page is public.
//
// Key timing note: The `runFreeScan` Server Action (app/actions/marketing.ts)
// contains a deliberate 2-second setTimeout to simulate AI scanning latency.
// This test must wait for the full delay before asserting the result card.
// The Playwright timeout is 30s (playwright.config.ts), which comfortably
// accommodates the 2s delay + React render + network round-trip.
//
// All selectors use accessible text and ARIA roles — no data-testid needed.
// The text strings match Phase 16's ViralScanner.tsx and marketing.ts exactly.

import { test, expect } from '@playwright/test';

test.describe('Viral Wedge — Free Hallucination Scanner', () => {
  test('submits the free scan form and shows the red alert card', async ({ page }) => {
    // ── 1. Visit the marketing landing page ──────────────────────────────────
    await page.goto('/');

    // Assert the headline is present so we know the right page loaded.
    await expect(
      page.getByRole('heading', { name: /Is AI Hallucinating Your Business/i })
    ).toBeVisible();

    // ── 2. Fill in the scanner form ──────────────────────────────────────────
    await page.getByPlaceholder('Business Name').fill('Charcoal N Chill');
    await page.getByPlaceholder('City, State').fill('Alpharetta, GA');

    // ── 3. Submit and wait for the result card ───────────────────────────────
    // The runFreeScan Server Action has a 2-second setTimeout, but on a warm
    // dev server with a real Perplexity API the response arrives before Playwright
    // polls for the isPending state. Skip the racy "Scanning AI Models…" assertion
    // and jump directly to waiting for the result.
    await page.getByRole('button', { name: /Scan for Hallucinations/i }).click();

    // ── 4. Wait for the result card (after the 2-second mock delay) ──────────
    // The ViralScanner replaces the form with the red alert card when result
    // is set. We give it 10 seconds to be safe.
    const alertHeading = page.getByText('AI Hallucination Detected');
    await expect(alertHeading).toBeVisible({ timeout: 10_000 });

    // ── 5. Assert hallucination details are correct ───────────────────────────
    // These strings come from the runFreeScan mock payload in marketing.ts:
    //   { engine: 'ChatGPT', claim_text: 'Permanently Closed', expected_truth: 'Open' }
    //
    // Scope assertions to the result card to avoid strict-mode violations —
    // "ChatGPT" also appears in the page headline, subhead, and form description.
    const card = page.getByTestId('hallucination-card');

    // Use exact: true to avoid matching the context note paragraph
    // ("{engine} is currently telling…") which also contains "ChatGPT".
    await expect(card.getByText('ChatGPT Claims', { exact: true })).toBeVisible();
    // exact: true scopes to the <p> element; avoids matching the lowercase
    // "permanently closed" in the context note span below.
    await expect(card.getByText('Permanently Closed', { exact: true })).toBeVisible();
    await expect(card.getByText('Open', { exact: true })).toBeVisible();

    // ── 6. Assert the CTA points to /login ───────────────────────────────────
    const ctaLink = page.getByRole('link', {
      name: /Claim Your Profile to Fix This Now/i,
    });
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toHaveAttribute('href', '/login');
  });

  test('displays the live detection eyebrow badge in the hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Live AI Hallucination Detection/i)).toBeVisible();
  });

  test('displays the $12,000 steakhouse case study', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/\$12,000/i)).toBeVisible();
    await expect(page.getByText(/Steakhouse Hallucination/i)).toBeVisible();
  });
});
