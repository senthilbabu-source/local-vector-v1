// ---------------------------------------------------------------------------
// src/__tests__/unit/health-score-action.test.ts
//
// Sprint 72: Server Action tests for AI Health Score.
// Mocks auth, Supabase client, and data fetcher.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

const mockFetchHealthScore = vi.fn();
vi.mock('@/lib/data/ai-health-score', () => ({
  fetchHealthScore: (...args: unknown[]) => mockFetchHealthScore(...args),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { getHealthScore } = await import('@/app/dashboard/actions/health-score');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getHealthScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. returns { success: false, error: "Unauthorized" } when no session', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await getHealthScore();
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('2. returns { success: false, error: "No primary location found" } when no primary location', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'u1',
      email: 'test@test.com',
      orgId: 'org-1',
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await getHealthScore();
    expect(result).toEqual({ success: false, error: 'No primary location found' });
  });

  it('3. returns { success: true, data: HealthScoreResult } on happy path', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'u1',
      email: 'test@test.com',
      orgId: 'org-1',
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'loc-1' },
      error: null,
    });
    const mockResult = {
      score: 55,
      grade: 'C',
      components: {},
      topRecommendation: null,
      recommendations: [],
    };
    mockFetchHealthScore.mockResolvedValue(mockResult);

    const result = await getHealthScore();
    expect(result).toEqual({ success: true, data: mockResult });
  });

  it('4. passes org_id and location_id to fetchHealthScore', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'u1',
      email: 'test@test.com',
      orgId: 'org-123',
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'loc-456' },
      error: null,
    });
    mockFetchHealthScore.mockResolvedValue({
      score: 50,
      grade: 'C',
      components: {},
      topRecommendation: null,
      recommendations: [],
    });

    await getHealthScore();
    expect(mockFetchHealthScore).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      'org-123',
      'loc-456',
    );
  });
});
