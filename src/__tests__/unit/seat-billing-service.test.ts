/**
 * Seat Billing Service — Unit Tests (Sprint 113)
 *
 * 21 tests covering getSeatState, syncSeatsToStripe, syncSeatsFromStripe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared via vi.hoisted() so vi.mock factories
// can reference them (vi.mock is hoisted above all other code).
// ---------------------------------------------------------------------------

const {
  mockSubscriptionsRetrieve,
  mockSubscriptionsUpdate,
  mockLogSeatSync,
  mockCaptureException,
} = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';

  return {
    mockSubscriptionsRetrieve: vi.fn(),
    mockSubscriptionsUpdate: vi.fn(),
    mockLogSeatSync: vi.fn().mockResolvedValue(null),
    mockCaptureException: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Stripe mock
// ---------------------------------------------------------------------------

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.subscriptions = {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate,
    };
  }),
}));

// ---------------------------------------------------------------------------
// Activity log mock
// ---------------------------------------------------------------------------

vi.mock('@/lib/billing/activity-log-service', () => ({
  logSeatSync: mockLogSeatSync,
}));

// ---------------------------------------------------------------------------
// Sentry mock
// ---------------------------------------------------------------------------

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function createMockSupabase(orgData: Record<string, unknown> = {}) {
  const mockSingle = vi.fn().mockResolvedValue({ data: orgData, error: null });
  const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle, maybeSingle: mockSingle });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2, single: mockSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ error: null }) });

  return {
    supabase: {
      from: vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate }),
    } as unknown as SupabaseClient<Database>,
    mockSingle,
    mockSelect,
    mockUpdate,
  };
}

// ---------------------------------------------------------------------------
// Import SUT
// ---------------------------------------------------------------------------

import { getSeatState, syncSeatsToStripe, syncSeatsFromStripe } from '@/lib/billing/seat-billing-service';
import { SEAT_LIMITS } from '@/lib/membership/types';
import { SEAT_PRICE_CENTS } from '@/lib/billing/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// getSeatState
// ===========================================================================

describe('getSeatState', () => {
  it('1. returns correct seat_count and max_seats for agency plan', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 5,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
    });

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.current_seat_count).toBe(5);
    expect(state.max_seats).toBe(SEAT_LIMITS['agency']);
    expect(state.plan_tier).toBe('agency');
  });

  it('2. returns stripe_quantity from Stripe API when subscription exists', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 3,
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: {
        data: [{ id: 'si_item1', quantity: 4 }],
      },
    });

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.stripe_quantity).toBe(4);
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_abc123', { expand: ['items'] });
  });

  it('3. in_sync = true when DB seat_count === stripe_quantity', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 3,
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: {
        data: [{ id: 'si_item1', quantity: 3 }],
      },
    });

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.in_sync).toBe(true);
  });

  it('4. in_sync = false when DB seat_count !== stripe_quantity', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 3,
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: {
        data: [{ id: 'si_item1', quantity: 5 }],
      },
    });

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.in_sync).toBe(false);
    expect(state.stripe_quantity).toBe(5);
    expect(state.current_seat_count).toBe(3);
  });

  it('5. returns stripe_quantity=null and in_sync=true when no stripe_subscription_id', async () => {
    const { supabase } = createMockSupabase({
      plan: 'starter',
      seat_count: 1,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
    });

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.stripe_quantity).toBeNull();
    expect(state.in_sync).toBe(true);
    expect(state.stripe_subscription_id).toBeNull();
    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it('6. monthly_seat_cost_cents = 0 for growth plan', async () => {
    const { supabase } = createMockSupabase({
      plan: 'growth',
      seat_count: 1,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
    });

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.monthly_seat_cost_cents).toBe(0);
    expect(state.per_seat_price_cents).toBe(SEAT_PRICE_CENTS['growth']);
  });

  it('7. monthly_seat_cost_cents = 3000 for agency with 3 seats (2 additional x $15)', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 3,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
    });

    const state = await getSeatState(supabase, ORG_ID);

    // (3 - 1) * 1500 = 3000
    expect(state.monthly_seat_cost_cents).toBe(3000);
    expect(state.per_seat_price_cents).toBe(1500);
  });

  it('8. monthly_seat_cost_cents = 0 for agency with 1 seat (first seat included)', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 1,
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
    });

    const state = await getSeatState(supabase, ORG_ID);

    // Math.max(0, 1 - 1) * 1500 = 0
    expect(state.monthly_seat_cost_cents).toBe(0);
  });

  it('9. handles Stripe API timeout gracefully: returns in_sync=true, stripe_quantity=null', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      seat_count: 3,
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockRejectedValue(new Error('Request timed out'));

    const state = await getSeatState(supabase, ORG_ID);

    expect(state.stripe_quantity).toBeNull();
    expect(state.in_sync).toBe(true);
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ service: 'seat-billing', action: 'getSeatState' }),
      })
    );
  });
});

// ===========================================================================
// syncSeatsToStripe
// ===========================================================================

describe('syncSeatsToStripe', () => {
  it('10. calls stripe.subscriptions.update with correct quantity', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item1', quantity: 2 }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_abc123' });

    const result = await syncSeatsToStripe(supabase, ORG_ID, 5);

    expect(result.success).toBe(true);
    expect(result.stripe_quantity).toBe(5);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_abc123', {
      items: [{ id: 'si_item1', quantity: 5 }],
      proration_behavior: 'create_prorations',
    });
  });

  it('11. fetches stripe_subscription_item_id from Stripe if not cached in DB', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: null,
    });

    // First retrieve: lazy-populate item ID; second retrieve: get previous quantity
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_fetched_item', quantity: 1 }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_abc123' });

    const result = await syncSeatsToStripe(supabase, ORG_ID, 3);

    expect(result.success).toBe(true);
    // Should have called retrieve to get the item ID
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith('sub_abc123', { expand: ['items'] });
  });

  it('12. saves stripe_subscription_item_id to organizations table after fetch', async () => {
    const mockUpdateEq = vi.fn().mockReturnValue({ error: null });
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockUpdateEq });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        plan: 'agency',
        stripe_subscription_id: 'sub_abc123',
        stripe_subscription_item_id: null,
      },
      error: null,
    });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2, single: mockSingle });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEq1 });

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelectFn,
        update: mockUpdateFn,
      }),
    } as unknown as SupabaseClient<Database>;

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_newly_fetched', quantity: 1 }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_abc123' });

    await syncSeatsToStripe(supabase, ORG_ID, 2);

    // The update call to save item_id
    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_subscription_item_id: 'si_newly_fetched' })
    );
  });

  it('13. returns { success: false } (does NOT throw) when Stripe returns error', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item1', quantity: 2 }] },
    });
    mockSubscriptionsUpdate.mockRejectedValue(new Error('Stripe rate limit exceeded'));

    const result = await syncSeatsToStripe(supabase, ORG_ID, 5);

    expect(result.success).toBe(false);
    expect(result.stripe_quantity).toBeNull();
    // Should NOT throw — the caller sees a return value
  });

  it('14. writes seat_sync activity_log entry on success', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item1', quantity: 2 }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_abc123' });

    await syncSeatsToStripe(supabase, ORG_ID, 4);

    expect(mockLogSeatSync).toHaveBeenCalledWith(supabase, expect.objectContaining({
      orgId: ORG_ID,
      newCount: 4,
      success: true,
      source: 'app',
    }));
  });

  it('15. writes seat_sync activity_log entry with success=false on Stripe error', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      stripe_subscription_id: 'sub_abc123',
      stripe_subscription_item_id: 'si_item1',
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item1', quantity: 2 }] },
    });
    mockSubscriptionsUpdate.mockRejectedValue(new Error('Card declined'));

    await syncSeatsToStripe(supabase, ORG_ID, 5);

    expect(mockLogSeatSync).toHaveBeenCalledWith(supabase, expect.objectContaining({
      orgId: ORG_ID,
      newCount: 5,
      success: false,
      source: 'app',
      error: 'Card declined',
    }));
  });

  it('16. sets seat_overage_flagged=true when newSeatCount > SEAT_LIMITS[plan_tier]', async () => {
    const mockUpdateEq = vi.fn().mockReturnValue({ error: null });
    const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockUpdateEq });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        plan: 'agency',
        stripe_subscription_id: 'sub_abc123',
        stripe_subscription_item_id: 'si_item1',
      },
      error: null,
    });
    const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2, single: mockSingle });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEq1 });

    const supabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelectFn,
        update: mockUpdateFn,
      }),
    } as unknown as SupabaseClient<Database>;

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item1', quantity: 5 }] },
    });
    mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_abc123' });

    // Agency limit is 10; set newSeatCount to 11
    await syncSeatsToStripe(supabase, ORG_ID, 11);

    expect(mockUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({ seat_overage_flagged: true })
    );
  });

  it('17. returns early (no error) when org has no stripe_subscription_id', async () => {
    const { supabase } = createMockSupabase({
      plan: 'agency',
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
    });

    const result = await syncSeatsToStripe(supabase, ORG_ID, 3);

    expect(result.success).toBe(true);
    expect(result.stripe_quantity).toBeNull();
    expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// syncSeatsFromStripe
// ===========================================================================

describe('syncSeatsFromStripe', () => {
  it('18. updates seat_count when stripeQuantity < DB seat_count', async () => {
    const { supabase, mockUpdate } = createMockSupabase({
      seat_count: 5,
    });

    await syncSeatsFromStripe(supabase, ORG_ID, 3);

    expect(mockUpdate).toHaveBeenCalledWith({ seat_count: 3 });
  });

  it('19. updates seat_count when stripeQuantity > DB seat_count', async () => {
    const { supabase, mockUpdate } = createMockSupabase({
      seat_count: 2,
    });

    await syncSeatsFromStripe(supabase, ORG_ID, 7);

    expect(mockUpdate).toHaveBeenCalledWith({ seat_count: 7 });
  });

  it('20. no-op when stripeQuantity === DB seat_count', async () => {
    const { supabase, mockUpdate } = createMockSupabase({
      seat_count: 4,
    });

    await syncSeatsFromStripe(supabase, ORG_ID, 4);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('21. writes seat_sync log with source=stripe_webhook', async () => {
    const { supabase } = createMockSupabase({
      seat_count: 2,
    });

    await syncSeatsFromStripe(supabase, ORG_ID, 5);

    expect(mockLogSeatSync).toHaveBeenCalledWith(supabase, expect.objectContaining({
      orgId: ORG_ID,
      previousCount: 2,
      newCount: 5,
      success: true,
      source: 'stripe_webhook',
    }));
  });
});
