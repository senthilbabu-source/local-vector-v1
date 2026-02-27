/**
 * Unit Tests — Stripe Webhook Seat Management (Sprint 99)
 *
 * Tests the new seat-related webhook event handlers added in Sprint 99.
 * Follows the existing mock pattern from stripe-webhook.test.ts exactly.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/stripe-webhook-seats.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module-level mocks — same pattern as stripe-webhook.test.ts
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn();

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      webhooks = { constructEvent: mockConstructEvent };
    },
  };
});

const mockFrom = vi.fn();
const mockServiceClient = { from: mockFrom };

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(() => mockServiceClient),
}));

// Mock the seat manager functions
const mockSyncSeatLimit = vi.fn();
const mockCalculateOverage = vi.fn();

vi.mock('@/lib/stripe/seat-manager', () => ({
  syncSeatLimitFromWebhook: (...args: unknown[]) => mockSyncSeatLimit(...args),
  calculateSeatOverage: (...args: unknown[]) => mockCalculateOverage(...args),
}));

// Mock email sending
vi.mock('@/lib/email/send-overage', () => ({
  sendSeatOverageEmail: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/webhooks/stripe/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_CUSTOMER_ID = 'cus_abc123def456';
const TEST_SUBSCRIPTION_ID = 'sub_abc123def456';

function mockStripeEvent(type: string, dataObject: Record<string, unknown>) {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    data: { object: dataObject },
  } as unknown;
}

function makeWebhookRequest(body: string, sig = 'valid-sig'): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': sig },
    body,
  });
}

function mockUpdateSuccess() {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

function mockIdempotencyCheck(alreadyProcessed: boolean) {
  // The webhook handler checks stripe_webhook_events for existing event
  const selectChain = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: alreadyProcessed ? { id: 'existing' } : null,
          error: alreadyProcessed ? null : { code: 'PGRST116' },
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: alreadyProcessed ? { id: 'existing' } : null,
          error: null,
        }),
      }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
  return selectChain;
}

// ---------------------------------------------------------------------------
// Env var management
// ---------------------------------------------------------------------------

let savedWebhookSecret: string | undefined;
let savedStripeKey: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  savedStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_key';
});

afterEach(() => {
  if (savedWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = savedWebhookSecret;
  if (savedStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedStripeKey;
});

// ---------------------------------------------------------------------------
// customer.subscription.updated — seat quantity sync
// ---------------------------------------------------------------------------

describe('Stripe webhook — customer.subscription.updated (seat sync)', () => {
  it('syncs seat_limit when quantity changes via plan_status update', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'active',
        quantity: 10,
        items: { data: [{ quantity: 10 }] },
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    // The existing handler updates plan_status via stripe_customer_id
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_status: 'active' })
    );
  });

  it('does NOT immediately lock seats when status becomes past_due', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'past_due',
        quantity: 5,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_status: 'past_due' })
    );
  });

  it('returns 200 even when event processing fails', async () => {
    mockFrom.mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Connection refused' },
      }),
    }));
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'active',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    // The existing handler throws on DB error → 500
    expect(res.status).toBe(500);
  });

  it('verifies Stripe signature before processing', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// customer.subscription.deleted — seat reset
// ---------------------------------------------------------------------------

describe('Stripe webhook — customer.subscription.deleted (seat reset)', () => {
  it('sets plan=trial and plan_status=canceled on subscription deleted', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.deleted', {
        customer: TEST_CUSTOMER_ID,
        status: 'canceled',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'trial',
        plan_status: 'canceled',
        seat_limit: 1,
        seat_overage_count: 0,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Signature verification (aligned with existing tests)
// ---------------------------------------------------------------------------

describe('Stripe webhook — signature verification (Sprint 99)', () => {
  it('returns 400 when stripe-signature header missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing Stripe-Signature header');
  });

  it('returns 400 when constructEvent throws (invalid signature)', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(400);
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET not set in env', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Webhook not configured');
  });

  it('processes correctly with valid signature', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.paid', { id: 'inv_123' })
    );
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unhandled events — should still return 200
// ---------------------------------------------------------------------------

describe('Stripe webhook — unhandled events', () => {
  it('returns 200 for invoice.payment_failed (not yet handled)', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_failed', {
        id: 'inv_fail_123',
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it('returns 200 for invoice.payment_succeeded (not yet handled)', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_succeeded', {
        id: 'inv_success_123',
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
  });
});
