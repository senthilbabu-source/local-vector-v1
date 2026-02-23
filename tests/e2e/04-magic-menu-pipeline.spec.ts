// ---------------------------------------------------------------------------
// 04-magic-menu-pipeline.spec.ts — AI Magic Menu Pipeline
//
// Tests the full magic menu flow for upload@localvector.ai:
//   UploadState → "Simulate AI Parsing" → ReviewState (confidence triage) →
//   certify checkbox → "Approve All & Publish to AI" → LinkInjectionModal
//
// Authentication:
//   Uses the upload@ session saved by global.setup.ts.
//   upload@localvector.ai has a complete location (no onboarding guard) and
//   no existing magic_menus record (so UploadState renders on first visit).
//
// ⚠️  NOT idempotent: this test writes a magic_menus record for upload@.
//   Run `npx supabase db reset` before each full E2E run to restore the
//   no-menu state so UploadState renders again on the next run.
//
// Confidence triage: simulateAIParsing() tries real OpenAI first (if
// OPENAI_API_KEY is set), then falls back to deterministic mock data.
//   Mock fallback:    3 Auto-Approved + 3 Needs Review + 0 Must Edit
//   Real OpenAI:      all items may score ≥0.85 → all Auto-Approved
// Tests assert tier presence (not exact counts) so both paths pass.
//   → 0 Must Edit items → "Approve All & Publish to AI" enabled after certify
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const UPLOAD_USER_STATE = path.join(__dirname, '../../.playwright/upload-user.json');
test.use({ storageState: UPLOAD_USER_STATE });

test.describe('04 — Magic Menu Pipeline: AI simulation → publish → modal', () => {

  test('full pipeline: Simulate AI Parsing → triage → publish → LinkInjectionModal', async ({ page }) => {

    // ── 1. Navigate to the magic-menus page ──────────────────────────────────
    await page.goto('/dashboard/magic-menus');

    // upload@ has no magic menu — UploadState renders with 3-tab UI.
    await expect(
      page.getByRole('tab', { name: /AI Magic Extract/ })
    ).toBeVisible({ timeout: 10_000 });

    // ── 2. All 3 upload tabs are present ─────────────────────────────────────
    await expect(page.getByRole('tab', { name: /Gold Standard CSV/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /POS Export/ })).toBeVisible();

    // AI Magic Extract tab is active by default.
    await expect(
      page.getByRole('tabpanel', { name: 'AI Magic Extract' })
    ).toBeVisible();

    // ── 3. Click "Simulate AI Parsing" ───────────────────────────────────────
    // UploadState.tsx has a 2-second setTimeout before calling simulateAIParsing().
    // Total wait: ~2s delay + server action round-trip + React render.
    await page.getByRole('button', { name: 'Simulate AI Parsing' }).click();

    // Loading indicator while isParsing=true.
    await expect(page.getByText(/Analyzing with AI/i)).toBeVisible({ timeout: 5_000 });

    // ── 4. Wait for ReviewState to appear ────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'AI Extraction Results' })
    ).toBeVisible({ timeout: 15_000 });

    // ── 5. Assert ReviewState triage structure ────────────────────────────────
    // ⚠️  Real OpenAI (GPT-4o) is non-deterministic: it may return different item
    //     names, counts, and confidence scores than the deterministic mock fallback.
    //     We assert the always-present structural elements, not AI output specifics.

    // Right-pane Triage Summary always renders all three row labels (even when
    // the corresponding count is 0). These are stable, AI-output-independent.
    await expect(page.getByText('Auto-approved', { exact: true })).toBeVisible();
    await expect(page.getByText('Needs review',  { exact: true })).toBeVisible();
    await expect(page.getByText('Must edit',     { exact: true })).toBeVisible();

    // Left-pane: Auto-Approved tier section always renders for clear menu text
    // (GPT-4o assigns ≥0.85 for unambiguous items; mock fallback also produces some).
    await expect(
      page.locator('p').filter({ hasText: /Auto-Approved/ }).first()
    ).toBeVisible();

    // "Must Edit" tier only renders when confidence < 0.60. The SAMPLE_MENU_TEXT
    // is unambiguous, so neither real GPT-4o nor the mock produces blocked items.
    await expect(
      page.locator('p').filter({ hasText: /Must Edit/ })
    ).not.toBeVisible();

    // ── 6. Check the certification checkbox ──────────────────────────────────
    // ReviewState.tsx: the <input> is sr-only; clicking the label triggers it.
    // The label wraps both the hidden input and the certification text span.
    await page.locator('label').filter({
      hasText: 'I certify this menu is accurate.',
    }).click();

    // Publish button is now enabled (blockedItems.length=0 + certified=true).
    const publishBtn = page.getByRole('button', { name: 'Approve All & Publish to AI' });
    await expect(publishBtn).toBeEnabled();

    // ── 7. Publish ────────────────────────────────────────────────────────────
    await publishBtn.click();

    // ── 8. Assert LinkInjectionModal appears ──────────────────────────────────
    // MenuWorkspace.tsx: after approveAndPublish() succeeds, onPublished() fires
    // and renders LinkInjectionModal with the public slug.
    const modal = page.getByRole('dialog', { name: 'Distribute to AI Engines' });
    await expect(modal).toBeVisible({ timeout: 15_000 });

    // The modal displays the relative path "/m/{slug}" in a font-mono span.
    const urlSpan = modal.locator('.font-mono');
    const menuPath = await urlSpan.textContent();
    expect(menuPath).toMatch(/^\/m\//);

    // ── 9. Assert CTA elements are present ───────────────────────────────────
    await expect(
      modal.getByRole('link', { name: /Open Google Business Profile/i })
    ).toBeVisible();

    await expect(
      modal.getByRole('button', { name: /I pasted this link into Google/i })
    ).toBeVisible();

    // Copy button is present.
    await expect(modal.getByRole('button', { name: /Copy/i })).toBeVisible();
  });
});
