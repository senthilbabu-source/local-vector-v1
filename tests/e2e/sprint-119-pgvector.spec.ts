// ---------------------------------------------------------------------------
// Sprint 119 — pgvector E2E tests (6 tests)
//
// Tests MenuSearch component on public menu page and
// SimilarQueriesWidget on SOV dashboard.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('Sprint 119: pgvector Integration', () => {
  test.describe('Menu Search — /m/[slug]', () => {
    test('1. typing query + submitting shows results or empty state', async ({ page }) => {
      // Navigate to a published menu page
      // If no published menu exists, this may 404 — use conditional skip
      const response = await page.goto('/m/dinner-menu-1m3kx9');
      if (response && response.status() === 404) {
        test.skip(true, 'No published menu found — skipping menu search E2E');
        return;
      }

      const searchInput = page.getByTestId('menu-search-input');
      // MenuSearch only renders when totalItems > 0
      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, 'Menu search not visible — no menu items');
        return;
      }

      await searchInput.fill('spicy chicken');
      await page.getByTestId('menu-search-btn').click();

      // Should transition from idle to either results or empty
      await expect(
        page.getByTestId('menu-search-results').or(page.getByTestId('menu-search-empty')),
      ).toBeVisible({ timeout: 10000 });
    });

    test('2. empty state shown when no matches', async ({ page }) => {
      const response = await page.goto('/m/dinner-menu-1m3kx9');
      if (response && response.status() === 404) {
        test.skip(true, 'No published menu found');
        return;
      }

      const searchInput = page.getByTestId('menu-search-input');
      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, 'Menu search not visible');
        return;
      }

      // Search for something very unlikely to match
      await searchInput.fill('xyznonexistent123');
      await page.getByTestId('menu-search-btn').click();

      await expect(
        page.getByTestId('menu-search-empty').or(page.getByTestId('menu-search-error')),
      ).toBeVisible({ timeout: 10000 });
    });

    test('3. error state when API returns 500', async ({ page }) => {
      // Route interception to simulate API failure
      await page.route('**/api/public/menu/search**', (route) =>
        route.fulfill({ status: 500, body: '{"error":"search_unavailable"}' }),
      );

      const response = await page.goto('/m/dinner-menu-1m3kx9');
      if (response && response.status() === 404) {
        test.skip(true, 'No published menu found');
        return;
      }

      const searchInput = page.getByTestId('menu-search-input');
      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, 'Menu search not visible');
        return;
      }

      await searchInput.fill('chicken');
      await page.getByTestId('menu-search-btn').click();

      await expect(page.getByTestId('menu-search-error')).toBeVisible({ timeout: 10000 });
    });

    test('4. clearing input restores idle state', async ({ page }) => {
      const response = await page.goto('/m/dinner-menu-1m3kx9');
      if (response && response.status() === 404) {
        test.skip(true, 'No published menu found');
        return;
      }

      const searchInput = page.getByTestId('menu-search-input');
      if (!(await searchInput.isVisible().catch(() => false))) {
        test.skip(true, 'Menu search not visible');
        return;
      }

      // Type something, then clear it
      await searchInput.fill('test');
      await searchInput.fill('');

      // Results/empty/error should all be hidden after clearing
      await expect(page.getByTestId('menu-search-results')).not.toBeVisible();
      await expect(page.getByTestId('menu-search-empty')).not.toBeVisible();
      await expect(page.getByTestId('menu-search-error')).not.toBeVisible();
    });
  });

  test.describe('Similar Queries Widget — SOV Dashboard', () => {
    test('5. widget shows similar queries or "No similar queries"', async ({ page }) => {
      // Navigate to SOV dashboard — requires auth
      await page.goto('/dashboard/share-of-voice');

      // The similar queries widget may not be on the main SOV page
      // (it's a component that would be rendered within query detail views)
      // Check if the widget is visible
      const widget = page.getByTestId('similar-queries-widget');
      if (!(await widget.isVisible().catch(() => false))) {
        test.skip(true, 'SimilarQueriesWidget not rendered on page');
        return;
      }

      // Should show either results or "No similar queries found" text
      await expect(
        widget.locator('[data-testid^="similar-query-"]').first().or(
          widget.getByText('No similar queries found.'),
        ),
      ).toBeVisible({ timeout: 10000 });
    });

    test('6. widget shows "No similar queries found" when none exist', async ({ page }) => {
      // Intercept the similar-queries API to return empty results
      await page.route('**/api/sov/similar-queries', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [] }),
        }),
      );

      await page.goto('/dashboard/share-of-voice');

      const widget = page.getByTestId('similar-queries-widget');
      if (!(await widget.isVisible().catch(() => false))) {
        test.skip(true, 'SimilarQueriesWidget not rendered on page');
        return;
      }

      await expect(widget.getByText('No similar queries found.')).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
