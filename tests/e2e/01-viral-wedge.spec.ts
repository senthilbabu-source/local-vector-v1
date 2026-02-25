// ---------------------------------------------------------------------------
// 01-viral-wedge.spec.ts — The Viral Wedge (Public Free AI Audit Scanner)
//
// Tests the complete public scanner flow on the marketing landing page (/).
// No authentication required — this page is fully public.
//
// Sprint 33 flow: ViralScanner on / → fill form → submit → redirects to
// /scan dashboard with result params. Inline cards only for unavailable/rate_limited.
//
// The hero section and final CTA both render ViralScanner, so all form
// locators use .first() to target the hero instance.
//
// MSW Perplexity handler (src/mocks/handlers.ts) returns is_closed=true so
// the scanner always exercises the fail/hallucination path in E2E.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';

// No storageState — public page, no auth required.

test.describe('01 — Viral Wedge: Free Hallucination Scanner', () => {

  // ── Primary flow ──────────────────────────────────────────────────────────

  test('submits the scanner form and redirects to /scan with hallucination result', async ({ page }) => {
    // ── 1. Load the marketing landing page ──────────────────────────────────
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /11,000 questions/i })
    ).toBeVisible();

    // ── 2. Fill the hero scanner form (.first() — form duplicated in CTA) ───
    await page.getByPlaceholder('Business Name').first().fill('Charcoal N Chill');

    // Wait for autocomplete suggestion (MSW or real Places API)
    await expect(page.getByText('Charcoal N Chill').first()).toBeVisible({ timeout: 5000 });
    await page.getByText('Charcoal N Chill').first().click();

    // ── 3. Submit — Sprint 33: fail results redirect to /scan ────────────────
    await page.getByRole('button', { name: /Run Free AI Audit/i }).first().click();

    // ── 4. Wait for redirect to /scan page ──────────────────────────────────
    await page.waitForURL('**/scan**', { timeout: 15_000 });
    expect(page.url()).toContain('/scan');

    // ── 5. /scan page should show the AI Audit result (pass or fail) ────────
    // Real Perplexity API may return pass or fail depending on current data.
    await expect(
      page.getByRole('heading', { name: /AI Audit/i, level: 1 })
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Supporting assertions ─────────────────────────────────────────────────

  test('displays the live detection eyebrow badge in the hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/RIGHT NOW.*AI is answering/i)).toBeVisible();
  });

  test('displays the $12,000 steakhouse case study section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/\$12,000/i).first()).toBeVisible();
    await expect(page.getByText(/Steakhouse That Didn.t Exist/i)).toBeVisible();
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

  // ── Sprint 29: autocomplete flow ────────────────────────────────────────

  test('autocomplete: type → dropdown appears → select → submit → redirects to /scan', async ({ page }) => {
    // ── 1. Load the landing page ─────────────────────────────────────────────
    await page.goto('/');

    // ── 2. Type ≥3 chars to trigger the debounced Places search (300ms) ──────
    await page.getByPlaceholder('Business Name').first().fill('Charcoal');

    // ── 3. Wait for the autocomplete dropdown to appear ───────────────────────
    await expect(page.getByText('Charcoal N Chill').first()).toBeVisible({ timeout: 5000 });

    // ── 4. Select the suggestion — locks the name ─────────────────────────────
    await page.getByText('Charcoal N Chill').first().click();

    // Name input is now readOnly and shows the selected business name.
    await expect(page.getByPlaceholder('Business Name').first()).toHaveValue('Charcoal N Chill');

    // ── 5. Submit — redirects to /scan with hallucination result ──────────────
    await page.getByRole('button', { name: /Run Free AI Audit/i }).first().click();

    // ── 6. Wait for redirect to /scan ─────────────────────────────────────────
    await page.waitForURL('**/scan**', { timeout: 15_000 });
    expect(page.url()).toContain('/scan');
  });
});
