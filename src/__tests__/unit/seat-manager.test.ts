/**
 * Unit Tests — Seat Manager (lib/stripe/seat-manager.ts)
 *
 * Strategy: Stripe SDK and Supabase are fully mocked at module level.
 * Tests every code path: availability checks, quantity updates, webhook sync, overage.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/seat-manager.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockSubscriptionsUpdate = vi.fn();

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      subscriptions = { update: mockSubscriptionsUpdate };
    },
  };
});

// Supabase mock chain builder
type MockChain = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createMockChain(resolveValue: unknown): MockChain {
  const chain: MockChain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolveValue),
    maybeSingle: vi.fn().mockResolvedValue(resolveValue),
  };
  // Chain eq calls back to self
  chain.eq.mockImplementation(() => chain);
  chain.select.mockImplementation((_cols?: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.head) {
      // head: true returns count in the result
      return chain;
    }
    return chain;
  });
  return chain;
}

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom } as unknown;

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  checkSeatAvailability,
  updateSeatQuantity,
  syncSeatLimitFromWebhook,
  calculateSeatOverage,
} from '@/lib/stripe/seat-manager';
import { getSeatLimit, isMultiUserPlan } from '@/lib/stripe/seat-plans';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const supabase = mockSupabase as SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let savedStripeKey: string | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  savedStripeKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_key';
});

afterEach(() => {
  if (savedStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = savedStripeKey;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_CUSTOMER_ID = 'cus_abc123def456';
const TEST_SUBSCRIPTION_ID = 'sub_abc123def456';

function setupOrgQuery(org: Record<string, unknown> | null, error?: { message: string }) {
  const chain = createMockChain({ data: org, error: error ?? null });
  return chain;
}

function setupMemberCount(count: number) {
  const chain = createMockChain({ count, error: null });
  return chain;
}

// ---------------------------------------------------------------------------
// checkSeatAvailability
// ---------------------------------------------------------------------------

describe('checkSeatAvailability', () => {
  it('returns canAdd=true when members < seat_limit', async () => {
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 5, plan: 'agency' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await checkSeatAvailability(supabase, TEST_ORG_ID);
    expect(result.canAdd).toBe(true);
    expect(result.currentMembers).toBe(3);
    expect(result.seatLimit).toBe(5);
    expect(result.seatsRemaining).toBe(2);
  });

  it('returns canAdd=false when members === seat_limit', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 5, plan: 'agency' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await checkSeatAvailability(supabase, TEST_ORG_ID);
    expect(result.canAdd).toBe(false);
    expect(result.error).toBe('seat_limit_reached');
    expect(result.seatsRemaining).toBe(0);
  });

  it('returns canAdd=false when members > seat_limit (overage state)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 3, plan: 'agency' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await checkSeatAvailability(supabase, TEST_ORG_ID);
    expect(result.canAdd).toBe(false);
    expect(result.currentMembers).toBe(5);
    expect(result.seatLimit).toBe(3);
    expect(result.error).toBe('seat_limit_reached');
  });

  it('returns correct seatsRemaining count', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 10, plan: 'agency' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 7,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await checkSeatAvailability(supabase, TEST_ORG_ID);
    expect(result.seatsRemaining).toBe(3);
  });

  it('returns canAdd=false for non-Agency plan (seat_limit=1, already 1 owner)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 1, plan: 'growth' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 1,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await checkSeatAvailability(supabase, TEST_ORG_ID);
    expect(result.canAdd).toBe(false);
    expect(result.seatLimit).toBe(1);
  });

  it('handles DB error gracefully — returns canAdd=false with db_error code', async () => {
    mockFrom.mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection refused' },
            }),
          }),
        }),
      };
    });

    const result = await checkSeatAvailability(supabase, TEST_ORG_ID);
    expect(result.canAdd).toBe(false);
    expect(result.error).toBe('db_error');
  });
});

// ---------------------------------------------------------------------------
// updateSeatQuantity
// ---------------------------------------------------------------------------

describe('updateSeatQuantity', () => {
  function setupOrgForUpdate(overrides: Record<string, unknown> = {}) {
    const org = {
      stripe_subscription_id: TEST_SUBSCRIPTION_ID,
      plan: 'agency',
      plan_status: 'active',
      seat_limit: 5,
      ...overrides,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: org,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
    });

    return org;
  }

  it('calls stripe.subscriptions.update with correct quantity', async () => {
    setupOrgForUpdate();
    mockSubscriptionsUpdate.mockResolvedValue({ id: TEST_SUBSCRIPTION_ID });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    expect(result.success).toBe(true);
    expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
      TEST_SUBSCRIPTION_ID,
      expect.objectContaining({ quantity: 7 })
    );
  });

  it('uses proration_behavior=create_prorations', async () => {
    setupOrgForUpdate();
    mockSubscriptionsUpdate.mockResolvedValue({ id: TEST_SUBSCRIPTION_ID });

    await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    // First call might use items approach, second call is the fallback
    const calls = mockSubscriptionsUpdate.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toHaveProperty('proration_behavior', 'create_prorations');
  });

  it('returns no-op success when quantity unchanged', async () => {
    setupOrgForUpdate({ seat_limit: 5 });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 5);
    expect(result.success).toBe(true);
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(5);
    expect(mockSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it('returns error=no_subscription when org has no stripe_subscription_id', async () => {
    setupOrgForUpdate({ stripe_subscription_id: null });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    expect(result.success).toBe(false);
    expect(result.error).toBe('no_subscription');
  });

  it('returns error=subscription_not_active when status is canceled', async () => {
    setupOrgForUpdate({ plan_status: 'canceled' });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    expect(result.success).toBe(false);
    expect(result.error).toBe('subscription_not_active');
  });

  it('returns error=subscription_not_active when status is past_due', async () => {
    setupOrgForUpdate({ plan_status: 'past_due' });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    expect(result.success).toBe(false);
    expect(result.error).toBe('subscription_not_active');
  });

  it('returns error=below_minimum_seats when newSeatCount < minSeats', async () => {
    setupOrgForUpdate();

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('below_minimum_seats');
  });

  it('returns error=not_agency_plan when org is on growth plan', async () => {
    setupOrgForUpdate({ plan: 'growth' });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 3);
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_agency_plan');
  });

  it('returns error=stripe_error when Stripe API throws', async () => {
    setupOrgForUpdate();
    mockSubscriptionsUpdate.mockRejectedValue(new Error('Stripe API error'));

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    expect(result.success).toBe(false);
    expect(result.error).toBe('stripe_error');
  });

  it('returns previousQuantity and newQuantity on success', async () => {
    setupOrgForUpdate({ seat_limit: 5 });
    mockSubscriptionsUpdate.mockResolvedValue({ id: TEST_SUBSCRIPTION_ID });

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 7);
    expect(result.success).toBe(true);
    expect(result.previousQuantity).toBe(5);
    expect(result.newQuantity).toBe(7);
  });

  it('returns error=db_error when org not found', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    }));

    const result = await updateSeatQuantity(supabase, TEST_ORG_ID, 5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('db_error');
  });
});

// ---------------------------------------------------------------------------
// syncSeatLimitFromWebhook
// ---------------------------------------------------------------------------

describe('syncSeatLimitFromWebhook', () => {
  it('updates organizations.seat_limit by stripeCustomerId lookup', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
    });

    const result = await syncSeatLimitFromWebhook(supabase, TEST_CUSTOMER_ID, 10, 'active');
    expect(result.success).toBe(true);
    expect(result.orgId).toBe(TEST_ORG_ID);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ seat_limit: 10 })
    );
  });

  it('handles unknown stripeCustomerId gracefully', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    }));

    const result = await syncSeatLimitFromWebhook(supabase, 'cus_unknown', 5, 'active');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No org found');
  });

  it('sets seat_limit=1 when subscription status=canceled', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
    });

    const result = await syncSeatLimitFromWebhook(supabase, TEST_CUSTOMER_ID, 5, 'canceled');
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ seat_limit: 1 })
    );
  });

  it('preserves seat_limit when status=past_due (grace period)', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
          update: mockUpdate,
        };
      }
    });

    const result = await syncSeatLimitFromWebhook(supabase, TEST_CUSTOMER_ID, 5, 'past_due');
    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ seat_limit: 5 })
    );
  });

  it('returns orgId on success for webhook event logging', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
    });

    const result = await syncSeatLimitFromWebhook(supabase, TEST_CUSTOMER_ID, 5, 'active');
    expect(result.orgId).toBe(TEST_ORG_ID);
  });

  it('handles DB update failure — returns error string', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_ORG_ID },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Connection refused' },
            }),
          }),
        };
      }
    });

    const result = await syncSeatLimitFromWebhook(supabase, TEST_CUSTOMER_ID, 5, 'active');
    expect(result.success).toBe(false);
    expect(result.error).toContain('DB update failed');
  });
});

// ---------------------------------------------------------------------------
// calculateSeatOverage
// ---------------------------------------------------------------------------

describe('calculateSeatOverage', () => {
  it('returns overage=0 when members <= seat_limit', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 5 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await calculateSeatOverage(supabase, TEST_ORG_ID);
    expect(result.overage).toBe(0);
  });

  it('returns overage=2 when 7 members and seat_limit=5', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 5 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 7,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await calculateSeatOverage(supabase, TEST_ORG_ID);
    expect(result.overage).toBe(2);
    expect(result.currentMembers).toBe(7);
    expect(result.seatLimit).toBe(5);
  });

  it('handles empty org_members gracefully', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 5 },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        };
      }
    });

    const result = await calculateSeatOverage(supabase, TEST_ORG_ID);
    expect(result.overage).toBe(0);
    expect(result.currentMembers).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getSeatLimit helper (from seat-plans.ts)
// ---------------------------------------------------------------------------

describe('getSeatLimit helper', () => {
  it('returns 1 for starter plan regardless of quantity', () => {
    expect(getSeatLimit('starter', 5)).toBe(1);
  });

  it('returns 1 for growth plan regardless of quantity', () => {
    expect(getSeatLimit('growth', 10)).toBe(1);
  });

  it('returns subscriptionQuantity for agency plan', () => {
    expect(getSeatLimit('agency', 8)).toBe(8);
  });

  it('returns defaultSeats when subscriptionQuantity undefined for agency', () => {
    expect(getSeatLimit('agency')).toBe(5);
  });

  it('returns 1 for unknown plan', () => {
    expect(getSeatLimit('nonexistent')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// isMultiUserPlan
// ---------------------------------------------------------------------------

describe('isMultiUserPlan', () => {
  it('returns false for starter', () => {
    expect(isMultiUserPlan('starter')).toBe(false);
  });

  it('returns false for growth', () => {
    expect(isMultiUserPlan('growth')).toBe(false);
  });

  it('returns true for agency', () => {
    expect(isMultiUserPlan('agency')).toBe(true);
  });

  it('returns false for unknown plan (graceful)', () => {
    expect(isMultiUserPlan('nonexistent')).toBe(false);
  });

  it('returns false for trial', () => {
    expect(isMultiUserPlan('trial')).toBe(false);
  });
});
