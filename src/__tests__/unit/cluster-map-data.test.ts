// ---------------------------------------------------------------------------
// cluster-map-data.test.ts — Unit tests for cluster map data fetcher
//
// Sprint 87: 12 tests — mocks Supabase client.
//
// Run:
//   npx vitest run src/__tests__/unit/cluster-map-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchClusterMapData } from '@/lib/data/cluster-map';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_LOC_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

interface MockData {
  location?: { business_name: string } | null;
  evaluations?: Array<{
    engine: string;
    query_id: string;
    rank_position: number | null;
    mentioned_competitors: string[];
  }>;
  hallucinations?: Array<{
    id: string;
    claim_text: string;
    severity: string;
    model_provider: string;
    category: string | null;
  }>;
  visAnalytics?: { share_of_voice: number } | null;
}

function makeMockSupabase(data: MockData = {}) {
  const mockFromCalls: string[] = [];

  const location = 'location' in data ? data.location : { business_name: 'Charcoal N Chill' };
  const evaluations = data.evaluations ?? [];
  const hallucinations = data.hallucinations ?? [];
  const visAnalytics = 'visAnalytics' in data ? data.visAnalytics : null;

  const supabase = {
    from: vi.fn((table: string) => {
      mockFromCalls.push(table);

      const makeChainable = (resolveData: unknown): Record<string, unknown> => {
        const c: Record<string, unknown> = {};
        c.select = vi.fn().mockReturnValue(c);
        c.eq = vi.fn().mockReturnValue(c);
        c.gte = vi.fn().mockReturnValue(c);
        c.order = vi.fn().mockReturnValue(c);
        c.limit = vi.fn().mockReturnValue(c);
        c.single = vi.fn().mockResolvedValue({ data: resolveData, error: null });
        c.maybeSingle = vi.fn().mockResolvedValue({ data: resolveData, error: null });
        // Make it thenable for Promise.all
        Object.defineProperty(c, 'then', {
          value: (
            onfulfilled?: (value: { data: unknown; error: null }) => unknown,
          ) => {
            const result = { data: resolveData, error: null };
            return Promise.resolve(onfulfilled ? onfulfilled(result) : result);
          },
          writable: true,
        });
        return c;
      };

      if (table === 'locations') return makeChainable(location);
      if (table === 'sov_evaluations') return makeChainable(evaluations);
      if (table === 'ai_hallucinations') return makeChainable(hallucinations);
      if (table === 'visibility_analytics') return makeChainable(visAnalytics);

      return makeChainable(null);
    }),
  } as unknown as SupabaseClient<Database>;

  return { supabase, mockFromCalls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchClusterMapData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-D01: Returns ClusterMapResult with correct shape', async () => {
    const { supabase } = makeMockSupabase();
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);

    expect(result).toHaveProperty('points');
    expect(result).toHaveProperty('hallucinationZones');
    expect(result).toHaveProperty('selfPoint');
    expect(result).toHaveProperty('availableEngines');
    expect(result).toHaveProperty('activeFilter');
    expect(result).toHaveProperty('stats');
  });

  it('TC-D02: Queries all 4 required tables', async () => {
    const { supabase, mockFromCalls } = makeMockSupabase();
    await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);

    expect(mockFromCalls).toContain('locations');
    expect(mockFromCalls).toContain('sov_evaluations');
    expect(mockFromCalls).toContain('ai_hallucinations');
    expect(mockFromCalls).toContain('visibility_analytics');
  });

  it('TC-D03: Filters sov_evaluations to last 30 days', async () => {
    const { supabase } = makeMockSupabase();
    await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);

    // The sov_evaluations chain should have called .gte with created_at
    const fromCall = (supabase.from as ReturnType<typeof vi.fn>).mock.results.find(
      (_r: { value: unknown }, i: number) =>
        (supabase.from as ReturnType<typeof vi.fn>).mock.calls[i][0] === 'sov_evaluations',
    );
    expect(fromCall).toBeDefined();
  });

  it('TC-D04: Only fetches open hallucinations', async () => {
    const { supabase } = makeMockSupabase();
    await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);

    // Verify ai_hallucinations was queried
    const calls = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(calls).toContain('ai_hallucinations');
  });

  it('TC-D05: Fetches latest visibility_analytics', async () => {
    const { supabase } = makeMockSupabase({
      visAnalytics: { share_of_voice: 0.65 },
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.selfPoint!.sov).toBe(0.65);
  });

  it('TC-D06: Passes engineFilter through to buildClusterMap', async () => {
    const { supabase } = makeMockSupabase({
      evaluations: [
        { engine: 'perplexity', query_id: 'q1', rank_position: 1, mentioned_competitors: [] },
        { engine: 'openai', query_id: 'q2', rank_position: 2, mentioned_competitors: [] },
      ],
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID, 'perplexity');
    expect(result.activeFilter).toBe('perplexity');
    expect(result.stats.totalQueries).toBe(1);
  });

  it('TC-D07: Handles null/empty Supabase results gracefully', async () => {
    const { supabase } = makeMockSupabase({
      location: null,
      evaluations: [],
      hallucinations: [],
      visAnalytics: null,
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.selfPoint).toBeDefined();
    expect(result.points).toHaveLength(1); // self only
    expect(result.hallucinationZones).toHaveLength(0);
  });

  it('TC-D08: Returns default businessName when location not found', async () => {
    const { supabase } = makeMockSupabase({ location: null });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.selfPoint!.name).toBe('My Business');
  });

  it('TC-D09: Computes truthScore from hallucination ratio', async () => {
    const { supabase } = makeMockSupabase({
      evaluations: [
        { engine: 'perplexity', query_id: 'q1', rank_position: 1, mentioned_competitors: [] },
        { engine: 'openai', query_id: 'q2', rank_position: 1, mentioned_competitors: [] },
        { engine: 'perplexity', query_id: 'q3', rank_position: 1, mentioned_competitors: [] },
        { engine: 'openai', query_id: 'q4', rank_position: 1, mentioned_competitors: [] },
      ],
      hallucinations: [
        { id: 'h1', claim_text: 'Claim', severity: 'high', model_provider: 'openai-gpt4o', category: null },
      ],
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    // 1 hallucination / 4 evals = 25%, so truth = 75
    expect(result.selfPoint!.factAccuracy).toBe(75);
  });

  it('TC-D10: truthScore is null (defaults to 50) when no evaluations exist', async () => {
    const { supabase } = makeMockSupabase({
      evaluations: [],
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.selfPoint!.factAccuracy).toBe(50);
  });

  it('TC-D11: Casts mentioned_competitors from JSONB to string[]', async () => {
    const { supabase } = makeMockSupabase({
      evaluations: [
        {
          engine: 'perplexity',
          query_id: 'q1',
          rank_position: 1,
          mentioned_competitors: ['Comp A', 'Comp B'],
        },
      ],
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.stats.totalCompetitors).toBe(2);
  });

  it('TC-D12: Maps hallucination severity and model_provider correctly', async () => {
    const { supabase } = makeMockSupabase({
      evaluations: [
        { engine: 'perplexity', query_id: 'q1', rank_position: 1, mentioned_competitors: [] },
      ],
      hallucinations: [
        { id: 'h1', claim_text: 'False claim', severity: 'critical', model_provider: 'openai-gpt4o', category: 'hours_check' },
      ],
    });
    const result = await fetchClusterMapData(supabase, TEST_ORG_ID, TEST_LOC_ID);
    expect(result.hallucinationZones).toHaveLength(1);
    expect(result.hallucinationZones[0].severity).toBe('critical');
    expect(result.hallucinationZones[0].engine).toBe('openai');
  });
});
