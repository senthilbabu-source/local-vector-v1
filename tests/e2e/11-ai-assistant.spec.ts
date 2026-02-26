// ---------------------------------------------------------------------------
// 11-ai-assistant.spec.ts — AI Assistant Page E2E (Sprint 60A)
//
// Tests the /dashboard/ai-assistant page.
// Verifies chat UI loads, quick-action buttons render, and messages can be
// typed. Does NOT assert AI responses (no API key in CI).
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('11 — AI Assistant page', () => {

  test('page loads with correct heading', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant');

    await expect(
      page.getByRole('heading', { name: /AI Assistant/i, level: 1 })
    ).toBeVisible();
  });

  test('chat input is visible', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant');

    await expect(
      page.getByPlaceholder('Ask about your AI visibility...')
    ).toBeVisible();
  });

  test('quick-action buttons render', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant');

    // Quick-action suggestion buttons appear when chat is empty
    await expect(page.getByRole('button', { name: /What.*visibility score/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open hallucinations/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /competitors/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /SOV trend/i })).toBeVisible();
  });

  test('can type a message in the chat input', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant');

    const input = page.getByPlaceholder('Ask about your AI visibility...');
    await input.fill('What is my visibility score?');
    await expect(input).toHaveValue('What is my visibility score?');
  });

  test('subtitle text is visible', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant');

    await expect(
      page.getByText(/Ask questions about your AI visibility/i)
    ).toBeVisible();
  });
});
