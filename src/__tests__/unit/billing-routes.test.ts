/**
 * Billing Routes Tests — Sprint 113
 *
 * 18 tests covering:
 * - GET /api/billing/seats (3 tests)
 * - POST /api/billing/seats/sync (5 tests)
 * - GET /api/team/activity (6 tests)
 * - POST /api/webhooks/stripe — subscription.updated (4 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------------------

const {
  mockGetSafeAuthContext,
  mockServiceFrom,
  mockRoleSatisfies,
  mockCanManageTeamSeats,
  mockGetSeatState,
  mockSyncSeatsToStripe,
  mockSyncSeatsFromStripe,
  mockGetActivityLog,
  mockCaptureException,
  mockConstructEvent,
} = vi.hoisted(() => ({
  mockGetSafeAuthContext: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockRoleSatisfies: vi.fn(),
  mockCanManageTeamSeats: vi.fn(),
  mockGetSeatState: vi.fn(),
  mockSyncSeatsToStripe: vi.fn(),
  mockSyncSeatsFromStripe: vi.fn(),
  mockGetActivityLog: vi.fn(),
  mockCaptureException: vi.fn(),
  mockConstructEvent: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: mockServiceFrom })),
  createClient: vi.fn().mockResolvedValue({ from: vi.fn() }),
}));

vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: (...args: unknown[]) => mockRoleSatisfies(...args),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canManageTeamSeats: (...args: unknown[]) => mockCanManageTeamSeats(...args),
}));

vi.mock('@/lib/billing/seat-billing-service', () => ({
  getSeatState: (...args: unknown[]) => mockGetSeatState(...args),
  syncSeatsToStripe: (...args: unknown[]) => mockSyncSeatsToStripe(...args),
  syncSeatsFromStripe: (...args: unknown[]) => mockSyncSeatsFromStripe(...args),
}));

vi.mock('@/lib/billing/activity-log-service', () => ({
  getActivityLog: (...args: unknown[]) => mockGetActivityLog(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock('stripe', () => ({
  // Must use `function` — arrow functions are not constructable (AI_RULES / FIX-4)
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: { constructEvent: mockConstructEvent },
      subscriptions: { retrieve: vi.fn(), update: vi.fn() },
    };
  }),
}));

// Import routes after mocks
import { GET as getSeats } from '@/app/api/billing/seats/route';
import { POST as syncSeats } from '@/app/api/billing/seats/sync/route';
import { GET as getActivity } from '@/app/api/team/activity/route';
import { POST as stripeWebhook } from '@/app/api/webhooks/stripe/route';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuthCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'auth-uid-001',
    email: 'dev@localvector.ai',
    fullName: 'Dev User',
    orgId: 'org-001',
    orgName: 'Test Org',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
    ...overrides,
  };
}

function buildServiceChain(resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  for (const method of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
    'filter', 'order', 'limit', 'range', 'match',
  ]) {
    chain[method] = vi.fn(self);
  }
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function createMockRequest(url: string): NextRequest {
  const req = new Request(url);
  return {
    ...req,
    nextUrl: new URL(url),
    headers: req.headers,
    text: () => req.text(),
  } as unknown as NextRequest;
}

function createWebhookRequest(body: string, signature = 'sig_valid'): NextRequest {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: {
      'stripe-signature': signature,
      'content-type': 'application/json',
    },
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: roleSatisfies uses real hierarchy
  mockRoleSatisfies.mockImplementation((current: string | null, required: string) => {
    const hierarchy: Record<string, number> = { viewer: 0, member: 0, analyst: 0, admin: 1, owner: 2 };
    return (hierarchy[current ?? ''] ?? 0) >= (hierarchy[required] ?? 0);
  });

  // Default: env vars for webhook
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/billing/seats
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/billing/seats', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await getSeats();
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns SeatState with correct shape', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx());

    const fakeSeatState = {
      org_id: 'org-001',
      plan_tier: 'agency',
      current_seat_count: 3,
      max_seats: 10,
      usage_percent: 30,
      stripe_subscription_id: 'sub_123',
      stripe_quantity: 3,
      in_sync: true,
      monthly_seat_cost_cents: 3000,
      per_seat_price_cents: 1500,
    };
    mockGetSeatState.mockResolvedValue(fakeSeatState);

    const response = await getSeats();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual(fakeSeatState);
    expect(body.org_id).toBe('org-001');
    expect(body.plan_tier).toBe('agency');
    expect(body.current_seat_count).toBe(3);
    expect(body.max_seats).toBe(10);
    expect(body.in_sync).toBe(true);
    expect(body.monthly_seat_cost_cents).toBe(3000);
    expect(body.per_seat_price_cents).toBe(1500);
  });

  it('returns non-Agency state for growth plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ plan: 'growth' }));

    const growthState = {
      org_id: 'org-001',
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
    mockGetSeatState.mockResolvedValue(growthState);

    const response = await getSeats();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.plan_tier).toBe('growth');
    expect(body.per_seat_price_cents).toBe(0);
    expect(body.monthly_seat_cost_cents).toBe(0);
    expect(body.max_seats).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/billing/seats/sync
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/billing/seats/sync', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const response = await syncSeats();
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns 403 not_owner for admin/analyst/viewer callers', async () => {
    for (const role of ['admin', 'analyst', 'viewer']) {
      vi.clearAllMocks();
      mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role }));
      mockRoleSatisfies.mockReturnValue(false);

      const response = await syncSeats();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error).toBe('not_owner');
    }
  });

  it('returns 403 plan_upgrade_required for non-Agency plan', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner', plan: 'growth' }));
    mockRoleSatisfies.mockReturnValue(true);
    mockCanManageTeamSeats.mockReturnValue(false);

    const response = await syncSeats();
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe('plan_upgrade_required');
  });

  it('calls syncSeatsToStripe with current seat_count', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner', plan: 'agency' }));
    mockRoleSatisfies.mockReturnValue(true);
    mockCanManageTeamSeats.mockReturnValue(true);

    mockServiceFrom.mockImplementation(() => {
      return buildServiceChain({ data: { seat_count: 5 }, error: null });
    });

    mockSyncSeatsToStripe.mockResolvedValue({ success: true, stripe_quantity: 5 });

    await syncSeats();

    expect(mockSyncSeatsToStripe).toHaveBeenCalledTimes(1);
    // Third argument is the seat_count fetched from DB
    expect(mockSyncSeatsToStripe).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockServiceFrom }),
      'org-001',
      5
    );
  });

  it('returns { ok: true, previous_stripe_quantity, new_quantity, success }', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner', plan: 'agency' }));
    mockRoleSatisfies.mockReturnValue(true);
    mockCanManageTeamSeats.mockReturnValue(true);

    mockServiceFrom.mockImplementation(() => {
      return buildServiceChain({ data: { seat_count: 3 }, error: null });
    });

    mockSyncSeatsToStripe.mockResolvedValue({ success: true, stripe_quantity: 3 });

    const response = await syncSeats();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty('previous_stripe_quantity');
    expect(body.previous_stripe_quantity).toBeNull();
    expect(body.new_quantity).toBe(3);
    expect(body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/team/activity
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/team/activity', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const request = createMockRequest('http://localhost/api/team/activity');
    const response = await getActivity(request);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe('unauthenticated');
  });

  it('returns 403 insufficient_role for analyst and viewer', async () => {
    for (const role of ['analyst', 'viewer']) {
      vi.clearAllMocks();
      mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role }));
      mockRoleSatisfies.mockReturnValue(false);

      const request = createMockRequest('http://localhost/api/team/activity');
      const response = await getActivity(request);
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error).toBe('insufficient_role');
    }
  });

  it('returns ActivityLogPage with entries for owner/admin', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));
    mockRoleSatisfies.mockReturnValue(true);

    const fakeLog = {
      entries: [
        {
          id: 'log-1',
          org_id: 'org-001',
          event_type: 'member_invited',
          actor_user_id: 'auth-uid-001',
          actor_email: 'dev@localvector.ai',
          target_user_id: null,
          target_email: 'new@test.com',
          target_role: 'admin',
          metadata: {},
          created_at: '2026-03-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      has_more: false,
    };
    mockGetActivityLog.mockResolvedValue(fakeLog);

    const request = createMockRequest('http://localhost/api/team/activity?page=1&per_page=20');
    const response = await getActivity(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.per_page).toBe(20);
    expect(body.has_more).toBe(false);
    expect(body.entries[0].event_type).toBe('member_invited');
  });

  it('respects page query param', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));
    mockRoleSatisfies.mockReturnValue(true);

    mockGetActivityLog.mockResolvedValue({
      entries: [],
      total: 0,
      page: 3,
      per_page: 20,
      has_more: false,
    });

    const request = createMockRequest('http://localhost/api/team/activity?page=3');
    await getActivity(request);

    expect(mockGetActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockServiceFrom }),
      'org-001',
      { page: 3, per_page: 20 }
    );
  });

  it('respects per_page query param (max 50 enforced)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'admin' }));
    mockRoleSatisfies.mockReturnValue(true);

    mockGetActivityLog.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      per_page: 50,
      has_more: false,
    });

    // Request per_page=100, should be clamped to 50
    const request = createMockRequest('http://localhost/api/team/activity?per_page=100');
    await getActivity(request);

    expect(mockGetActivityLog).toHaveBeenCalledWith(
      expect.anything(),
      'org-001',
      { page: 1, per_page: 50 }
    );
  });

  it('returns empty ActivityLogPage when no logs exist (not 404)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(mockAuthCtx({ role: 'owner' }));
    mockRoleSatisfies.mockReturnValue(true);

    mockGetActivityLog.mockResolvedValue({
      entries: [],
      total: 0,
      page: 1,
      per_page: 20,
      has_more: false,
    });

    const request = createMockRequest('http://localhost/api/team/activity');
    const response = await getActivity(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.entries).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.has_more).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Stripe webhook — subscription.updated
// ═══════════════════════════════════════════════════════════════════════════

describe('Stripe webhook — subscription.updated', () => {
  const subscriptionUpdatedEvent = {
    id: 'evt_sub_updated',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_abc',
        status: 'active',
        quantity: 5,
        items: { data: [{ quantity: 5 }] },
      },
    },
  };

  it('calls syncSeatsFromStripe when event type matches', async () => {
    mockConstructEvent.mockReturnValue(subscriptionUpdatedEvent);
    mockSyncSeatsFromStripe.mockResolvedValue(undefined);

    // Mock supabase: first call updates org (subscription.updated handler),
    // second call finds org by stripe_customer_id
    mockServiceFrom.mockImplementation(() => {
      const chain = buildServiceChain({ data: { id: 'org-001' }, error: null });
      return chain;
    });

    const request = createWebhookRequest(JSON.stringify(subscriptionUpdatedEvent));
    const response = await stripeWebhook(request);
    expect(response.status).toBe(200);

    expect(mockSyncSeatsFromStripe).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockServiceFrom }),
      'org-001',
      5
    );
  });

  it('returns 200 even when org not found for subscription_id', async () => {
    mockConstructEvent.mockReturnValue(subscriptionUpdatedEvent);
    mockSyncSeatsFromStripe.mockResolvedValue(undefined);

    // First from('organizations').update()...eq() resolves OK
    // Second from('organizations').select()...eq().maybeSingle() returns null (no org found)
    let callNum = 0;
    mockServiceFrom.mockImplementation(() => {
      callNum++;
      if (callNum <= 1) {
        // The .update().eq() chain
        return buildServiceChain({ data: null, error: null });
      }
      // The .select().eq().maybeSingle() returns null — org not found
      return buildServiceChain({ data: null, error: null });
    });

    const request = createWebhookRequest(JSON.stringify(subscriptionUpdatedEvent));
    const response = await stripeWebhook(request);

    // Should still return 200 — not finding the org is not an error
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received).toBe(true);

    // syncSeatsFromStripe should NOT have been called since org was not found
    expect(mockSyncSeatsFromStripe).not.toHaveBeenCalled();
  });

  it('returns 200 even when syncSeatsFromStripe throws', async () => {
    mockConstructEvent.mockReturnValue(subscriptionUpdatedEvent);
    mockSyncSeatsFromStripe.mockRejectedValue(new Error('sync failed'));

    mockServiceFrom.mockImplementation(() => {
      return buildServiceChain({ data: { id: 'org-001' }, error: null });
    });

    const request = createWebhookRequest(JSON.stringify(subscriptionUpdatedEvent));
    const response = await stripeWebhook(request);

    // The webhook uses `void syncSeatsFromStripe(...)` — fire-and-forget
    // So even if it throws, the handler returns 200
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received).toBe(true);
  });

  it('does not affect other webhook event handling (regression test)', async () => {
    // Verify that a checkout.session.completed event is still handled correctly
    // alongside subscription.updated — they don't interfere
    const checkoutEvent = {
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          client_reference_id: 'org-002',
          customer: 'cus_xyz',
          subscription: 'sub_456',
          metadata: { plan: 'enterprise' },
        },
      },
    };

    mockConstructEvent.mockReturnValue(checkoutEvent);

    mockServiceFrom.mockImplementation(() => {
      return buildServiceChain({ data: null, error: null });
    });

    const request = createWebhookRequest(JSON.stringify(checkoutEvent));
    const response = await stripeWebhook(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.received).toBe(true);

    // syncSeatsFromStripe should NOT be called for checkout events
    expect(mockSyncSeatsFromStripe).not.toHaveBeenCalled();

    // The org update should have been called (handleCheckoutCompleted)
    expect(mockServiceFrom).toHaveBeenCalledWith('organizations');
  });
});
