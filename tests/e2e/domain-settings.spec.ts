import { test, expect } from '@playwright/test';

/**
 * Domain Settings — Sprint 114 E2E Tests
 *
 * Tests the /dashboard/settings/domain page for white-label domain configuration.
 * Uses route interception to mock API responses.
 */

test.describe('Domain Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Load the dev session
    await page.goto('/login');
    await page.fill('input[name="email"]', 'dev@localvector.ai');
    await page.fill('input[name="password"]', 'Password123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL('**/dashboard**');
  });

  test('Agency plan: shows subdomain and custom domain sections', async ({ page }) => {
    // Mock GET /api/whitelabel/domain → agency domain config
    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            domain_config: {
              effective_domain: 'charcoal-n-chill.localvector.ai',
              subdomain: 'charcoal-n-chill',
              custom_domain: {
                id: 'domain-cust-001',
                org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                domain_type: 'custom',
                domain_value: 'app.charcoalnchill.com',
                verification_token: 'localvector-verify=seed1234567890abcdef1234567890ab',
                verification_status: 'unverified',
                verified_at: null,
                last_checked_at: null,
                created_at: '2026-03-01T00:00:00.000Z',
                updated_at: '2026-03-01T00:00:00.000Z',
              },
              subdomain_domain: {
                id: 'domain-sub-001',
                domain_type: 'subdomain',
                domain_value: 'charcoal-n-chill.localvector.ai',
                verification_status: 'verified',
              },
            },
            upgrade_required: false,
          }),
        });
      }
      return route.continue();
    });

    await page.goto('/dashboard/settings/domain');

    await expect(page.getByTestId('domain-settings-page')).toBeVisible();
    await expect(page.getByTestId('subdomain-display')).toContainText('charcoal-n-chill.localvector.ai');
    await expect(page.getByTestId('custom-domain-input')).toHaveValue('app.charcoalnchill.com');
    await expect(page.getByTestId('verification-status-badge')).toContainText('Unverified');
  });

  test('Non-Agency plan: shows upgrade prompt', async ({ page }) => {
    // Mock returns upgrade_required
    await page.route('**/api/whitelabel/domain', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ domain_config: null, upgrade_required: true }),
      });
    });

    await page.goto('/dashboard/settings/domain');

    await expect(page.getByTestId('upgrade-prompt')).toBeVisible();
    await expect(page.getByTestId('custom-domain-input')).not.toBeVisible();
  });

  test('Save domain: shows DNS instructions after save', async ({ page }) => {
    // Mock GET → no custom domain initially
    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            domain_config: {
              effective_domain: 'charcoal-n-chill.localvector.ai',
              subdomain: 'charcoal-n-chill',
              custom_domain: null,
              subdomain_domain: null,
            },
            upgrade_required: false,
          }),
        });
      }
      // POST → success with DNS instructions
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

    await page.goto('/dashboard/settings/domain');

    const input = page.getByTestId('custom-domain-input');
    await input.fill('app.newbrand.com');
    await page.getByTestId('save-domain-btn').click();

    await expect(page.getByTestId('dns-instructions')).toBeVisible();
    await expect(page.getByTestId('cname-record-value')).toContainText('proxy.localvector.ai');
    await expect(page.getByTestId('txt-record-value')).toContainText('localvector-verify=newtoken123');
  });

  test('Copy button: copies CNAME value to clipboard', async ({ page, context }) => {
    // Grant clipboard permission
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            domain_config: {
              effective_domain: 'charcoal-n-chill.localvector.ai',
              subdomain: 'charcoal-n-chill',
              custom_domain: null,
              subdomain_domain: null,
            },
            upgrade_required: false,
          }),
        });
      }
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

    await page.goto('/dashboard/settings/domain');
    await page.getByTestId('custom-domain-input').fill('app.test.com');
    await page.getByTestId('save-domain-btn').click();
    await expect(page.getByTestId('dns-instructions')).toBeVisible();

    await page.getByTestId('copy-cname-btn').click();
    await expect(page.getByTestId('copy-cname-btn')).toContainText('Copied');
  });

  test('Verify domain: shows verified state on success', async ({ page }) => {
    await page.route('**/api/whitelabel/domain', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          domain_config: {
            effective_domain: 'charcoal-n-chill.localvector.ai',
            subdomain: 'charcoal-n-chill',
            custom_domain: {
              id: 'domain-cust-001',
              domain_type: 'custom',
              domain_value: 'app.charcoalnchill.com',
              verification_token: 'localvector-verify=token',
              verification_status: 'unverified',
            },
            subdomain_domain: null,
          },
          upgrade_required: false,
        }),
      });
    });

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

    await page.goto('/dashboard/settings/domain');
    await page.getByTestId('verify-domain-btn').click();

    await expect(page.getByTestId('verification-status-badge')).toContainText('Verified');
  });

  test('Verify domain: shows failed state on DNS miss', async ({ page }) => {
    await page.route('**/api/whitelabel/domain', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          domain_config: {
            effective_domain: 'charcoal-n-chill.localvector.ai',
            subdomain: 'charcoal-n-chill',
            custom_domain: {
              id: 'domain-cust-001',
              domain_type: 'custom',
              domain_value: 'app.charcoalnchill.com',
              verification_token: 'localvector-verify=token',
              verification_status: 'unverified',
            },
            subdomain_domain: null,
          },
          upgrade_required: false,
        }),
      });
    });

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

    await page.goto('/dashboard/settings/domain');
    await page.getByTestId('verify-domain-btn').click();

    await expect(page.getByText('DNS record not found')).toBeVisible();
  });

  test('Remove domain: clears form after removal', async ({ page }) => {
    await page.route('**/api/whitelabel/domain', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            domain_config: {
              effective_domain: 'charcoal-n-chill.localvector.ai',
              subdomain: 'charcoal-n-chill',
              custom_domain: {
                id: 'domain-cust-001',
                domain_type: 'custom',
                domain_value: 'app.charcoalnchill.com',
                verification_token: 'localvector-verify=token',
                verification_status: 'unverified',
              },
              subdomain_domain: null,
            },
            upgrade_required: false,
          }),
        });
      }
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });

    await page.goto('/dashboard/settings/domain');

    // Accept the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    await page.getByTestId('remove-domain-btn').click();

    await expect(page.getByTestId('custom-domain-input')).toHaveValue('');
  });
});
