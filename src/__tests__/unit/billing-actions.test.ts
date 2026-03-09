/**
 * Billing Actions Tests
 *
 * 22 tests covering all server actions in app/dashboard/billing/actions.ts:
 * - createCheckoutSession (3 tests)
 * - createPortalSession (3 tests)
 * - getCurrentPlan (2 tests)
 * - getSubscriptionDetails (4 tests)
 * - getCreditsSummary (1 test)
 * - getInvoiceHistory (4 tests)
 * - getPaymentMethod (5 tests)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------------------

const {
  mockGetAuthContext,
  mockSupabaseFrom,
  mockCaptureException,
  mockGetCreditBalance,
  mockGetCreditHistory,
  mockRevalidatePath,
  mockCheckoutSessionsCreate,
  mockBillingPortalSessionsCreate,
  mockSubscriptionsRetrieve,
  mockInvoicesList,
  mockCustomersRetrieve,
  mockPaymentMethodsRetrieve,
} = vi.hoisted(() => ({
  mockGetAuthContext: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockCaptureException: vi.fn(),
  mockGetCreditBalance: vi.fn(),
  mockGetCreditHistory: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCheckoutSessionsCreate: vi.fn(),
  mockBillingPortalSessionsCreate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockInvoicesList: vi.fn(),
  mockCustomersRetrieve: vi.fn(),
  mockPaymentMethodsRetrieve: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthContext: () => mockGetAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
  })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

vi.mock('@/lib/credits/credit-service', () => ({
  getCreditBalance: (...args: unknown[]) => mockGetCreditBalance(...args),
  getCreditHistory: (...args: unknown[]) => mockGetCreditHistory(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

// Must use `function` — arrow functions are not constructable (AI_RULES / FIX-4)
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
      subscriptions: { retrieve: mockSubscriptionsRetrieve },
      invoices: { list: mockInvoicesList },
      customers: { retrieve: mockCustomersRetrieve },
      paymentMethods: { retrieve: mockPaymentMethodsRetrieve },
    };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSupabaseChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  };
}

const AUTH = { orgId: 'org-001', userId: 'user-001' };

// ---------------------------------------------------------------------------
// Module under test — dynamic import after mocks
// ---------------------------------------------------------------------------

let createCheckoutSession: typeof import('@/app/dashboard/billing/actions').createCheckoutSession;
let createPortalSession: typeof import('@/app/dashboard/billing/actions').createPortalSession;
let getCurrentPlan: typeof import('@/app/dashboard/billing/actions').getCurrentPlan;
let getSubscriptionDetails: typeof import('@/app/dashboard/billing/actions').getSubscriptionDetails;
let getCreditsSummary: typeof import('@/app/dashboard/billing/actions').getCreditsSummary;
let getInvoiceHistory: typeof import('@/app/dashboard/billing/actions').getInvoiceHistory;
let getPaymentMethod: typeof import('@/app/dashboard/billing/actions').getPaymentMethod;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  mockGetAuthContext.mockResolvedValue(AUTH);

  // Clean up env vars that tests may have set
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID_STARTER;
  delete process.env.STRIPE_PRICE_ID_GROWTH;
  delete process.env.STRIPE_PORTAL_CONFIGURATION_ID;

  // Re-import to get a fresh module with reset _stripe singleton
  const mod = await import('@/app/dashboard/billing/actions');
  createCheckoutSession = mod.createCheckoutSession;
  createPortalSession = mod.createPortalSession;
  getCurrentPlan = mod.getCurrentPlan;
  getSubscriptionDetails = mod.getSubscriptionDetails;
  getCreditsSummary = mod.getCreditsSummary;
  getInvoiceHistory = mod.getInvoiceHistory;
  getPaymentMethod = mod.getPaymentMethod;
});

// ===========================================================================
// createCheckoutSession
// ===========================================================================

describe('createCheckoutSession', () => {
  it('returns demo result when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await createCheckoutSession('starter');

    expect(result).toEqual({ url: null, demo: true });
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns demo result when price ID env var is missing', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    delete process.env.STRIPE_PRICE_ID_STARTER;

    const result = await createCheckoutSession('starter');

    expect(result).toEqual({ url: null, demo: true });
    expect(mockCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('creates Stripe checkout session and returns URL', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_PRICE_ID_GROWTH = 'price_growth_123';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.localvector.ai';

    mockCheckoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.com/session/abc',
    });

    const result = await createCheckoutSession('growth');

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/session/abc',
      demo: false,
    });
    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        client_reference_id: 'org-001',
        metadata: { org_id: 'org-001', plan: 'growth' },
        line_items: [{ price: 'price_growth_123', quantity: 1 }],
        success_url: 'https://app.localvector.ai/dashboard/billing?success=true',
        cancel_url: 'https://app.localvector.ai/dashboard/billing?canceled=true',
      }),
    );
  });
});

// ===========================================================================
// createPortalSession
// ===========================================================================

describe('createPortalSession', () => {
  it('returns demo result when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await createPortalSession();

    expect(result).toEqual({ url: null, demo: true });
    expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns demo result when org has no stripe_customer_id', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';

    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: null }),
    );

    const result = await createPortalSession();

    expect(result).toEqual({ url: null, demo: true });
    expect(mockBillingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it('creates portal session and returns URL', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.localvector.ai';

    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: 'cus_abc123' }),
    );

    mockBillingPortalSessionsCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/portal/sess_xyz',
    });

    const result = await createPortalSession();

    expect(result).toEqual({
      url: 'https://billing.stripe.com/portal/sess_xyz',
      demo: false,
    });
    expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_abc123',
        return_url: 'https://app.localvector.ai/dashboard/billing',
      }),
    );
  });
});

// ===========================================================================
// getCurrentPlan
// ===========================================================================

describe('getCurrentPlan', () => {
  it('returns plan info from DB', async () => {
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({
        plan: 'growth',
        plan_status: 'active',
        stripe_customer_id: 'cus_abc',
      }),
    );

    const result = await getCurrentPlan();

    expect(result).toEqual({
      plan: 'growth',
      plan_status: 'active',
      has_stripe_customer: true,
    });
  });

  it('returns defaults when DB returns null', async () => {
    mockSupabaseFrom.mockReturnValue(buildSupabaseChain(null));

    const result = await getCurrentPlan();

    expect(result).toEqual({
      plan: 'trial',
      plan_status: 'active',
      has_stripe_customer: false,
    });
  });
});

// ===========================================================================
// getSubscriptionDetails
// ===========================================================================

describe('getSubscriptionDetails', () => {
  const NULL_DETAILS = {
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    cancelAt: null,
    status: null,
  };

  it('returns null fields in demo mode', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await getSubscriptionDetails();

    expect(result).toEqual(NULL_DETAILS);
  });

  it('returns null fields when org has no subscription ID', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_subscription_id: null }),
    );

    const result = await getSubscriptionDetails();

    expect(result).toEqual(NULL_DETAILS);
  });

  it('returns subscription details from Stripe', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_subscription_id: 'sub_abc' }),
    );

    const periodEndTs = Math.floor(new Date('2026-04-08').getTime() / 1000);
    const cancelAtTs = Math.floor(new Date('2026-05-01').getTime() / 1000);

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ current_period_end: periodEndTs }] },
      cancel_at_period_end: true,
      cancel_at: cancelAtTs,
      status: 'active',
    });

    const result = await getSubscriptionDetails();

    expect(result.status).toBe('active');
    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toBe(new Date(periodEndTs * 1000).toISOString());
    expect(result.cancelAt).toBe(new Date(cancelAtTs * 1000).toISOString());
  });

  it('returns null fields gracefully on Stripe error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_subscription_id: 'sub_abc' }),
    );

    mockSubscriptionsRetrieve.mockRejectedValue(new Error('Stripe timeout'));

    const result = await getSubscriptionDetails();

    expect(result).toEqual(NULL_DETAILS);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ component: 'getSubscriptionDetails' }) }),
    );
  });
});

// ===========================================================================
// getCreditsSummary
// ===========================================================================

describe('getCreditsSummary', () => {
  it('returns balance and recent history', async () => {
    const mockBalance = { total: 50, used: 10, remaining: 40 };
    const mockHistory = [{ id: 'h1', action: 'debit', amount: 1 }];

    mockGetCreditBalance.mockResolvedValue(mockBalance);
    mockGetCreditHistory.mockResolvedValue(mockHistory);

    const result = await getCreditsSummary();

    expect(result).toEqual({ balance: mockBalance, recentHistory: mockHistory });
    expect(mockGetCreditBalance).toHaveBeenCalledWith('org-001');
    expect(mockGetCreditHistory).toHaveBeenCalledWith('org-001', 10);
  });
});

// ===========================================================================
// getInvoiceHistory
// ===========================================================================

describe('getInvoiceHistory', () => {
  it('returns empty array in demo mode', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await getInvoiceHistory();

    expect(result).toEqual([]);
  });

  it('returns empty array when org has no customer ID', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: null }),
    );

    const result = await getInvoiceHistory();

    expect(result).toEqual([]);
  });

  it('returns mapped invoice data from Stripe', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: 'cus_abc' }),
    );

    const createdTs = Math.floor(new Date('2026-03-01').getTime() / 1000);

    mockInvoicesList.mockResolvedValue({
      data: [
        {
          id: 'inv_001',
          created: createdTs,
          amount_due: 4900,
          status: 'paid',
          invoice_pdf: 'https://stripe.com/pdf/inv_001',
          hosted_invoice_url: 'https://stripe.com/hosted/inv_001',
        },
      ],
    });

    const result = await getInvoiceHistory();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'inv_001',
      date: new Date(createdTs * 1000).toISOString(),
      amountDue: 4900,
      status: 'paid',
      pdfUrl: 'https://stripe.com/pdf/inv_001',
      hostedUrl: 'https://stripe.com/hosted/inv_001',
    });
    expect(mockInvoicesList).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_abc', limit: 12 }),
    );
  });

  it('returns empty array on Stripe error', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: 'cus_abc' }),
    );

    mockInvoicesList.mockRejectedValue(new Error('Stripe 500'));

    const result = await getInvoiceHistory();

    expect(result).toEqual([]);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ component: 'getInvoiceHistory' }) }),
    );
  });
});

// ===========================================================================
// getPaymentMethod
// ===========================================================================

describe('getPaymentMethod', () => {
  it('returns null in demo mode', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await getPaymentMethod();

    expect(result).toBeNull();
  });

  it('returns null when org has no customer ID', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: null }),
    );

    const result = await getPaymentMethod();

    expect(result).toBeNull();
  });

  it('returns card details on success', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: 'cus_abc' }),
    );

    mockCustomersRetrieve.mockResolvedValue({
      deleted: undefined,
      invoice_settings: { default_payment_method: 'pm_123' },
    });

    mockPaymentMethodsRetrieve.mockResolvedValue({
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027 },
    });

    const result = await getPaymentMethod();

    expect(result).toEqual({
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2027,
    });
  });

  it('returns null when customer is deleted', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: 'cus_abc' }),
    );

    mockCustomersRetrieve.mockResolvedValue({ deleted: true });

    const result = await getPaymentMethod();

    expect(result).toBeNull();
  });

  it('returns null when no default payment method or card', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockSupabaseFrom.mockReturnValue(
      buildSupabaseChain({ stripe_customer_id: 'cus_abc' }),
    );

    mockCustomersRetrieve.mockResolvedValue({
      deleted: undefined,
      invoice_settings: { default_payment_method: null },
    });

    const result = await getPaymentMethod();

    expect(result).toBeNull();
    expect(mockPaymentMethodsRetrieve).not.toHaveBeenCalled();
  });
});
