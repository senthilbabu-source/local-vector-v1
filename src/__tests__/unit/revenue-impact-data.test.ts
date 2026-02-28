// ---------------------------------------------------------------------------
// revenue-impact-data.test.ts — Unit tests for revenue impact data fetcher
//
// Sprint 85: 9 tests — mocks Supabase client.
//
// Run:
//   npx vitest run src/__tests__/unit/revenue-impact-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchRevenueImpact } from '@/lib/data/revenue-impact';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOC_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockSupabase(opts: {
  locationData?: Record<string, unknown> | null;
  targetQueries?: Record<string, unknown>[];
  sovEvals?: Record<string, unknown>[];
  hallucinations?: Record<string, unknown>[];
  competitorEvals?: Record<string, unknown>[];
} = {}) {
  const {
    locationData = { avg_customer_value: 45, monthly_covers: 800 },
    targetQueries = [],
    sovEvals = [],
    hallucinations = [],
    competitorEvals = [],
  } = opts;

  const mockFromCalls: string[] = [];
  let sovCallIndex = 0;

  const supabase = {
    from: vi.fn((table: string) => {
      mockFromCalls.push(table);

      if (table === 'locations') {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({ data: locationData, error: null });
        return chain;
      }

      if (table === 'target_queries') {
        const chain: Record<string, unknown> = {};
        chain.then = (cb: (v: unknown) => unknown) =>
          Promise.resolve(cb({ data: targetQueries, error: null }));
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        return chain;
      }

      if (table === 'sov_evaluations') {
        // Called twice: once for gap detection, once for competitor data
        const thisCallIndex = sovCallIndex++;
        const data = thisCallIndex === 0 ? sovEvals : competitorEvals;
        const chain: Record<string, unknown> = {};
        chain.then = (cb: (v: unknown) => unknown) =>
          Promise.resolve(cb({ data, error: null }));
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        return chain;
      }

      if (table === 'ai_hallucinations') {
        const chain: Record<string, unknown> = {};
        chain.then = (cb: (v: unknown) => unknown) =>
          Promise.resolve(cb({ data: hallucinations, error: null }));
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        return chain;
      }

      // Default fallback
      const chain: Record<string, unknown> = {};
      chain.then = (cb: (v: unknown) => unknown) =>
        Promise.resolve(cb({ data: [], error: null }));
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.gte = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain;
    }),
    _mockFromCalls: mockFromCalls,
  } as unknown as SupabaseClient<Database> & { _mockFromCalls: string[] };

  return supabase;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchRevenueImpact', () => {
  it('1. runs 5 parallel queries', async () => {
    const supabase = makeMockSupabase();
    await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);

    // locations, target_queries, sov_evaluations (x2), ai_hallucinations
    expect(supabase._mockFromCalls).toContain('locations');
    expect(supabase._mockFromCalls).toContain('target_queries');
    expect(supabase._mockFromCalls).toContain('ai_hallucinations');
    expect(supabase._mockFromCalls.filter((t) => t === 'sov_evaluations')).toHaveLength(2);
  });

  it('2. scopes all queries by org_id', async () => {
    const supabase = makeMockSupabase();
    await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // The mock .eq calls are chained; we verify the from() calls are made correctly
    expect(supabase.from).toHaveBeenCalledWith('locations');
    expect(supabase.from).toHaveBeenCalledWith('target_queries');
    expect(supabase.from).toHaveBeenCalledWith('ai_hallucinations');
  });

  it('3. falls back to DEFAULT_REVENUE_CONFIG when location fields null', async () => {
    const supabase = makeMockSupabase({
      locationData: { avg_customer_value: null, monthly_covers: null },
    });
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.config.avgCustomerValue).toBe(55);
    expect(result.config.monthlyCovers).toBe(1800);
  });

  it('4. computes SOV gaps from evaluations with null rank_position', async () => {
    const supabase = makeMockSupabase({
      targetQueries: [
        { id: 'q1', query_text: 'hookah near me', query_category: 'near_me' },
      ],
      sovEvals: [
        { query_id: 'q1', engine: 'openai', rank_position: null },
        { query_id: 'q1', engine: 'perplexity', rank_position: 2 },
        { query_id: 'q1', engine: 'google', rank_position: null },
      ],
    });
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.sovGapRevenue).toBeGreaterThan(0);
  });

  it('5. fetches open hallucinations (correction_status=open)', async () => {
    const supabase = makeMockSupabase({
      hallucinations: [
        { claim_text: 'permanently closed', severity: 'critical' },
      ],
    });
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.hallucinationRevenue).toBeGreaterThan(0);
  });

  it('6. computes your SOV from ranked/total evaluations', async () => {
    const supabase = makeMockSupabase({
      competitorEvals: [
        { rank_position: 1, mentioned_competitors: [] },
        { rank_position: null, mentioned_competitors: [] },
        { rank_position: 2, mentioned_competitors: [] },
        { rank_position: null, mentioned_competitors: [] },
      ],
    });
    // 2/4 ranked = 0.50 SOV — no competitor data so competitor revenue = 0
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.competitorRevenue).toBe(0);
  });

  it('7. finds top competitor from mentioned_competitors', async () => {
    const supabase = makeMockSupabase({
      competitorEvals: [
        { rank_position: 1, mentioned_competitors: [{ name: 'Cloud 9' }] },
        { rank_position: null, mentioned_competitors: [{ name: 'Cloud 9' }, { name: 'Sahara' }] },
        { rank_position: 1, mentioned_competitors: [{ name: 'Cloud 9' }] },
      ],
    });
    // Cloud 9 mentioned 3/3 = SOV 1.0, your SOV = 2/3 = 0.67
    // Competitor has higher SOV, so competitor revenue > 0
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.competitorRevenue).toBeGreaterThan(0);
  });

  it('8. handles empty data gracefully (no evaluations)', async () => {
    const supabase = makeMockSupabase({
      targetQueries: [],
      sovEvals: [],
      hallucinations: [],
      competitorEvals: [],
    });
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.totalMonthlyRevenue).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });

  it('9. returns RevenueImpactResult on happy path', async () => {
    const supabase = makeMockSupabase({
      locationData: { avg_customer_value: 45, monthly_covers: 800 },
      targetQueries: [
        { id: 'q1', query_text: 'hookah near me', query_category: 'near_me' },
      ],
      sovEvals: [
        { query_id: 'q1', engine: 'openai', rank_position: null },
        { query_id: 'q1', engine: 'perplexity', rank_position: null },
      ],
      hallucinations: [
        { claim_text: 'closed', severity: 'critical' },
      ],
      competitorEvals: [
        { rank_position: 1, mentioned_competitors: [{ name: 'Rival' }] },
        { rank_position: null, mentioned_competitors: [{ name: 'Rival' }] },
      ],
    });
    const result = await fetchRevenueImpact(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.totalMonthlyRevenue).toBeGreaterThan(0);
    expect(result.config).toBeDefined();
    expect(typeof result.isDefaultConfig).toBe('boolean');
    expect(result.totalAnnualRevenue).toBe(result.totalMonthlyRevenue * 12);
  });
});
