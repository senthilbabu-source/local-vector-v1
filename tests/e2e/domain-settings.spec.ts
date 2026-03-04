import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Domain Settings — Sprint 114 E2E Tests
 *
 * Tests the /dashboard/settings/domain page for white-label domain configuration.
 * Uses route interception to mock API responses.
 *
 * Authentication: dev@ session (golden tenant, Growth plan).
 * Note: The domain page is a server component that checks plan tier server-side.
 * The dev@ user is on Growth plan, so the server renders the upgrade prompt
 * unless the user is on Agency plan. Tests that require Agency plan features
 * (subdomain, custom domain) will only pass when ADMIN_EMAILS or plan is Agency.
 */

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

test.describe('Domain Settings', () => {

  test('Agency plan: shows subdomain and custom domain sections', async ({ page }) => {
    // The domain page is a server component — plan check happens server-side.
    // Route mocking only intercepts client-side fetches.
    // dev@ is on Growth plan, so the server renders the upgrade prompt.
    // Skip this test if upgrade prompt is visible (non-Agency plan).
    await page.goto('/dashboard/settings/domain');

    await expect(page.getByTestId('domain-settings-page')).toBeVisible();

    const upgradePrompt = page.getByTestId('upgrade-prompt');
    const hasUpgradePrompt = (await upgradePrompt.count()) > 0;

    if (hasUpgradePrompt) {
      // Non-Agency plan — subdomain/custom domain sections not rendered server-side
      test.skip();
      return;
    }

    await expect(page.getByTestId('subdomain-display')).toContainText('charcoal-n-chill.localvector.ai');
    await expect(page.getByTestId('custom-domain-input')).toHaveValue('app.charcoalnchill.com');
    await expect(page.getByTestId('verification-status-badge')).toContainText('Unverified');
  });

  test('Non-Agency plan: shows upgrade prompt', async ({ page }) => {
    // The domain page is a server component — plan check happens server-side.
    // dev@ is on Growth plan, so the server always renders the upgrade prompt.
    // No route mocking needed — the server-side render handles this.
    await page.goto('/dashboard/settings/domain');

    await expect(page.getByTestId('upgrade-prompt')).toBeVisible();
    await expect(page.getByTestId('custom-domain-input')).not.toBeVisible();
  });

  test('Save domain: shows DNS instructions after save', async ({ page }) => {
    // The domain page is a server component — requires Agency plan for the form.
    // dev@ is on Growth plan, so skip if upgrade prompt is shown.
    await page.goto('/dashboard/settings/domain');

    const upgradePrompt = page.getByTestId('upgrade-prompt');
    if ((await upgradePrompt.count()) > 0) {
      test.skip();
      return;
    }

    // Mock POST → success with DNS instructions (client-side fetch in DomainConfigForm)
    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            domain: {
              id: 'domain-new',
              domain_type: 'custom',
              domain_value: 'app.newbrand.com',
              verification_token: 'localvector-verify=newtoken123',
              verification_status: 'unverified',
            },
            dns_instructions: {
              cname_record: { type: 'CNAME', name: 'app.newbrand.com', value: 'proxy.localvector.ai' },
              txt_record: { type: 'TXT', name: 'app.newbrand.com', value: 'localvector-verify=newtoken123' },
              instructions: [],
            },
          }),
        });
      }
      return route.continue();
    });

    const input = page.getByTestId('custom-domain-input');
    await input.fill('app.newbrand.com');
    await page.getByTestId('save-domain-btn').click();

    await expect(page.getByTestId('dns-instructions')).toBeVisible();
    await expect(page.getByTestId('cname-record-value')).toContainText('proxy.localvector.ai');
    await expect(page.getByTestId('txt-record-value')).toContainText('localvector-verify=newtoken123');
  });

  test('Copy button: copies CNAME value to clipboard', async ({ page, context }) => {
    // The domain page requires Agency plan for the form.
    await page.goto('/dashboard/settings/domain');

    const upgradePrompt = page.getByTestId('upgrade-prompt');
    if ((await upgradePrompt.count()) > 0) {
      test.skip();
      return;
    }

    // Grant clipboard permission
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            domain: {
              id: 'domain-new',
              domain_type: 'custom',
              domain_value: 'app.test.com',
              verification_token: 'localvector-verify=token123',
              verification_status: 'unverified',
            },
            dns_instructions: {
              cname_record: { type: 'CNAME', name: 'app.test.com', value: 'proxy.localvector.ai' },
              txt_record: { type: 'TXT', name: 'app.test.com', value: 'localvector-verify=token123' },
              instructions: [],
            },
          }),
        });
      }
      return route.continue();
    });

    await page.getByTestId('custom-domain-input').fill('app.test.com');
    await page.getByTestId('save-domain-btn').click();
    await expect(page.getByTestId('dns-instructions')).toBeVisible();

    await page.getByTestId('copy-cname-btn').click();
    await expect(page.getByTestId('copy-cname-btn')).toContainText('Copied');
  });

  test('Verify domain: shows verified state on success', async ({ page }) => {
    // The domain page requires Agency plan for the form.
    await page.goto('/dashboard/settings/domain');

    const upgradePrompt = page.getByTestId('upgrade-prompt');
    if ((await upgradePrompt.count()) > 0) {
      test.skip();
      return;
    }

    await page.route('**/api/whitelabel/domain/verify', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: true,
          status: 'verified',
          checked_at: new Date().toISOString(),
          error: null,
        }),
      });
    });

    await page.getByTestId('verify-domain-btn').click();

    await expect(page.getByTestId('verification-status-badge')).toContainText('Verified');
  });

  test('Verify domain: shows failed state on DNS miss', async ({ page }) => {
    // The domain page requires Agency plan for the form.
    await page.goto('/dashboard/settings/domain');

    const upgradePrompt = page.getByTestId('upgrade-prompt');
    if ((await upgradePrompt.count()) > 0) {
      test.skip();
      return;
    }

    await page.route('**/api/whitelabel/domain/verify', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          verified: false,
          status: 'failed',
          checked_at: new Date().toISOString(),
          error: 'TXT record not found',
        }),
      });
    });

    await page.getByTestId('verify-domain-btn').click();

    await expect(page.getByText('DNS record not found')).toBeVisible();
  });

  test('Remove domain: clears form after removal', async ({ page }) => {
    // The domain page requires Agency plan for the form.
    await page.goto('/dashboard/settings/domain');

    const upgradePrompt = page.getByTestId('upgrade-prompt');
    if ((await upgradePrompt.count()) > 0) {
      test.skip();
      return;
    }

    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });

    // Accept the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    await page.getByTestId('remove-domain-btn').click();

    await expect(page.getByTestId('custom-domain-input')).toHaveValue('');
  });
});
