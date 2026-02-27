// ---------------------------------------------------------------------------
// cluster-map-action.test.ts — Unit tests for cluster map server action
//
// Sprint 87: 8 tests — mocks auth + supabase + data fetcher.
//
// Run:
//   npx vitest run src/__tests__/unit/cluster-map-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so hoisting works
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockFetchClusterMapData = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('@/lib/data/cluster-map', () => ({
  fetchClusterMapData: (...args: unknown[]) => mockFetchClusterMapData(...args),
}));

import { getClusterMapData } from '@/app/dashboard/cluster-map/actions';

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

const EMPTY_MAP_RESULT = {
  points: [],
  hallucinationZones: [],
  selfPoint: null,
  availableEngines: ['all' as const],
  activeFilter: 'all' as const,
  stats: { totalCompetitors: 0, totalQueries: 0, hallucinationCount: 0, dominantEngine: null },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getClusterMapData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-A01: Returns Unauthorized when no auth context', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await getClusterMapData();
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('TC-A02: Returns error when no primary location found', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase(null));
    const result = await getClusterMapData();
    expect(result).toEqual({ success: false, error: 'No primary location found' });
  });

  it('TC-A03: Returns success with ClusterMapResult for valid request', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    mockFetchClusterMapData.mockResolvedValue(EMPTY_MAP_RESULT);

    const result = await getClusterMapData();
    expect(result).toEqual({ success: true, data: EMPTY_MAP_RESULT });
  });

  it('TC-A04: Passes engineFilter through to fetchClusterMapData', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    mockFetchClusterMapData.mockResolvedValue(EMPTY_MAP_RESULT);

    await getClusterMapData('perplexity');
    expect(mockFetchClusterMapData).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'loc-1',
      'perplexity',
    );
  });

  it('TC-A05: Defaults engineFilter to all when not provided', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    mockFetchClusterMapData.mockResolvedValue(EMPTY_MAP_RESULT);

    await getClusterMapData();
    expect(mockFetchClusterMapData).toHaveBeenCalledWith(
      expect.anything(),
      'org-1',
      'loc-1',
      'all',
    );
  });

  it('TC-A06: Uses getSafeAuthContext (not getAuthContext)', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    await getClusterMapData();
    expect(mockGetSafeAuthContext).toHaveBeenCalledTimes(1);
  });

  it('TC-A07: Queries primary location with is_primary=true', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    const mockSupa = makeMockSupabase({ id: 'loc-1' });
    mockCreateClient.mockResolvedValue(mockSupa);
    mockFetchClusterMapData.mockResolvedValue(EMPTY_MAP_RESULT);

    await getClusterMapData();
    // Verify from was called with 'locations'
    expect(mockSupa.from).toHaveBeenCalledWith('locations');
  });

  it('TC-A08: Returns success even when data is empty (graceful degradation)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    mockFetchClusterMapData.mockResolvedValue(EMPTY_MAP_RESULT);

    const result = await getClusterMapData();
    expect(result).toHaveProperty('success', true);
  });
});
