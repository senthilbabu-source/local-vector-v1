// ---------------------------------------------------------------------------
// 01-viral-wedge.spec.ts — The Viral Wedge (Public Free Hallucination Scanner)
//
// Tests the complete public scanner flow on the marketing landing page (/).
// No authentication required — this page is fully public.
//
// Key timing: runFreeScan() (app/actions/marketing.ts) has a deliberate
// 2-second setTimeout to simulate AI scanning latency. The 30s Playwright
// timeout comfortably accommodates: 2s delay + React render + network.
//
// All selectors use accessible text and ARIA roles.
// data-testid="hallucination-card" — ViralScanner fail-path card (is_closed=true).
// data-testid="no-hallucination-card" — ViralScanner pass-path card (is_closed=false).
//
// MSW Perplexity handler (src/mocks/handlers.ts) returns is_closed=true so
// the primary scanner flow always exercises the fail/hallucination path in E2E.
// The pass path is unit-tested in free-scan-pass.test.ts (AI_RULES §21).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';

// No storageState — public page, no auth required.

test.describe('01 — Viral Wedge: Free Hallucination Scanner', () => {

  // ── Primary flow ──────────────────────────────────────────────────────────

  test('submits the scanner form and shows the red hallucination alert card', async ({ page }) => {
    // ── 1. Load the marketing landing page ──────────────────────────────────
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Is AI Hallucinating Your Business/i })
    ).toBeVisible();

    // ── 2. Fill in the free scan form ────────────────────────────────────────
    await page.getByPlaceholder('Business Name').fill('Charcoal N Chill');
    await page.getByPlaceholder('City, State').fill('Alpharetta, GA');

    // ── 3. Submit and wait for the result ───────────────────────────────────
    // The Server Action has a 2-second setTimeout (runFreeScan in marketing.ts).
    // The button briefly shows "Scanning AI Models…" (isPending=true), but this
    // micro-transition completes faster than Playwright can check in a warm dev
    // server. We skip the racy isPending assertion and wait directly for the result.
    await page.getByRole('button', { name: /Scan for Hallucinations/i }).click();

    // ── 4. Wait for the result card (after the 2-second delay) ───────────────
    await expect(page.getByText('AI Hallucination Detected')).toBeVisible({ timeout: 10_000 });

    // ── 5. Assert hallucination details inside the scoped card ───────────────
    // Scope to [data-testid="hallucination-card"] to avoid matching the same
    // strings in the page headline and subheading.
    const card = page.getByTestId('hallucination-card');

    // Engine label — "ChatGPT Claims" (exact match avoids the headline copy).
    await expect(card.getByText('ChatGPT Claims', { exact: true })).toBeVisible();

    // The claim text: "Permanently Closed" (capitalised, exact).
    await expect(card.getByText('Permanently Closed', { exact: true })).toBeVisible();

    // The truth: "Open" (exact — avoids matching "Open" within time strings).
    await expect(card.getByText('Open', { exact: true })).toBeVisible();

    // ── 6. Assert the card has the crimson border class ──────────────────────
    // border-alert-crimson is applied via ViralScanner.tsx's className prop.
    const cardClasses = await card.getAttribute('class');
    expect(cardClasses).toContain('border-alert-crimson');

    // ── 7. Assert the CTA routes to /login ───────────────────────────────────
    const ctaLink = page.getByRole('link', {
      name: /Claim Your Profile to Fix This Now/i,
    });
    await expect(ctaLink).toBeVisible();
    await expect(ctaLink).toHaveAttribute('href', '/login');
  });

  // ── Supporting assertions ─────────────────────────────────────────────────

  test('displays the live detection eyebrow badge in the hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Live AI Hallucination Detection/i)).toBeVisible();
  });

  test('displays the $12,000 steakhouse case study section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/\$12,000/i)).toBeVisible();
    await expect(page.getByText(/Steakhouse Hallucination/i)).toBeVisible();
  });

  // ── AEO infrastructure (Sprint 25C) ───────────────────────────────────────

  test('GET /llms.txt returns 200 with text/plain content-type', async ({ request }) => {
    const response = await request.get('/llms.txt');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/plain');
  });

  test('GET /ai-config.json returns 200 with entity key present', async ({ request }) => {
    const response = await request.get('/ai-config.json');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'] ?? '';
    expect(contentType).toContain('application/json');
    const body = await response.json();
    expect(body).toHaveProperty('entity');
  });
});
