/**
 * Unit Tests — Auth Flow
 *
 * Verifies authentication helpers: getSafeAuthContext, getAuthContext,
 * and auth context resolution (auth.uid → public.users → memberships → org).
 *
 * All Supabase calls are mocked — no live DB required.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/auth-flow.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockSelectUsers = vi.fn();
const mockSelectMemberships = vi.fn();

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: vi.fn((table: string) => {
    if (table === 'users') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockSelectUsers,
          }),
        }),
      };
    }
    if (table === 'memberships') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSelectMemberships,
            maybeSingle: mockSelectMemberships,
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
  createServiceRoleClient: vi.fn(() => mockSupabase),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { getAuthContext, getSafeAuthContext } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const AUTH_UID = 'auth-uid-123';
const PUBLIC_USER_ID = 'pub-user-456';
const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Tests: getSafeAuthContext
// ---------------------------------------------------------------------------

describe('getSafeAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    const ctx = await getSafeAuthContext();
    expect(ctx).toBeNull();
  });

  it('returns partial context when public user does not exist yet', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_UID, email: 'test@example.com' } },
      error: null,
    });
    mockSelectUsers.mockResolvedValue({ data: null });

    const ctx = await getSafeAuthContext();
    expect(ctx).toEqual(
      expect.objectContaining({
        userId: AUTH_UID,
        email: 'test@example.com',
        orgId: null,
        orgName: null,
      })
    );
  });

  it('returns partial context when membership does not exist yet', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_UID, email: 'test@example.com' } },
      error: null,
    });
    mockSelectUsers.mockResolvedValue({
      data: { id: PUBLIC_USER_ID, full_name: 'Test User' },
    });
    mockSelectMemberships.mockResolvedValue({ data: null, error: null });

    const ctx = await getSafeAuthContext();
    expect(ctx).toEqual(
      expect.objectContaining({
        userId: AUTH_UID,
        fullName: 'Test User',
        orgId: null,
        role: null,
      })
    );
  });

  it('returns full context when user, membership, and org exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_UID, email: 'dev@charcoalnchill.com' } },
      error: null,
    });
    mockSelectUsers.mockResolvedValue({
      data: { id: PUBLIC_USER_ID, full_name: 'Aruna Patel' },
    });
    mockSelectMemberships.mockResolvedValue({
      data: {
        org_id: ORG_ID,
        role: 'owner',
        organizations: {
          id: ORG_ID,
          name: 'Charcoal N Chill',
          plan: 'growth',
          onboarding_completed: true,
        },
      },
      error: null,
    });

    const ctx = await getSafeAuthContext();
    expect(ctx).toEqual(
      expect.objectContaining({
        userId: AUTH_UID,
        email: 'dev@charcoalnchill.com',
        fullName: 'Aruna Patel',
        orgId: ORG_ID,
        orgName: 'Charcoal N Chill',
        role: 'owner',
        plan: 'growth',
        onboarding_completed: true,
      })
    );
  });

  it('takes zero parameters (derives org from session, not request)', () => {
    expect(getSafeAuthContext.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: getAuthContext
// ---------------------------------------------------------------------------

describe('getAuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws Unauthorized when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    await expect(getAuthContext()).rejects.toThrow('Unauthorized');
  });

  it('throws No organization found when public user does not exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_UID, email: 'test@example.com' } },
      error: null,
    });
    mockSelectUsers.mockResolvedValue({ data: null });

    await expect(getAuthContext()).rejects.toThrow('No organization found');
  });

  it('throws No organization found when membership does not exist', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_UID, email: 'test@example.com' } },
      error: null,
    });
    mockSelectUsers.mockResolvedValue({
      data: { id: PUBLIC_USER_ID, full_name: 'Test User' },
    });
    mockSelectMemberships.mockResolvedValue({
      data: null,
      error: { message: 'Row not found' },
    });

    await expect(getAuthContext()).rejects.toThrow('No organization found');
  });

  it('returns full AuthContext for authenticated user with org', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_UID, email: 'dev@charcoalnchill.com' } },
      error: null,
    });
    mockSelectUsers.mockResolvedValue({
      data: { id: PUBLIC_USER_ID, full_name: 'Aruna Patel' },
    });
    mockSelectMemberships.mockResolvedValue({
      data: {
        org_id: ORG_ID,
        role: 'owner',
        organizations: {
          id: ORG_ID,
          name: 'Charcoal N Chill',
          slug: 'charcoal-n-chill',
          plan: 'growth',
          plan_status: 'active',
          audit_frequency: 'weekly',
          max_locations: 5,
          onboarding_completed: true,
        },
      },
      error: null,
    });

    const ctx = await getAuthContext();
    expect(ctx.userId).toBe(AUTH_UID);
    expect(ctx.orgId).toBe(ORG_ID);
    expect(ctx.role).toBe('owner');
    expect(ctx.fullName).toBe('Aruna Patel');
    expect(ctx.org.name).toBe('Charcoal N Chill');
    expect(ctx.org.plan).toBe('growth');
  });

  it('takes zero parameters (derives org from session, not request)', () => {
    expect(getAuthContext.length).toBe(0);
  });
});
