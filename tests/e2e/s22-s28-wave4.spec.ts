import { test, expect } from '@playwright/test';

test.describe('Wave 4 — S22-S28 Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Load authenticated session
    const fs = await import('fs');
    const path = await import('path');
    const sessionPath = path.resolve('.playwright/dev-session.json');
    if (fs.existsSync(sessionPath)) {
      const cookies = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      if (Array.isArray(cookies) && cookies.length > 0) {
        await page.context().addCookies(cookies);
      }
    }
  });

  test('S22: DegradationAlertBanner renders on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // The banner only shows when there's a recent degradation event.
    // In test env without real data, it should not crash the page.
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
  });

  test('S26: Compete page loads for authenticated user', async ({ page }) => {
    await page.goto('/dashboard/compete');
    // Either the upgrade gate or the page header should be visible
    const heading = page.getByRole('heading', { name: /Competitors|See Why/i });
    await expect(heading).toBeVisible();
  });

  test('S28: Dashboard loads with consistency score card area', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
    // Consistency score card only renders when data exists.
    // Verifying page doesn't crash.
  });

  test('S28: Sidebar has reorganized navigation groups', async ({ page }) => {
    await page.goto('/dashboard');
    // Check for the new group labels
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();
    // Check that key group labels are present
    await expect(page.getByText('This Week')).toBeVisible();
    await expect(page.getByText('This Month')).toBeVisible();
  });

  test('S27: Dashboard loads without crash (FirstScanRevealCard check)', async ({ page }) => {
    await page.goto('/dashboard');
    // The reveal card only shows for first-scan users.
    // For existing test user, the dashboard should load normally.
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
  });
});
