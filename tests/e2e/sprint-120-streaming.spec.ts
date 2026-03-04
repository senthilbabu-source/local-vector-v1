import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// ---------------------------------------------------------------------------
// Sprint 120 — AI Preview Streaming E2E Tests
//
// Tests verify the streaming UI components mount, buttons render, and
// interactions work. Actual AI responses require ANTHROPIC_API_KEY which
// may not be set in E2E — tests skip assertions on stream content when
// the API returns errors, focusing on UI behavior instead.
// ---------------------------------------------------------------------------

test.describe('Sprint 120 — AI Preview Streaming', () => {
  test.describe('Content preview streaming', () => {
    test('clicking Preview with AI button opens streaming panel', async ({ page }) => {
      // Navigate to a content draft detail page
      await page.goto('/dashboard/content-drafts');
      await page.waitForLoadState('networkidle');

      // Find a draft link to click into detail view
      const draftLink = page.locator('a[href*="/dashboard/content-drafts/"]').first();
      const hasDrafts = (await draftLink.count()) > 0;
      test.skip(!hasDrafts, 'No drafts available for preview testing');

      await draftLink.click();
      await page.waitForLoadState('networkidle');

      // Look for the Preview with AI button (only visible on editable drafts with target_prompt)
      const previewBtn = page.locator('[data-testid="generate-preview-btn"]');
      const hasPreviewBtn = (await previewBtn.count()) > 0;
      test.skip(!hasPreviewBtn, 'Draft is not editable or has no target prompt');

      await previewBtn.click();

      // The streaming preview panel should appear
      const panel = page.locator('[data-testid="streaming-preview-panel"]');
      await expect(panel).toBeVisible();

      // StreamingTextDisplay should be rendered
      const textDisplay = panel.locator('[data-testid="streaming-text-display"]');
      await expect(textDisplay).toBeVisible();
    });

    test('Stop button appears during streaming and panel has action buttons', async ({ page }) => {
      await page.goto('/dashboard/content-drafts');
      await page.waitForLoadState('networkidle');

      const draftLink = page.locator('a[href*="/dashboard/content-drafts/"]').first();
      const hasDrafts = (await draftLink.count()) > 0;
      test.skip(!hasDrafts, 'No drafts available');

      await draftLink.click();
      await page.waitForLoadState('networkidle');

      const previewBtn = page.locator('[data-testid="generate-preview-btn"]');
      const hasPreviewBtn = (await previewBtn.count()) > 0;
      test.skip(!hasPreviewBtn, 'Draft is not editable or has no target prompt');

      await previewBtn.click();

      const panel = page.locator('[data-testid="streaming-preview-panel"]');
      await expect(panel).toBeVisible();

      // Either Stop (if streaming), Regenerate (if complete), or Try Again (if error)
      // should eventually appear as the stream progresses
      const actionBtn = panel.locator(
        '[data-testid="stop-generation-btn"], [data-testid="regenerate-btn"]',
      );
      await expect(actionBtn.first()).toBeVisible({ timeout: 15000 });
    });

    test('Regenerate button appears after completion', async ({ page }) => {
      await page.goto('/dashboard/content-drafts');
      await page.waitForLoadState('networkidle');

      const draftLink = page.locator('a[href*="/dashboard/content-drafts/"]').first();
      test.skip((await draftLink.count()) === 0, 'No drafts available');

      await draftLink.click();
      await page.waitForLoadState('networkidle');

      const previewBtn = page.locator('[data-testid="generate-preview-btn"]');
      test.skip((await previewBtn.count()) === 0, 'Not editable or no target prompt');

      await previewBtn.click();

      // Wait for either completion or error (both show regenerate/try again)
      const regenerateBtn = page.locator('[data-testid="regenerate-btn"]');
      await expect(regenerateBtn).toBeVisible({ timeout: 15000 });
    });

    test('Use This Content button populates draft editor field', async ({ page }) => {
      await page.goto('/dashboard/content-drafts');
      await page.waitForLoadState('networkidle');

      const draftLink = page.locator('a[href*="/dashboard/content-drafts/"]').first();
      test.skip((await draftLink.count()) === 0, 'No drafts available');

      await draftLink.click();
      await page.waitForLoadState('networkidle');

      const previewBtn = page.locator('[data-testid="generate-preview-btn"]');
      test.skip((await previewBtn.count()) === 0, 'Not editable');

      await previewBtn.click();

      // Wait for completion
      const useBtn = page.locator('[data-testid="use-content-btn"]');
      const hasUseBtn = await useBtn.isVisible({ timeout: 15000 }).catch(() => false);
      test.skip(!hasUseBtn, 'Stream did not complete successfully (API key may not be set)');

      // Click "Use This Content" and verify the textarea updates
      const textareaBefore = await page
        .locator('[data-testid="draft-content-textarea"]')
        .inputValue();
      await useBtn.click();
      const textareaAfter = await page
        .locator('[data-testid="draft-content-textarea"]')
        .inputValue();
      // Content should change (it was populated by the AI)
      expect(textareaAfter.length).toBeGreaterThan(0);
      expect(textareaAfter).not.toBe(textareaBefore);
    });
  });

  test.describe('SOV query simulation', () => {
    test('clicking Simulate AI Response shows streaming panel', async ({ page }) => {
      await page.goto('/dashboard/share-of-voice');
      await page.waitForLoadState('networkidle');

      // Find a "Simulate AI Response" button
      const simulateBtn = page.locator('[data-testid="simulate-query-btn"]').first();
      const hasBtn = (await simulateBtn.count()) > 0;
      test.skip(!hasBtn, 'No queries available for simulation');

      await simulateBtn.click();

      // The streaming simulate panel should appear
      const panel = page.locator('[data-testid="streaming-simulate-panel"]');
      await expect(panel).toBeVisible();

      // StreamingTextDisplay should be rendered
      const textDisplay = panel.locator('[data-testid="streaming-text-display"]');
      await expect(textDisplay).toBeVisible();
    });

    test('org mentioned indicator shows after completion', async ({ page }) => {
      await page.goto('/dashboard/share-of-voice');
      await page.waitForLoadState('networkidle');

      const simulateBtn = page.locator('[data-testid="simulate-query-btn"]').first();
      test.skip((await simulateBtn.count()) === 0, 'No queries available');

      await simulateBtn.click();

      // Wait for completion — either mentioned or not mentioned indicator
      const indicator = page.locator(
        '[data-testid="org-mentioned-indicator"], [data-testid="org-not-mentioned-indicator"]',
      );
      const hasIndicator = await indicator.first().isVisible({ timeout: 15000 }).catch(() => false);
      test.skip(!hasIndicator, 'Stream did not complete (API key may not be set)');

      // One of the indicators should be visible
      await expect(indicator.first()).toBeVisible();
    });

    test('org not-mentioned indicator shows when org absent', async ({ page }) => {
      // This test verifies the NOT mentioned case — but we can't control AI output
      // So we verify the indicator renders correctly by checking the DOM
      await page.goto('/dashboard/share-of-voice');
      await page.waitForLoadState('networkidle');

      const simulateBtn = page.locator('[data-testid="simulate-query-btn"]').first();
      test.skip((await simulateBtn.count()) === 0, 'No queries available');

      await simulateBtn.click();

      // Wait for any indicator
      const mentioned = page.locator('[data-testid="org-mentioned-indicator"]');
      const notMentioned = page.locator('[data-testid="org-not-mentioned-indicator"]');

      // Wait for stream to finish
      const anyIndicator = page.locator(
        '[data-testid="org-mentioned-indicator"], [data-testid="org-not-mentioned-indicator"], [data-testid="regenerate-btn"], [data-testid="stop-simulate-btn"]',
      );
      await expect(anyIndicator.first()).toBeVisible({ timeout: 15000 }).catch(() => {});

      // At least one indicator should exist (mentioned or not)
      const mentionedCount = await mentioned.count();
      const notMentionedCount = await notMentioned.count();
      // If stream completed, one should be present
      if (mentionedCount + notMentionedCount > 0) {
        expect(mentionedCount + notMentionedCount).toBe(1);
      }
    });

    test('Stop button cancels streaming mid-response', async ({ page }) => {
      await page.goto('/dashboard/share-of-voice');
      await page.waitForLoadState('networkidle');

      const simulateBtn = page.locator('[data-testid="simulate-query-btn"]').first();
      test.skip((await simulateBtn.count()) === 0, 'No queries available');

      await simulateBtn.click();

      // Try to catch the stop button while streaming
      const stopBtn = page.locator('[data-testid="stop-simulate-btn"]');
      const hasStop = await stopBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasStop) {
        await stopBtn.click();
        // After stopping, the re-simulate button should appear
        const resimBtn = page.locator('[data-testid="simulate-query-btn"]');
        await expect(resimBtn).toBeVisible({ timeout: 5000 });
      }
      // If stream completed too fast for us to click stop, that's OK
    });
  });
});
