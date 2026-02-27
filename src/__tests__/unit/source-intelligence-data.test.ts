// ---------------------------------------------------------------------------
// source-intelligence-data.test.ts — Unit tests for source intelligence data layer
//
// Sprint 82: 7 tests — fetchSourceIntelligence.
//
// Run:
//   npx vitest run src/__tests__/unit/source-intelligence-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchSourceIntelligence } from '@/lib/data/source-intelligence';

// ---------------------------------------------------------------------------
// Mocks — analyzeSourceIntelligence is a pure function, so we mock minimally
// ---------------------------------------------------------------------------

vi.mock('@/lib/services/source-intelligence.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/source-intelligence.service')>();
  return {
    ...actual,
    // Use the real pure function — no need to mock
  };
});

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function createMockSupabase(evalRows: unknown[] = [], locationRow: unknown | null = null) {
  const mockEvalChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue({ data: evalRows, error: null }),
  };

  const mockLocationChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue({ data: locationRow, error: null }),
  };

  let callCount = 0;
  const mockFrom = vi.fn(() => {
    callCount++;
    // First call is for sov_evaluations, second for locations
    if (callCount <= 1) return mockEvalChain;
    return mockLocationChain;
  });

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    from: mockFrom,
    evalChain: mockEvalChain,
    locationChain: mockLocationChain,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchSourceIntelligence', () => {
  it('1. queries sov_evaluations filtered by org_id and location_id', async () => {
    const { client, evalChain } = createMockSupabase([], { business_name: 'Test', website_url: null });
    await fetchSourceIntelligence(client, 'org-1', 'loc-1');

    expect(evalChain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(evalChain.eq).toHaveBeenCalledWith('location_id', 'loc-1');
  });

  it('2. joins with target_queries for query_text', async () => {
    const { client, evalChain } = createMockSupabase([], { business_name: 'Test', website_url: null });
    await fetchSourceIntelligence(client, 'org-1', 'loc-1');

    expect(evalChain.select).toHaveBeenCalled();
    const selectArg = evalChain.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('target_queries');
    expect(selectArg).toContain('query_text');
  });

  it('3. defaults to 30-day range', async () => {
    const { client, evalChain } = createMockSupabase([], { business_name: 'Test', website_url: null });
    await fetchSourceIntelligence(client, 'org-1', 'loc-1');

    expect(evalChain.gte).toHaveBeenCalled();
    const gteArgs = evalChain.gte.mock.calls[0];
    expect(gteArgs[0]).toBe('created_at');
    // The date should be roughly 30 days ago
    const cutoffDate = new Date(gteArgs[1] as string);
    const now = new Date();
    const daysDiff = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(30);
  });

  it('4. respects custom dayRange option', async () => {
    const { client, evalChain } = createMockSupabase([], { business_name: 'Test', website_url: null });
    await fetchSourceIntelligence(client, 'org-1', 'loc-1', { dayRange: 7 });

    const gteArgs = evalChain.gte.mock.calls[0];
    const cutoffDate = new Date(gteArgs[1] as string);
    const now = new Date();
    const daysDiff = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(7);
  });

  it('5. fetches location business_name and website_url', async () => {
    const { client, locationChain } = createMockSupabase([], { business_name: 'Test Biz', website_url: 'https://test.com' });
    await fetchSourceIntelligence(client, 'org-1', 'loc-1');

    expect(locationChain.select).toHaveBeenCalled();
    const selectArg = locationChain.select.mock.calls[0][0] as string;
    expect(selectArg).toContain('business_name');
    expect(selectArg).toContain('website_url');
  });

  it('6. handles empty evaluations', async () => {
    const { client } = createMockSupabase([], { business_name: 'Test', website_url: null });
    const result = await fetchSourceIntelligence(client, 'org-1', 'loc-1');

    expect(result.sources).toHaveLength(0);
    expect(result.evaluationCount).toBe(0);
    expect(result.firstPartyRate).toBe(0);
  });

  it('7. returns SourceIntelligenceResult on happy path', async () => {
    const evalRows = [
      {
        engine: 'google',
        cited_sources: [{ url: 'https://yelp.com/test', title: 'Yelp' }],
        source_mentions: null,
        raw_response: 'Some response',
        target_queries: { query_text: 'best restaurant' },
      },
    ];

    const { client } = createMockSupabase(evalRows, { business_name: 'Test Biz', website_url: 'https://test.com' });
    const result = await fetchSourceIntelligence(client, 'org-1', 'loc-1');

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.evaluationCount).toBe(1);
    expect(result.categoryBreakdown.length).toBeGreaterThan(0);
  });
});
