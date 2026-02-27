// ---------------------------------------------------------------------------
// entity-health-action.test.ts — Unit tests for entity health server actions
//
// Sprint 80: 10 tests — mocks auth + supabase.
//
// Run:
//   npx vitest run src/__tests__/unit/entity-health-action.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so hoisting works
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
const mockCreateClient = vi.fn();
const mockFetchEntityHealth = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock('@/lib/data/entity-health', () => ({
  fetchEntityHealth: (...args: unknown[]) => mockFetchEntityHealth(...args),
}));

vi.mock('@/lib/services/entity-health.service', async () => {
  const actual = await vi.importActual('@/lib/services/entity-health.service');
  return actual;
});

import { getEntityHealth, updateEntityStatus } from '@/app/dashboard/actions/entity-health';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSupabase(locationData: { id: string } | null = { id: 'loc-1' }) {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: locationData, error: null }),
          }),
        }),
      }),
      update: mockUpdate,
      insert: mockInsert,
    }),
    _mockUpdate: mockUpdate,
    _mockInsert: mockInsert,
  };
}

function makeFormData(platform: string, status: string): FormData {
  const fd = new FormData();
  fd.set('platform', platform);
  fd.set('status', status);
  return fd;
}

const MOCK_HEALTH_RESULT = {
  platforms: [],
  confirmedCount: 3,
  totalPlatforms: 6,
  score: 50,
  rating: 'at_risk' as const,
  recommendations: [],
};

// ---------------------------------------------------------------------------
// getEntityHealth
// ---------------------------------------------------------------------------

describe('getEntityHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. returns Unauthorized when no session', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await getEntityHealth();
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('2. returns error when no primary location', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase(null));
    const result = await getEntityHealth();
    expect(result).toEqual({ success: false, error: 'No primary location' });
  });

  it('3. returns EntityHealthResult on happy path', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    mockFetchEntityHealth.mockResolvedValue(MOCK_HEALTH_RESULT);
    const result = await getEntityHealth();
    expect(result).toEqual({ success: true, data: MOCK_HEALTH_RESULT });
  });
});

// ---------------------------------------------------------------------------
// updateEntityStatus
// ---------------------------------------------------------------------------

describe('updateEntityStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('4. returns Unauthorized when no session', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await updateEntityStatus(makeFormData('yelp', 'confirmed'));
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('5. validates platform name with Zod', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    const result = await updateEntityStatus(makeFormData('invalid_platform', 'confirmed'));
    expect(result.success).toBe(false);
  });

  it('6. validates status value with Zod', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    const result = await updateEntityStatus(makeFormData('yelp', 'invalid_status'));
    expect(result.success).toBe(false);
  });

  it('7. updates the correct platform column', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    const mockSb = makeMockSupabase({ id: 'loc-1' });
    mockCreateClient.mockResolvedValue(mockSb);
    mockFetchEntityHealth.mockResolvedValue(MOCK_HEALTH_RESULT);

    await updateEntityStatus(makeFormData('yelp', 'confirmed'));
    expect(mockSb.from).toHaveBeenCalledWith('entity_checks');
  });

  it('8. creates entity_checks row if none exists', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    // Return null for entity_checks select (no existing row)
    const mockSb = {
      from: vi.fn((table: string) => {
        if (table === 'locations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'loc-1' }, error: null }),
                }),
              }),
            }),
          };
        }
        // entity_checks
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }),
    };
    mockCreateClient.mockResolvedValue(mockSb);
    mockFetchEntityHealth.mockResolvedValue(MOCK_HEALTH_RESULT);

    const result = await updateEntityStatus(makeFormData('tripadvisor', 'confirmed'));
    expect(result.success).toBe(true);
  });

  it('9. recalculates entity_score after update', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    const mockSb = makeMockSupabase({ id: 'loc-1' });
    mockCreateClient.mockResolvedValue(mockSb);
    mockFetchEntityHealth.mockResolvedValue(MOCK_HEALTH_RESULT);

    await updateEntityStatus(makeFormData('yelp', 'confirmed'));
    // fetchEntityHealth is called to recompute
    expect(mockFetchEntityHealth).toHaveBeenCalled();
  });

  it('10. returns updated EntityHealthResult', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ orgId: 'org-1' });
    mockCreateClient.mockResolvedValue(makeMockSupabase({ id: 'loc-1' }));
    mockFetchEntityHealth.mockResolvedValue(MOCK_HEALTH_RESULT);

    const result = await updateEntityStatus(makeFormData('apple_maps', 'missing'));
    expect(result).toEqual({ success: true, data: MOCK_HEALTH_RESULT });
  });
});
