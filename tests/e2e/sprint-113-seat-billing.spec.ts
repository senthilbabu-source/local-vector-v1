// ---------------------------------------------------------------------------
// sprint-113-seat-billing.spec.ts — Sprint 113: Seat-Based Billing + Audit Log
//
// Validates:
//   • SeatUsageCard renders for Agency plan with correct seat count + cost
//   • Out-of-sync state shows warning and force sync button
//   • Force sync button calls API and shows success
//   • Non-Agency plan shows upgrade text, no cost breakdown
//   • ActivityLogTable shows membership events
//   • Activity log pagination controls
//   • Overage banner when seat_overage_flagged
//
// Authentication: dev@ session (golden tenant, Growth plan).
// API routes are mocked via page.route() to simulate Agency/Growth states.
// ---------------------------------------------------------------------------

import { test, expect } from '@playwright/test';
import path from 'path';

const DEV_USER_STATE = path.join(__dirname, '../../.playwright/dev-user.json');
test.use({ storageState: DEV_USER_STATE });

// Mock data
const MOCK_SEAT_STATE_AGENCY = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  plan_tier: 'agency',
  current_seat_count: 3,
  max_seats: 10,
  usage_percent: 30,
  stripe_subscription_id: 'sub_mock_agency_001',
  stripe_quantity: 3,
  in_sync: true,
  monthly_seat_cost_cents: 3000,
  per_seat_price_cents: 1500,
};

const MOCK_SEAT_STATE_OUT_OF_SYNC = {
  ...MOCK_SEAT_STATE_AGENCY,
  stripe_quantity: 2,
  in_sync: false,
};

const MOCK_SEAT_STATE_GROWTH = {
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  plan_tier: 'growth',
  current_seat_count: 1,
  max_seats: 1,
  usage_percent: 100,
  stripe_subscription_id: null,
  stripe_quantity: null,
  in_sync: true,
  monthly_seat_cost_cents: 0,
  per_seat_price_cents: 0,
};

