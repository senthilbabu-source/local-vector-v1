/**
 * Unit Tests — Stripe Webhook: All Revenue-Critical Event Paths
 *
 * Comprehensive coverage of every Stripe event type the webhook handler
 * processes. This supplements stripe-webhook.test.ts with edge cases
 * and ensures all revenue-critical paths are verified.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/stripe-webhook-events.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module-level mocks
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
  return { type, data: { object: dataObject } } as unknown;
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

function mockUpdateFailure(message: string) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: { message } }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
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
// Tests
// ---------------------------------------------------------------------------

describe('Stripe webhook — all revenue-critical events', () => {
  // ── 1. checkout.session.completed → activates Growth plan ─────────

  it('checkout.session.completed activates Growth plan and sets stripe IDs', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: TEST_ORG_ID,
        metadata: { plan: 'pro' },
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: 'growth',
        plan_status: 'active',
        stripe_customer_id: TEST_CUSTOMER_ID,
        stripe_subscription_id: TEST_SUBSCRIPTION_ID,
      })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', TEST_ORG_ID);
  });

  // ── 2. checkout.session.completed → activates Agency plan ─────────

  it('checkout.session.completed activates Agency plan for enterprise', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: TEST_ORG_ID,
        metadata: { plan: 'enterprise' },
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'agency' })
    );
  });

  // ── 3. customer.subscription.updated → updates plan status ────────

  it('customer.subscription.updated maps active status correctly', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'active',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_status: 'active' })
    );
    expect(chain.eq).toHaveBeenCalledWith('stripe_customer_id', TEST_CUSTOMER_ID);
  });

  // ── 4. customer.subscription.deleted → downgrades to trial ────────

  it('customer.subscription.deleted downgrades org to trial', async () => {
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
    expect(chain.eq).toHaveBeenCalledWith('stripe_customer_id', TEST_CUSTOMER_ID);
  });

  // ── 5. invoice.payment_succeeded → acknowledged (not yet handled) ──

  it('invoice.payment_succeeded returns 200 (acknowledged but no-op)', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_succeeded', {
        id: 'inv_abc123',
        customer: TEST_CUSTOMER_ID,
        status: 'paid',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    // No DB calls — this event type is not yet handled
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ── 6. invoice.payment_failed → acknowledged (not yet handled) ────

  it('invoice.payment_failed returns 200 (acknowledged but no-op)', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_failed', {
        id: 'inv_fail_123',
        customer: TEST_CUSTOMER_ID,
        status: 'open',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ── 7. invalid signature → 400, event not processed ───────────────

  it('returns 400 and does not process event when signature is invalid', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ── 8. unknown event type → 200 (acknowledge but ignore) ──────────

  it('returns 200 for unknown event types without processing', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('payment_method.attached', { id: 'pm_abc123' })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ── 9. missing stripe-signature header → 400 ──────────────────────

  it('returns 400 when stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing Stripe-Signature header');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ── 10. DB failure on checkout → 500 (does not silently swallow) ──

  it('returns 500 when DB update fails during checkout processing', async () => {
    mockUpdateFailure('Connection refused');
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: TEST_ORG_ID,
        metadata: { plan: 'pro' },
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
