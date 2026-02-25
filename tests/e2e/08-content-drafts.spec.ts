// ---------------------------------------------------------------------------
// 08-content-drafts.spec.ts — Content Drafts Page E2E (Sprint 42)
//
// Tests the /dashboard/content-drafts page.
// The dev@ golden tenant is on a Growth plan, so the full page renders
// (no UpgradeGate). Seed data includes at least one content draft.
//
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('08 — Content Drafts page', () => {

  test('page loads with correct header and summary strip', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');

    // Page header
    await expect(
      page.getByRole('heading', { name: /Content Drafts/i, level: 1 })
    ).toBeVisible();

    // Summary strip cards (scoped to paragraphs to avoid matching filter tab buttons)
    await expect(page.getByText('Pending Review')).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Approved' })).toBeVisible();
    await expect(page.getByText('Total Drafts')).toBeVisible();
  });

  test('filter tabs are visible', async ({ page }) => {
    await page.goto('/dashboard/content-drafts');

    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Drafts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Published' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archived' })).toBeVisible();
  });

  test('can navigate to Content Drafts from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Content' }).click();
    await expect(page).toHaveURL(/\/dashboard\/content-drafts/);
    await expect(
      page.getByRole('heading', { name: /Content Drafts/i, level: 1 })
    ).toBeVisible();
  });
});