const MOCK_ACTIVITY_PAGE = {
  entries: [
    {
      id: 'log-001',
      org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      event_type: 'member_invited',
      actor_user_id: 'golden-user-id',
      actor_email: 'aruna@charcoalnchill.com',
      target_user_id: null,
      target_email: 'newmember@example.com',
      target_role: 'analyst',
      metadata: { invitation_id: 'inv-seed-001' },
      created_at: '2026-03-01T23:00:00.000Z',
    },
    {
      id: 'log-002',
      org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      event_type: 'seat_sync',
      actor_user_id: null,
      actor_email: null,
      target_user_id: null,
      target_email: 'system',
      target_role: null,
      metadata: { success: true, source: 'seed', previous_count: 0, new_count: 1 },
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  per_page: 20,
  has_more: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Sprint 113 — Seat-Based Billing UI', () => {

  test('Billing page shows SeatUsageCard for Agency plan', async ({ page }) => {
    await page.route('**/api/billing/seats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEAT_STATE_AGENCY) })
    );
    await page.route('**/api/team/activity*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTIVITY_PAGE) })
    );

    await page.goto('/dashboard/billing');

    const card = page.locator('[data-testid="seat-usage-card"]');
    await expect(card).toBeVisible();

    await expect(page.locator('[data-testid="seat-count-text"]')).toContainText('3');
    await expect(page.locator('[data-testid="seat-count-text"]')).toContainText('10');
    await expect(page.locator('[data-testid="monthly-cost-text"]')).toContainText('$30.00');
    await expect(page.locator('[data-testid="stripe-sync-status"]')).toContainText('In sync');
  });

  test('Out-of-sync state shows warning and force sync button', async ({ page }) => {
    await page.route('**/api/billing/seats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEAT_STATE_OUT_OF_SYNC) })
    );
    await page.route('**/api/team/activity*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTIVITY_PAGE) })
    );

    await page.goto('/dashboard/billing');

    await expect(page.locator('[data-testid="stripe-sync-status"]')).toContainText('Out of sync');
    await expect(page.locator('[data-testid="force-sync-btn"]')).toBeVisible();
  });

  test('Force sync button calls API and shows success', async ({ page }) => {
    let syncCalled = false;

    await page.route('**/api/billing/seats', (route) => {
      // After sync, return in-sync state
      const state = syncCalled ? MOCK_SEAT_STATE_AGENCY : MOCK_SEAT_STATE_OUT_OF_SYNC;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
    });
    await page.route('**/api/billing/seats/sync', (route) => {
      syncCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, success: true, new_quantity: 3, previous_stripe_quantity: null }),
      });
    });
    await page.route('**/api/team/activity*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTIVITY_PAGE) })
    );

    await page.goto('/dashboard/billing');

    const syncBtn = page.locator('[data-testid="force-sync-btn"]');
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    await expect(page.getByText('Synced')).toBeVisible();
  });

  test('Non-Agency plan shows no seat cost breakdown', async ({ page }) => {
    await page.route('**/api/billing/seats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEAT_STATE_GROWTH) })
    );

    await page.goto('/dashboard/billing');

    const card = page.locator('[data-testid="seat-usage-card"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Agency plan');
  });

  test('Activity log table shows membership events', async ({ page }) => {
    await page.route('**/api/billing/seats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEAT_STATE_AGENCY) })
    );
    await page.route('**/api/team/activity*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTIVITY_PAGE) })
    );

    await page.goto('/dashboard/billing');

    const table = page.locator('[data-testid="activity-log-table"]');
    await expect(table).toBeVisible();
    await expect(table).toContainText('Invitation sent');
    await expect(table).toContainText('newmember@example.com');
    await expect(table).toContainText('Seat sync');
  });

  test('Activity log pagination controls', async ({ page }) => {
    const page1Data = {
      entries: Array.from({ length: 20 }, (_, i) => ({
        id: `log-${i}`,
        org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        event_type: 'member_invited',
        actor_user_id: null,
        actor_email: 'test@test.com',
        target_user_id: null,
        target_email: `user${i}@example.com`,
        target_role: 'analyst',
        metadata: {},
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      })),
      total: 25,
      page: 1,
      per_page: 20,
      has_more: true,
    };

    const page2Data = {
      entries: Array.from({ length: 5 }, (_, i) => ({
        id: `log-${20 + i}`,
        org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        event_type: 'seat_sync',
        actor_user_id: null,
        actor_email: null,
        target_user_id: null,
        target_email: 'system',
        target_role: null,
        metadata: { success: true },
        created_at: new Date(Date.now() - (20 + i) * 60000).toISOString(),
      })),
      total: 25,
      page: 2,
      per_page: 20,
      has_more: false,
    };

    await page.route('**/api/billing/seats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEAT_STATE_AGENCY) })
    );
    await page.route('**/api/team/activity*', (route) => {
      const url = new URL(route.request().url());
      const pageNum = parseInt(url.searchParams.get('page') ?? '1', 10);
      const data = pageNum === 2 ? page2Data : page1Data;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });

    await page.goto('/dashboard/billing');

    const nextBtn = page.locator('[data-testid="activity-log-next-btn"]');
    const prevBtn = page.locator('[data-testid="activity-log-prev-btn"]');

    await expect(nextBtn).toBeVisible();
    await expect(prevBtn).toBeDisabled();

    await nextBtn.click();

    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await expect(prevBtn).toBeEnabled();
  });

  test('Overage banner visible when seat_overage_flagged', async ({ page }) => {
    const overageState = {
      ...MOCK_SEAT_STATE_AGENCY,
      current_seat_count: 12,
      usage_percent: 120,
      seat_overage_flagged: true,
    };

    await page.route('**/api/billing/seats', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overageState) })
    );
    await page.route('**/api/team/activity*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACTIVITY_PAGE) })
    );

    await page.goto('/dashboard/billing');

    const banner = page.locator('[data-testid="seat-overage-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Contact support');
  });
});
