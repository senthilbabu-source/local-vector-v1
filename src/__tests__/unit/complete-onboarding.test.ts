// ---------------------------------------------------------------------------
// complete-onboarding.test.ts — Unit tests for completeOnboarding action
//
// Sprint 91: 7 tests — mocks auth + supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/complete-onboarding.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockServiceRoleClient = vi.fn();
const mockSeedSOVQueries = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createServiceRoleClient: () => mockServiceRoleClient(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: (...args: unknown[]) => mockSeedSOVQueries(...args),
}));

vi.mock('@/lib/inngest/functions/audit-cron', () => ({
  processOrgAudit: vi.fn().mockResolvedValue({ success: true, hallucinationsInserted: 0, auditId: null }),
}));

import { completeOnboarding } from '@/app/onboarding/actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTH_CTX = {
  userId: 'u1',
  email: 'test@test.com',
  fullName: null,
  orgId: 'org-1',
  orgName: 'Test Org',
  role: 'owner' as const,
  plan: 'trial',
  onboarding_completed: false,
};

function makeMockServiceRole(opts?: { updateError?: string | null }) {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      data: null,
      error: opts?.updateError ? { message: opts.updateError } : null,
    }),
  });

  return {
    from: vi.fn().mockReturnValue({
      update: mockUpdate,
    }),
    _mockUpdate: mockUpdate,
  };
}

function makeMockUserClient(opts?: { queryCount?: number; locationData?: unknown }) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'target_queries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: opts?.queryCount ?? 5,
              error: null,
            }),
          }),
        };
      }
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: opts?.locationData ?? {
                    id: 'loc-1',
                    business_name: 'Test',
                    city: 'Atlanta',
                    state: 'GA',
                    categories: ['restaurant'],
                  },
                  error: null,
                }),
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
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('completeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { success: false } when user is not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await completeOnboarding();
    expect(result.success).toBe(false);
  });

  it('sets onboarding_completed to true on organizations table', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const serviceRole = makeMockServiceRole();
    mockServiceRoleClient.mockReturnValue(serviceRole);
    mockCreateClient.mockResolvedValue(makeMockUserClient());

    const result = await completeOnboarding();
    expect(result.success).toBe(true);
    expect(serviceRole._mockUpdate).toHaveBeenCalledWith({
      onboarding_completed: true,
    });
  });

  it('is idempotent — second call does not error', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ ...AUTH_CTX, onboarding_completed: true });
    const serviceRole = makeMockServiceRole();
    mockServiceRoleClient.mockReturnValue(serviceRole);
    mockCreateClient.mockResolvedValue(makeMockUserClient());

    const result = await completeOnboarding();
    expect(result.success).toBe(true);
  });

  it('triggers SOV seeding if target_queries count is 0 for org', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const serviceRole = makeMockServiceRole();
    mockServiceRoleClient.mockReturnValue(serviceRole);
    mockCreateClient.mockResolvedValue(makeMockUserClient({ queryCount: 0 }));
    mockSeedSOVQueries.mockResolvedValue({ seeded: 10 });

    await completeOnboarding();
    expect(mockSeedSOVQueries).toHaveBeenCalled();
  });

  it('does NOT re-trigger SOV seeding if queries already exist', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const serviceRole = makeMockServiceRole();
    mockServiceRoleClient.mockReturnValue(serviceRole);
    mockCreateClient.mockResolvedValue(makeMockUserClient({ queryCount: 10 }));

    await completeOnboarding();
    expect(mockSeedSOVQueries).not.toHaveBeenCalled();
  });

  it('returns { success: true } on success', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const serviceRole = makeMockServiceRole();
    mockServiceRoleClient.mockReturnValue(serviceRole);
    mockCreateClient.mockResolvedValue(makeMockUserClient());

    const result = await completeOnboarding();
    expect(result).toEqual({ success: true });
  });

  it('returns { success: false, error } when DB update fails', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const serviceRole = makeMockServiceRole({ updateError: 'DB connection lost' });
    mockServiceRoleClient.mockReturnValue(serviceRole);

    const result = await completeOnboarding();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('DB connection lost');
    }
  });
});
