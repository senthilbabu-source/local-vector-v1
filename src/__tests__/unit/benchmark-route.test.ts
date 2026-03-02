// ---------------------------------------------------------------------------
// Sprint 122: benchmark-route.test.ts — 10 tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetOrgBenchmark = vi.fn();
const mockGetOrgBenchmarkHistory = vi.fn();

vi.mock('@/lib/services/benchmark-service', () => ({
  getOrgBenchmark: (...args: unknown[]) => mockGetOrgBenchmark(...args),
  getOrgBenchmarkHistory: (...args: unknown[]) => mockGetOrgBenchmarkHistory(...args),
}));

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

const mockCreateClient = vi.fn().mockResolvedValue({});
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { GET } from '@/app/api/benchmarks/[orgId]/route';
import {
  MOCK_ORG_BENCHMARK_RESULT,
  MOCK_BENCHMARK_HISTORY,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function makeRequest(orgId: string, weeks?: number): NextRequest {
  const url = `http://localhost/api/benchmarks/${orgId}${weeks ? `?weeks=${weeks}` : ''}`;
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/benchmarks/[orgId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgBenchmark.mockResolvedValue(null);
    mockGetOrgBenchmarkHistory.mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated user is not a member of requested orgId', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: 'different-org-id',
      email: 'test@test.com',
    });
    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns insufficient_data:true when no cache rows (200, not 404)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(null);
    mockGetOrgBenchmarkHistory.mockResolvedValue([]);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insufficient_data).toBe(true);
    expect(body.reason).toBe('no_benchmark_data');
  });

  it('returns current and history when data exists', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue(MOCK_BENCHMARK_HISTORY);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    const body = await res.json();
    expect(body.insufficient_data).toBe(false);
    expect(body.current).toBeDefined();
    expect(body.history).toBeDefined();
  });

  it('history length respects ?weeks param', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue(MOCK_BENCHMARK_HISTORY.slice(0, 4));

    const res = await GET(makeRequest(ORG_ID, 4), { params: Promise.resolve({ orgId: ORG_ID }) });
    expect(res.status).toBe(200);
    // Verify getOrgBenchmarkHistory was called with weeks=4
    expect(mockGetOrgBenchmarkHistory).toHaveBeenCalledWith(expect.anything(), ORG_ID, 4);
  });

  it('history is ASC order (oldest first)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue(MOCK_BENCHMARK_HISTORY);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    const body = await res.json();

    // Verify ASC order
    for (let i = 1; i < body.history.length; i++) {
      expect(body.history[i].week_of >= body.history[i - 1].week_of).toBe(true);
    }
  });

  it('current equals most recent cache row', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue(MOCK_BENCHMARK_HISTORY);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    const body = await res.json();
    expect(body.current.percentile_rank).toBe(MOCK_ORG_BENCHMARK_RESULT.percentile_rank);
    expect(body.current.org_sov_score).toBe(MOCK_ORG_BENCHMARK_RESULT.org_sov_score);
  });

  it('percentile_rank is within 0–100', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue([]);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    const body = await res.json();
    expect(body.current.percentile_rank).toBeGreaterThanOrEqual(0);
    expect(body.current.percentile_rank).toBeLessThanOrEqual(100);
  });

  it('sample_count is present in response', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue([]);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    const body = await res.json();
    expect(body.current.sample_count).toBeDefined();
    expect(body.current.sample_count).toBeGreaterThan(0);
  });

  it('does not leak other org scores in response', async () => {
    mockGetSafeAuthContext.mockResolvedValue({
      userId: 'user-1',
      orgId: ORG_ID,
      email: 'test@test.com',
    });
    mockGetOrgBenchmark.mockResolvedValue(MOCK_ORG_BENCHMARK_RESULT);
    mockGetOrgBenchmarkHistory.mockResolvedValue(MOCK_BENCHMARK_HISTORY);

    const res = await GET(makeRequest(ORG_ID), { params: Promise.resolve({ orgId: ORG_ID }) });
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    // Should not contain any org_id references
    expect(bodyStr).not.toContain('org_id');
    // Should only contain the requesting org's data
    expect(body.current.category_label).toBe('Hookah Lounge');
  });
});
