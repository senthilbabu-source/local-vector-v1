// ---------------------------------------------------------------------------
// seed-competitors.test.ts — Unit tests for seedOnboardingCompetitors action
//
// Sprint 91: 8 tests — mocks auth + supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/seed-competitors.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so hoisting works
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
  createServiceRoleClient: () => ({}),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/services/sov-seed', () => ({
  seedSOVQueries: vi.fn().mockResolvedValue({ seeded: 0 }),
}));

vi.mock('@/lib/inngest/functions/audit-cron', () => ({
  processOrgAudit: vi.fn().mockResolvedValue({ success: true, hallucinationsInserted: 0, auditId: null }),
}));

import { seedOnboardingCompetitors } from '@/app/onboarding/actions';

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

function makeMockSupabase(opts?: {
  existingCompetitors?: string[];
  insertError?: string | null;
  locationId?: string | null;
}) {
  const mockInsert = vi.fn().mockResolvedValue({
    data: null,
    error: opts?.insertError ? { message: opts.insertError } : null,
  });

  return {
    from: vi.fn((table: string) => {
      if (table === 'locations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: opts?.locationId !== undefined
                    ? (opts.locationId ? { id: opts.locationId } : null)
                    : { id: 'loc-1' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'competitors') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: (opts?.existingCompetitors ?? []).map((c) => ({
                competitor_name: c,
              })),
              error: null,
            }),
          }),
          insert: mockInsert,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      };
    }),
    _mockInsert: mockInsert,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedOnboardingCompetitors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { success: false } when user is not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await seedOnboardingCompetitors(['Test']);
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 competitors', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const result = await seedOnboardingCompetitors([
      'A', 'B', 'C', 'D', 'E', 'F',
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('5');
    }
  });

  it('inserts all provided competitor names', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    const result = await seedOnboardingCompetitors(['Cloud 9', 'Hookah Palace']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.seeded).toBe(2);
    }
    expect(mock._mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ competitor_name: 'Cloud 9' }),
        expect.objectContaining({ competitor_name: 'Hookah Palace' }),
      ]),
    );
  });

  it('skips duplicates (case-insensitive name match for same org)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeMockSupabase({ existingCompetitors: ['Cloud 9 Lounge'] });
    mockCreateClient.mockResolvedValue(mock);

    const result = await seedOnboardingCompetitors(['cloud 9 lounge', 'New Place']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.seeded).toBe(1);
    }
    expect(mock._mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ competitor_name: 'New Place' }),
      ]),
    );
  });

  it('returns { success: true, seeded: 0 } for empty array', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const result = await seedOnboardingCompetitors([]);
    expect(result).toEqual({ success: true, seeded: 0 });
  });

  it('returns { success: false, error } when Supabase insert fails', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeMockSupabase({ insertError: 'DB connection failed' });
    mockCreateClient.mockResolvedValue(mock);

    const result = await seedOnboardingCompetitors(['Test']);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('DB connection failed');
    }
  });

  it('sets notes: "Added during onboarding" on all inserted rows', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeMockSupabase();
    mockCreateClient.mockResolvedValue(mock);

    await seedOnboardingCompetitors(['Test Competitor']);
    expect(mock._mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ notes: 'Added during onboarding' }),
      ]),
    );
  });

  it('returns { success: true, seeded: 0 } when all names are duplicates', async () => {
    mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
    const mock = makeMockSupabase({ existingCompetitors: ['Already Here'] });
    mockCreateClient.mockResolvedValue(mock);

    const result = await seedOnboardingCompetitors(['already here']);
    expect(result).toEqual({ success: true, seeded: 0 });
  });
});
