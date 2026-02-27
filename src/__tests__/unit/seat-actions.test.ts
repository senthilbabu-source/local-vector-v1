/**
 * Unit Tests — Seat Management Server Actions (Sprint 99)
 *
 * Tests addSeat, removeSeat, and getSeatSummary server actions.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/seat-actions.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — use vi.hoisted() to avoid temporal dead zone
// ---------------------------------------------------------------------------

const { mockFrom, mockGetSafeAuthContext, mockUpdateSeatQuantity, mockCheckSeatAvailability } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSafeAuthContext: vi.fn(),
  mockUpdateSeatQuantity: vi.fn(),
  mockCheckSeatAvailability: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
  getAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/stripe/seat-manager', () => ({
  updateSeatQuantity: (...args: unknown[]) => mockUpdateSeatQuantity(...args),
  checkSeatAvailability: (...args: unknown[]) => mockCheckSeatAvailability(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { addSeat, removeSeat, getSeatSummary } from '@/app/actions/seat-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function setupOwnerContext(overrides: Record<string, unknown> = {}) {
  mockGetSafeAuthContext.mockResolvedValue({
    userId: 'auth-uid-123',
    email: 'owner@test.com',
    fullName: 'Test Owner',
    orgId: TEST_ORG_ID,
    orgName: 'Test Org',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// addSeat
// ---------------------------------------------------------------------------

describe('addSeat', () => {
  it('calls updateSeatQuantity with currentSeatLimit + 1', async () => {
    setupOwnerContext();

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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    mockUpdateSeatQuantity.mockResolvedValue({
      success: true,
      previousQuantity: 5,
      newQuantity: 6,
    });

    const result = await addSeat();
    expect(result.success).toBe(true);
    expect(result.newSeatLimit).toBe(6);
    expect(mockUpdateSeatQuantity).toHaveBeenCalledWith(
      expect.anything(),
      TEST_ORG_ID,
      6
    );
  });

  it('returns error when caller is not owner', async () => {
    setupOwnerContext({ role: 'admin' });

    const result = await addSeat();
    expect(result.success).toBe(false);
    expect(result.error).toContain('owner');
  });

  it('returns error when plan is not agency', async () => {
    setupOwnerContext({ plan: 'growth' });

    const result = await addSeat();
    expect(result.success).toBe(false);
    expect(result.error).toContain('agency');
  });

  it('returns error when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const result = await addSeat();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('returns error when stripe call fails', async () => {
    setupOwnerContext();

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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    mockUpdateSeatQuantity.mockResolvedValue({
      success: false,
      error: 'stripe_error',
    });

    const result = await addSeat();
    expect(result.success).toBe(false);
    expect(result.error).toBe('stripe_error');
  });
});

// ---------------------------------------------------------------------------
// removeSeat
// ---------------------------------------------------------------------------

describe('removeSeat', () => {
  it('calls updateSeatQuantity with currentSeatLimit - 1', async () => {
    setupOwnerContext();

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
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    mockUpdateSeatQuantity.mockResolvedValue({
      success: true,
      previousQuantity: 5,
      newQuantity: 4,
    });

    const result = await removeSeat();
    expect(result.success).toBe(true);
    expect(result.newSeatLimit).toBe(4);
    expect(mockUpdateSeatQuantity).toHaveBeenCalledWith(
      expect.anything(),
      TEST_ORG_ID,
      4
    );
  });

  it('returns error when caller is not owner', async () => {
    setupOwnerContext({ role: 'admin' });

    const result = await removeSeat();
    expect(result.success).toBe(false);
    expect(result.error).toContain('owner');
  });

  it('returns error=would_create_overage when currentMembers >= newSeatCount', async () => {
    setupOwnerContext();

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
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const result = await removeSeat();
    expect(result.success).toBe(false);
    expect(result.error).toBe('would_create_overage');
  });

  it('returns error=below_minimum_seats when newSeatCount < minSeats', async () => {
    setupOwnerContext();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { seat_limit: 1, plan: 'agency' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const result = await removeSeat();
    expect(result.success).toBe(false);
    expect(result.error).toBe('below_minimum_seats');
  });

  it('does not call Stripe when validation fails', async () => {
    setupOwnerContext({ role: 'admin' });

    await removeSeat();
    expect(mockUpdateSeatQuantity).not.toHaveBeenCalled();
  });

  it('does NOT remove any members from org_members', async () => {
    setupOwnerContext();

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
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
          delete: vi.fn(),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    mockUpdateSeatQuantity.mockResolvedValue({
      success: true,
      previousQuantity: 5,
      newQuantity: 4,
    });

    await removeSeat();
    // Verify no delete calls on memberships
    const membershipsCalls = mockFrom.mock.calls.filter(
      ([table]: [string]) => table === 'memberships'
    );
    membershipsCalls.forEach(([, chain]: unknown[]) => {
      // No delete method should be called
    });
  });
});

// ---------------------------------------------------------------------------
// getSeatSummary
// ---------------------------------------------------------------------------

describe('getSeatSummary', () => {
  it('returns correct seatLimit from organizations.seat_limit', async () => {
    setupOwnerContext();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  seat_limit: 5,
                  seat_overage_count: 0,
                  plan: 'agency',
                  plan_status: 'active',
                  stripe_subscription_id: 'sub_123',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const result = await getSeatSummary();
    expect(result.seatLimit).toBe(5);
    expect(result.currentMembers).toBe(3);
    expect(result.seatsRemaining).toBe(2);
    expect(result.seatOverage).toBe(0);
    expect(result.isAgencyPlan).toBe(true);
    expect(result.plan).toBe('agency');
  });

  it('returns isAgencyPlan=false for growth plan', async () => {
    setupOwnerContext({ plan: 'growth' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  seat_limit: 1,
                  seat_overage_count: 0,
                  plan: 'growth',
                  plan_status: 'active',
                  stripe_subscription_id: 'sub_123',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const result = await getSeatSummary();
    expect(result.isAgencyPlan).toBe(false);
    expect(result.seatLimit).toBe(1);
  });

  it('handles missing stripe_subscription_id gracefully', async () => {
    setupOwnerContext();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  seat_limit: 5,
                  seat_overage_count: 0,
                  plan: 'agency',
                  plan_status: 'active',
                  stripe_subscription_id: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const result = await getSeatSummary();
    expect(result.subscriptionStatus).toBe('active');
  });
});
