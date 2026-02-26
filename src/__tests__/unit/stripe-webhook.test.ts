/**
 * Unit Tests — Stripe Webhook Route Handler
 *
 * Strategy: the Stripe constructor and Supabase service-role client are fully
 * mocked at the module level. Each test controls what constructEvent() returns
 * and what the DB query resolves to, allowing us to test every code path in the
 * webhook route without a live Stripe or Supabase connection.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/stripe-webhook.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GOLDEN_TENANT } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Module-level mocks — replaces stripe + lib/supabase/server for all tests
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

/** Hex-only UUID from Golden Tenant (AI_RULES §7) */
const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FALLBACK_ORG_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
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

/** Returns a mock Supabase .from().update().eq() chain that resolves successfully. */
function mockUpdateSuccess() {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

/** Returns a mock Supabase chain that resolves with an error. */
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
// POST /api/webhooks/stripe — signature verification
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — signature verification', () => {
  it('returns 500 when STRIPE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Webhook not configured');
  });

  it('returns 400 when stripe-signature header is missing', async () => {
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
    const body = await res.json();
    expect(body.error).toContain('Webhook Error');
    expect(body.error).toContain('No signatures found');
  });

  it('returns 200 with { received: true } for unhandled event types', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('invoice.paid', { id: 'inv_abc123' })
    );
    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe — checkout.session.completed
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — checkout.session.completed', () => {
  it('updates org plan to growth when metadata.plan is pro', async () => {
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
      expect.objectContaining({ plan: 'growth' })
    );
  });

  it('updates org plan to agency when metadata.plan is enterprise', async () => {
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

  it('defaults to growth when metadata.plan is absent', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: TEST_ORG_ID,
        metadata: {},
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'growth' })
    );
  });

  it('uses client_reference_id as orgId (preferred over metadata.org_id)', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: TEST_ORG_ID,
        metadata: { org_id: FALLBACK_ORG_ID, plan: 'pro' },
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('id', TEST_ORG_ID);
  });

  it('falls back to metadata.org_id when client_reference_id is null', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: null,
        metadata: { org_id: FALLBACK_ORG_ID, plan: 'pro' },
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith('id', FALLBACK_ORG_ID);
  });

  it('sets stripe_customer_id and stripe_subscription_id from session', async () => {
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
        stripe_customer_id: TEST_CUSTOMER_ID,
        stripe_subscription_id: TEST_SUBSCRIPTION_ID,
      })
    );
  });

  it('skips update when both client_reference_id and metadata.org_id are missing', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('checkout.session.completed', {
        client_reference_id: null,
        metadata: {},
        customer: TEST_CUSTOMER_ID,
        subscription: TEST_SUBSCRIPTION_ID,
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 500 when DB update fails', async () => {
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

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe — customer.subscription.updated
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — customer.subscription.updated', () => {
  it('maps Stripe status active to plan_status active', async () => {
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

  it('maps Stripe status past_due to plan_status past_due', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'past_due',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_status: 'past_due' })
    );
  });

  it('maps Stripe status incomplete to plan_status past_due', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: TEST_CUSTOMER_ID,
        status: 'incomplete',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ plan_status: 'past_due' })
    );
  });

  it('skips when customer ID is missing', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.updated', {
        customer: null,
        status: 'active',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe — customer.subscription.deleted
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/stripe — customer.subscription.deleted', () => {
  it('downgrades to plan trial and plan_status canceled', async () => {
    const chain = mockUpdateSuccess();
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.deleted', {
        customer: TEST_CUSTOMER_ID,
        status: 'canceled',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith({
      plan: 'trial',
      plan_status: 'canceled',
    });
    expect(chain.eq).toHaveBeenCalledWith('stripe_customer_id', TEST_CUSTOMER_ID);
  });

  it('skips when customer ID is missing', async () => {
    mockConstructEvent.mockReturnValue(
      mockStripeEvent('customer.subscription.deleted', {
        customer: null,
        status: 'canceled',
      })
    );

    const res = await POST(makeWebhookRequest('{}'));
    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
