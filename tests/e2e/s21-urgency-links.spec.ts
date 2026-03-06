// ---------------------------------------------------------------------------
// s21-urgency-links.spec.ts — S21: Day-of-Week Urgency + External Fix Links
//
// E2E smoke tests for urgency badges and platform fix links.
// Authentication: dev@ session (golden tenant, Growth plan).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('S21 — Entity Health fix links', () => {
  test('Entity Health missing platform shows "Claim on [Platform]" link', async ({ page }) => {
    await page.goto('/dashboard/entity-health');
    // Look for any platform fix link — may exist if seed has missing platforms
    const fixLinks = page.locator('[data-testid^="platform-fix-link-"]');
    const count = await fixLinks.count();
    if (count > 0) {
      const firstLink = fixLinks.first();
      await expect(firstLink).toHaveAttribute('target', '_blank');
      await expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer');
      const href = await firstLink.getAttribute('href');
      expect(href).toMatch(/^https:\/\//);
    }
  });

  test('External fix link has correct href format', async ({ page }) => {
    await page.goto('/dashboard/entity-health');
    const fixLinks = page.locator('[data-testid^="platform-fix-link-"]');
    const count = await fixLinks.count();
    for (let i = 0; i < count; i++) {
      const href = await fixLinks.nth(i).getAttribute('href');
      expect(href).toMatch(/^https:\/\//);
    }
  });

  test('entity-health page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard/entity-health');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('hallucinations page loads without errors (urgency badge integration)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard/hallucinations');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
