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

// §203: Mock webhook idempotency — always allow processing
vi.mock('@/lib/stripe/webhook-idempotency', () => ({
  isEventAlreadyProcessed: vi.fn().mockResolvedValue(false),
  recordWebhookEvent: vi.fn().mockResolvedValue(undefined),
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
  return { id: `evt_test_${Date.now()}`, type, data: { object: dataObject } } as unknown;
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
let savedPriceStarter: string | undefined;
let savedPriceGrowth: string | undefined;
let savedPriceAgency: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  savedStripeKey = process.env.STRIPE_SECRET_KEY;
  savedPriceStarter = process.env.STRIPE_PRICE_ID_STARTER;
  savedPriceGrowth = process.env.STRIPE_PRICE_ID_GROWTH;
  savedPriceAgency = process.env.STRIPE_PRICE_ID_AGENCY_SEAT;
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  process.env.STRIPE_SECRET_KEY = 'sk_test_key';
  process.env.STRIPE_PRICE_ID_STARTER = 'price_starter_test';
  process.env.STRIPE_PRICE_ID_GROWTH = 'price_growth_test';
  process.env.STRIPE_PRICE_ID_AGENCY_SEAT = 'price_agency_test';
});

afterEach(() => {
  if (savedWebhookSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
  else process.env.STRIPE_WEBHOOK_SECRET = savedWebhookSecret;
  if (savedStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedStripeKey;
  if (savedPriceStarter === undefined) delete process.env.STRIPE_PRICE_ID_STARTER;
  else process.env.STRIPE_PRICE_ID_STARTER = savedPriceStarter;
  if (savedPriceGrowth === undefined) delete process.env.STRIPE_PRICE_ID_GROWTH;
  else process.env.STRIPE_PRICE_ID_GROWTH = savedPriceGrowth;
  if (savedPriceAgency === undefined) delete process.env.STRIPE_PRICE_ID_AGENCY_SEAT;
  else process.env.STRIPE_PRICE_ID_AGENCY_SEAT = savedPriceAgency;
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

  // ── 3b. subscription.updated — plan tier sync (P0-FIX-01) ──────────

  it('subscription.updated syncs plan to growth when price ID matches GROWTH', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'active',
        items: { data: [{ price: { id: 'price_growth_test' } }] },
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'growth', plan_status: 'active' })
    );
  });

  it('subscription.updated syncs plan to agency when price ID matches AGENCY', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'active',
        items: { data: [{ price: { id: 'price_agency_test' } }] },
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'agency' })
    );
  });

  it('subscription.updated does not set plan when price ID is unrecognized', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'active',
        items: { data: [{ price: { id: 'price_unknown_xyz' } }] },
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('plan');
  });

  it('subscription.updated downgrades plan to trial when status is canceled', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'canceled',
        items: { data: [{ price: { id: 'price_growth_test' } }] },
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'trial', plan_status: 'canceled' })
    );
  });

  it('subscription.updated downgrades plan to trial when status is unpaid', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'unpaid',
        items: { data: [{ price: { id: 'price_growth_test' } }] },
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'trial' })
    );
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

  // ── 6. invoice.payment_failed → sets plan_status to past_due ─────

  it('invoice.payment_failed sets plan_status to past_due', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_failed', {
        id: 'inv_fail_123',
        customer: TEST_CUSTOMER_ID,
        status: 'open',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_status: 'past_due' })
    );
    expect(chain.eq).toHaveBeenCalledWith('stripe_customer_id', TEST_CUSTOMER_ID);
  });

  it('invoice.payment_failed does NOT downgrade plan tier', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_failed', {
        id: 'inv_fail_456',
        customer: TEST_CUSTOMER_ID,
        status: 'open',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const updatePayload = chain.update.mock.calls[0][0];
    expect(updatePayload).not.toHaveProperty('plan');
  });

  it('invoice.payment_failed skips when customer ID is missing', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.payment_failed', {
        id: 'inv_fail_789',
        customer: null,
        status: 'open',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
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
