// ---------------------------------------------------------------------------
// 18-business-info.spec.ts — Business Info Editor E2E Tests (Sprint 93)
//
// Tests the Business Info Settings page: pre-population from seed data,
// navigation from Settings, GBP sync card visibility, form layout.
//
// Uses the dev@ session (golden tenant: Charcoal N Chill, Growth plan).
// Read-only tests — does NOT save changes (avoids mutating seed data).
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('18 — Business Info Editor', () => {

  test('page renders with heading "Business Information"', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    await expect(
      page.getByRole('heading', { name: 'Business Information', level: 1 }),
    ).toBeVisible();

    await expect(
      page.getByText(/Keep your hours and details accurate/),
    ).toBeVisible();
  });

  test('form is pre-populated with golden tenant data', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    await expect(page.getByTestId('basic-info-name')).toHaveValue('Charcoal N Chill');
    await expect(page.getByTestId('basic-info-city')).toHaveValue('Alpharetta');
    await expect(page.getByTestId('basic-info-state')).toHaveValue('GA');
    await expect(page.getByTestId('basic-info-zip')).toHaveValue('30005');
  });

  test('phone field shows seed data', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');
    await expect(page.getByTestId('basic-info-phone')).toHaveValue('(470) 546-4866');
  });

  test('operational status defaults to OPERATIONAL', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');
    await expect(page.getByTestId('basic-info-status')).toHaveValue('OPERATIONAL');
  });

  test('hours grid renders 7 day rows', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    for (const day of days) {
      await expect(page.getByText(day, { exact: true })).toBeVisible();
    }
  });

  test('all 6 amenity labels are visible', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    const labels = ['Serves alcohol', 'Outdoor seating', 'Takes reservations', 'Live music', 'Hookah lounge', 'Kid friendly'];
    for (const label of labels) {
      await expect(page.getByText(label)).toBeVisible();
    }
  });

  test('Save Changes button is visible and enabled', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    const saveBtn = page.getByTestId('business-info-save-btn');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
    await expect(saveBtn).toHaveText('Save Changes');
  });

  test('Back to Settings link navigates to settings page', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    const backLink = page.getByText('Back to Settings');
    await expect(backLink).toBeVisible();
    await backLink.click();

    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });

  test('Settings page has Edit business information link', async ({ page }) => {
    await page.goto('/dashboard/settings');

    const link = page.getByText('Edit business information');
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL(/\/dashboard\/settings\/business-info/);
  });

  test('validation prevents save when business name is empty', async ({ page }) => {
    await page.goto('/dashboard/settings/business-info');

    // Clear the business name
    await page.getByTestId('basic-info-name').fill('');
    await page.getByTestId('business-info-save-btn').click();

    // Should show validation error, not "Saved"
    await expect(page.getByText(/Business name is required/)).toBeVisible();
  });
});
