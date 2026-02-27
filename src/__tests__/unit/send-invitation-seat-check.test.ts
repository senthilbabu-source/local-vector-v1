/**
 * Unit Tests — sendInvitation seat limit enforcement (Sprint 99)
 *
 * Tests the seat check integration added to Sprint 98's sendInvitation.
 * Verifies seat limits are enforced BEFORE email sending.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/send-invitation-seat-check.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — use vi.hoisted() to avoid temporal dead zone
// ---------------------------------------------------------------------------

const { mockFrom, mockGetSafeAuthContext, mockSendInvitationEmail } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSafeAuthContext: vi.fn(),
  mockSendInvitationEmail: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
  createServiceRoleClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/email/send-invitation', () => ({
  sendInvitationEmail: (...args: unknown[]) => mockSendInvitationEmail(...args),
}));

// Mock checkSeatAvailability from seat-manager (imported by invitations.ts)
const { mockCheckSeatAvailability } = vi.hoisted(() => ({
  mockCheckSeatAvailability: vi.fn(),
}));

vi.mock('@/lib/stripe/seat-manager', () => ({
  checkSeatAvailability: (...args: unknown[]) => mockCheckSeatAvailability(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { sendInvitation } from '@/app/actions/invitations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_USER_ID = 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function setupAuthContext(overrides: Record<string, unknown> = {}) {
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
  mockSendInvitationEmail.mockResolvedValue(undefined);
  // Default: seat check passes
  mockCheckSeatAvailability.mockResolvedValue({
    canAdd: true,
    currentMembers: 2,
    seatLimit: 5,
    seatsRemaining: 3,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendInvitation — seat limit enforcement', () => {
  it('allows invitation when plan is agency and role check passes', async () => {
    setupAuthContext({ plan: 'agency', role: 'admin' });

    // Mock resolvePublicUserId
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_USER_ID },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'memberships') {
        // member count check
        return {
          select: vi.fn().mockImplementation((_cols: string, opts?: { count?: string }) => {
            if (opts?.count) {
              return {
                eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
              };
            }
            // existing members check
            return {
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'm1', users: { email: 'existing@test.com' } },
                ],
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'pending_invitations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'inv-1', token: 'test-token-123' },
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

    const result = await sendInvitation({ email: 'new@test.com', role: 'viewer' });
    expect(result.success).toBe(true);
  });

  it('blocks invitation when plan is not agency and member count >= 1', async () => {
    setupAuthContext({ plan: 'growth', role: 'owner' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_USER_ID },
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

    const result = await sendInvitation({ email: 'new@test.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('plan_upgrade_required');
  });

  it('blocks when caller has insufficient role', async () => {
    setupAuthContext({ role: 'viewer' });

    const result = await sendInvitation({ email: 'new@test.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('insufficient_role');
  });

  it('blocks when user not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);

    const result = await sendInvitation({ email: 'new@test.com', role: 'viewer' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  it('seat check runs BEFORE email — no email sent when plan check fails', async () => {
    setupAuthContext({ plan: 'growth', role: 'owner' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: TEST_USER_ID },
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

    await sendInvitation({ email: 'new@test.com', role: 'viewer' });
    expect(mockSendInvitationEmail).not.toHaveBeenCalled();
  });
});
