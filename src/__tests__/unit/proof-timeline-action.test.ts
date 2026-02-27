// ---------------------------------------------------------------------------
// proof-timeline-action.test.ts — Unit tests for proof timeline server action
//
// Sprint 77: 4 tests — mocks auth + supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/proof-timeline-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so hoisting works
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockFetchProofTimeline = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('@/lib/data/proof-timeline', () => ({
  fetchProofTimeline: (...args: unknown[]) => mockFetchProofTimeline(...args),
}));

import { getProofTimeline } from '@/app/dashboard/actions/proof-timeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSupabase(locationData: { id: string } | null = { id: 'loc-1' }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: locationData, error: null }),
          }),
        }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getProofTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. returns Unauthorized when no session', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await getProofTimeline();
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('2. returns error when no primary location', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase(null));
    const result = await getProofTimeline();
    expect(result).toEqual({ success: false, error: 'No primary location' });
  });

  it('3. returns success with ProofTimeline on happy path', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    const mockTimeline = { events: [], summary: { startDate: '', endDate: '', sovDelta: null, healthScoreDelta: null, actionsCompleted: 0, hallucinationsResolved: 0 } };
    mockFetchProofTimeline.mockResolvedValue(mockTimeline);

    const result = await getProofTimeline();
    expect(result).toEqual({ success: true, data: mockTimeline });
  });

  it('4. passes org_id and location_id to fetchProofTimeline', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-abc' });
    const mockSb = makeMockSupabase({ id: 'loc-xyz' });
    mockCreateClient.mockResolvedValue(mockSb);
    mockFetchProofTimeline.mockResolvedValue({ events: [], summary: {} });

    await getProofTimeline();
    expect(mockFetchProofTimeline).toHaveBeenCalledWith(mockSb, 'org-abc', 'loc-xyz');
  });
});
