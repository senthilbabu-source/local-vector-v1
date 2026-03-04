/**
 * accessibility-audit.spec.ts — P6-FIX-27
 *
 * Automated WCAG 2.1 AA audit using @axe-core/playwright.
 * Runs axe on key pages and asserts zero critical/serious violations.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';

// ---------------------------------------------------------------------------
// Public pages (no auth required)
// ---------------------------------------------------------------------------

const PUBLIC_PAGES = ['/login', '/register'];

for (const pagePath of PUBLIC_PAGES) {
  test(`${pagePath} — zero critical/serious axe violations`, async ({ page }) => {
    await page.goto(pagePath);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['list', 'listitem']) // tremor chart legend uses <ol> with <div> children
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (critical.length > 0) {
      console.table(
        critical.map((v) => ({
          rule: v.id,
          impact: v.impact,
          element: v.nodes[0]?.html?.slice(0, 100),
          help: v.help,
        })),
      );
    }

    expect(critical).toHaveLength(0);
  });
}

// ---------------------------------------------------------------------------
// Authenticated pages (use dev@ session from global.setup.ts)
// ---------------------------------------------------------------------------

const AUTH_PAGES = [
  '/dashboard',
  '/dashboard/hallucinations',
  '/dashboard/share-of-voice',
  '/dashboard/settings',
  '/dashboard/billing',
  '/dashboard/benchmarks',
  '/dashboard/ai-responses',
  '/dashboard/compete',
];

for (const pagePath of AUTH_PAGES) {
  test(`${pagePath} — zero critical/serious axe violations`, async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../../.playwright/dev-user.json'),
    });
    const page = await context.newPage();

    await page.goto(pagePath);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['list', 'listitem']) // tremor chart legend uses <ol> with <div> children
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (critical.length > 0) {
      console.table(
        critical.map((v) => ({
          rule: v.id,
          impact: v.impact,
          element: v.nodes[0]?.html?.slice(0, 100),
          help: v.help,
        })),
      );
    }

    expect(critical).toHaveLength(0);

    await context.close();
  });
}

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

test('dashboard has skip-to-content link', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.join(__dirname, '../../.playwright/dev-user.json'),
  });
  const page = await context.newPage();

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  const skipLink = page.locator('a[href="#main-content"]');
  await expect(skipLink).toHaveCount(1);

  const mainContent = page.locator('main#main-content');
  await expect(mainContent).toHaveCount(1);

  await context.close();
});

test('dashboard has semantic landmarks', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.join(__dirname, '../../.playwright/dev-user.json'),
  });
  const page = await context.newPage();

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // <header> exists
  await expect(page.locator('header')).toHaveCount(1);

  // <nav> exists
  const navs = page.locator('nav');
  expect(await navs.count()).toBeGreaterThanOrEqual(1);

  // <main> exists
  await expect(page.locator('main')).toHaveCount(1);

  // <aside> exists (sidebar)
  await expect(page.locator('aside')).toHaveCount(1);

  await context.close();
});

test('login has skip-to-form link', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const skipLink = page.locator('a[href="#login-form"]');
  await expect(skipLink).toHaveCount(1);

  const form = page.locator('form#login-form');
  await expect(form).toHaveCount(1);
});

test('page titles are unique and descriptive', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: path.join(__dirname, '../../.playwright/dev-user.json'),
  });
  const page = await context.newPage();

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const dashboardTitle = await page.title();
  expect(dashboardTitle).toContain('Dashboard');
  expect(dashboardTitle).toContain('LocalVector.ai');

  await page.goto('/dashboard/hallucinations');
  await page.waitForLoadState('networkidle');
  const hallucinationsTitle = await page.title();
  expect(hallucinationsTitle).toContain('AI Mistakes');

  // Titles should be different
  expect(dashboardTitle).not.toBe(hallucinationsTitle);

  await context.close();
});
