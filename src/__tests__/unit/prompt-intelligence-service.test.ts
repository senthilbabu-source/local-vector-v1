// ---------------------------------------------------------------------------
// prompt-intelligence-service.test.ts — Unit tests for Prompt Intelligence
//
// Tests the 3 gap detection algorithms, reference library builder, category
// breakdown computation, and gap capping logic.
//
// Run:
//   npx vitest run src/__tests__/unit/prompt-intelligence-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  buildReferenceLibrary,
  detectQueryGaps,
  computeCategoryBreakdown,
} from '@/lib/services/prompt-intelligence.service';

// ---------------------------------------------------------------------------
// Mock Supabase builder
// ---------------------------------------------------------------------------

interface MockTableConfig {
  locations?: { data: unknown; error: unknown };
  competitors?: { data: unknown; error: unknown };
  target_queries?: { data: unknown; error: unknown };
  competitor_intercepts?: { data: unknown; error: unknown };
  sov_evaluations?: { data: unknown; error: unknown };
}

/**
 * Build a Supabase mock where .from().select().eq() chains resolve as promises.
 * This matches how the service uses Promise.all on query chains.
 *
 * Key pattern: each .from() call returns a chainable object where .select()
 * and .eq() return `this`, and the chain is also a thenable (has .then())
 * so it resolves automatically in Promise.all().
 */
function makeMockSupabase(config: MockTableConfig = {}) {
  const defaults = {
    locations: { data: null, error: null },
    competitors: { data: [], error: null },
    target_queries: { data: [], error: null },
    competitor_intercepts: { data: [], error: null },
    sov_evaluations: { data: [], error: null },
  };

  const merged = { ...defaults, ...config };

  return {
    from: vi.fn((table: string) => {
      const tableData = merged[table as keyof typeof merged] ?? { data: null, error: null };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockResolvedValue(tableData);
      chain.maybeSingle = vi.fn().mockResolvedValue(tableData);
      // Make chain thenable for Promise.all usage
      chain.then = (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(tableData).then(resolve, reject);

      return chain;
    }),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const MOCK_LOCATION = {
  id: 'loc-001',
  org_id: 'org-001',
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  categories: ['hookah lounge'],
};

// ---------------------------------------------------------------------------
// Tests: buildReferenceLibrary
// ---------------------------------------------------------------------------

describe('buildReferenceLibrary', () => {
  it('generates discovery, near_me, occasion, and comparison queries for hospitality', async () => {
    const supabase = makeMockSupabase({
      locations: {
        data: MOCK_LOCATION,
        error: null,
      },
      competitors: {
        data: [{ competitor_name: 'Cloud 9 Lounge' }],
        error: null,
      },
    });

    const refs = await buildReferenceLibrary('loc-001', supabase);

    // Should have all 4 tiers
    const categories = [...new Set(refs.map((r) => r.queryCategory))];
    expect(categories).toContain('discovery');
    expect(categories).toContain('near_me');
    expect(categories).toContain('occasion');
    expect(categories).toContain('comparison');

    // Discovery: 4 queries
    expect(refs.filter((r) => r.queryCategory === 'discovery')).toHaveLength(4);

    // Near Me: 3 queries
    expect(refs.filter((r) => r.queryCategory === 'near_me')).toHaveLength(3);

    // Occasion: 5 queries (hookah lounge is hospitality)
    expect(refs.filter((r) => r.queryCategory === 'occasion')).toHaveLength(5);

    // Comparison: 1 query (1 competitor)
    expect(refs.filter((r) => r.queryCategory === 'comparison')).toHaveLength(1);
  });

  it('skips occasion queries for non-hospitality categories', async () => {
    const supabase = makeMockSupabase({
      locations: {
        data: { ...MOCK_LOCATION, categories: ['auto repair'] },
        error: null,
      },
      competitors: { data: [], error: null },
    });

    const refs = await buildReferenceLibrary('loc-001', supabase);

    expect(refs.filter((r) => r.queryCategory === 'occasion')).toHaveLength(0);
  });

  it('returns empty array when location not found', async () => {
    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
    });

    const refs = await buildReferenceLibrary('nonexistent', supabase);
    expect(refs).toHaveLength(0);
  });

  it('generates comparison queries for up to 3 competitors', async () => {
    const supabase = makeMockSupabase({
      locations: { data: MOCK_LOCATION, error: null },
      competitors: {
        data: [
          { competitor_name: 'Cloud 9' },
          { competitor_name: 'Sahara Lounge' },
          { competitor_name: 'Hookah Hub' },
          { competitor_name: 'Fourth Place' }, // should be capped at 3
        ],
        error: null,
      },
    });

    const refs = await buildReferenceLibrary('loc-001', supabase);
    const compRefs = refs.filter((r) => r.queryCategory === 'comparison');

    // comparisonQueries() slices to first 3 competitors
    expect(compRefs).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: detectQueryGaps
// ---------------------------------------------------------------------------

describe('detectQueryGaps', () => {
  it('finds untracked gaps for missing reference queries', async () => {
    // Location has only 1 of the 4 discovery queries tracked
    const supabase = makeMockSupabase({
      locations: { data: MOCK_LOCATION, error: null },
      competitors: { data: [], error: null },
      target_queries: {
        data: [
          { id: 'tq-1', query_text: 'best hookah lounge in Alpharetta GA', query_category: 'discovery' },
        ],
        error: null,
      },
      competitor_intercepts: { data: [], error: null },
      sov_evaluations: { data: [], error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const untrackedGaps = gaps.filter((g) => g.gapType === 'untracked');

    // Should find all reference queries minus the one already tracked
    expect(untrackedGaps.length).toBeGreaterThan(0);

    // All untracked gaps have proper structure
    for (const gap of untrackedGaps) {
      expect(gap.queryText).toBeTruthy();
      expect(gap.suggestedAction).toContain('Add');
      expect(['high', 'medium', 'low']).toContain(gap.estimatedImpact);
    }
  });

  it('assigns high impact to discovery queries with priority <= 2', async () => {
    const supabase = makeMockSupabase({
      locations: { data: MOCK_LOCATION, error: null },
      competitors: { data: [], error: null },
      target_queries: { data: [], error: null },
      competitor_intercepts: { data: [], error: null },
      sov_evaluations: { data: [], error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const discoveryGaps = gaps.filter(
      (g) => g.gapType === 'untracked' && g.queryCategory === 'discovery',
    );

    // First 2 discovery queries should be high impact
    const highImpact = discoveryGaps.filter((g) => g.estimatedImpact === 'high');
    expect(highImpact.length).toBeGreaterThanOrEqual(2);
  });

  it('finds competitor-discovered gaps from intercepts', async () => {
    // Null location → no reference library → isolates competitor-discovered test
    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
      competitors: { data: [], error: null },
      target_queries: {
        data: [
          { id: 'tq-1', query_text: 'best hookah lounge in Alpharetta GA', query_category: 'discovery' },
        ],
        error: null,
      },
      competitor_intercepts: {
        data: [
          {
            query_asked: 'best late night hookah Alpharetta',
            competitor_name: 'Cloud 9 Lounge',
            winner: 'Cloud 9 Lounge',
          },
        ],
        error: null,
      },
      sov_evaluations: { data: [], error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const competitorGaps = gaps.filter((g) => g.gapType === 'competitor_discovered');

    expect(competitorGaps).toHaveLength(1);
    expect(competitorGaps[0].queryText).toBe('best late night hookah Alpharetta');
    expect(competitorGaps[0].estimatedImpact).toBe('high');
    expect(competitorGaps[0].suggestedAction).toContain('Cloud 9 Lounge');
  });

  it('does not flag competitor intercepts for already-tracked queries', async () => {
    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
      competitors: { data: [], error: null },
      target_queries: {
        data: [
          { id: 'tq-1', query_text: 'best late night hookah Alpharetta', query_category: 'custom' },
        ],
        error: null,
      },
      competitor_intercepts: {
        data: [
          {
            query_asked: 'best late night hookah Alpharetta',
            competitor_name: 'Cloud 9 Lounge',
            winner: 'Cloud 9 Lounge',
          },
        ],
        error: null,
      },
      sov_evaluations: { data: [], error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const competitorGaps = gaps.filter((g) => g.gapType === 'competitor_discovered');

    expect(competitorGaps).toHaveLength(0);
  });

  it('finds zero-citation cluster when 3+ queries have 0 citations after 2+ runs', async () => {
    const queries = [
      { id: 'tq-1', query_text: 'hookah lounge near me Alpharetta', query_category: 'near_me' },
      { id: 'tq-2', query_text: 'hookah lounge open now Alpharetta', query_category: 'near_me' },
      { id: 'tq-3', query_text: 'best hookah near me', query_category: 'near_me' },
    ];

    // Each query has been run 2+ times but never cited (rank_position: null)
    const evaluations = [
      { query_id: 'tq-1', rank_position: null },
      { query_id: 'tq-1', rank_position: null },
      { query_id: 'tq-2', rank_position: null },
      { query_id: 'tq-2', rank_position: null },
      { query_id: 'tq-3', rank_position: null },
      { query_id: 'tq-3', rank_position: null },
    ];

    // Use null location so buildReferenceLibrary returns [] — isolates cluster test
    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
      competitors: { data: [], error: null },
      target_queries: { data: queries, error: null },
      competitor_intercepts: { data: [], error: null },
      sov_evaluations: { data: evaluations, error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const clusterGaps = gaps.filter((g) => g.gapType === 'zero_citation_cluster');

    expect(clusterGaps).toHaveLength(1);
    expect(clusterGaps[0].estimatedImpact).toBe('high');
    expect(clusterGaps[0].suggestedAction).toContain('content gap');
  });

  it('does not flag zero-citation cluster with fewer than 3 qualifying queries', async () => {
    const queries = [
      { id: 'tq-1', query_text: 'query A', query_category: 'near_me' },
      { id: 'tq-2', query_text: 'query B', query_category: 'near_me' },
    ];

    const evaluations = [
      { query_id: 'tq-1', rank_position: null },
      { query_id: 'tq-1', rank_position: null },
      { query_id: 'tq-2', rank_position: null },
      { query_id: 'tq-2', rank_position: null },
    ];

    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
      competitors: { data: [], error: null },
      target_queries: { data: queries, error: null },
      competitor_intercepts: { data: [], error: null },
      sov_evaluations: { data: evaluations, error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const clusterGaps = gaps.filter((g) => g.gapType === 'zero_citation_cluster');

    expect(clusterGaps).toHaveLength(0);
  });

  it('excludes queries with < 2 evaluations from zero-citation cluster', async () => {
    const queries = [
      { id: 'tq-1', query_text: 'query A', query_category: 'near_me' },
      { id: 'tq-2', query_text: 'query B', query_category: 'near_me' },
      { id: 'tq-3', query_text: 'query C', query_category: 'near_me' },
    ];

    // tq-3 only has 1 evaluation — should not qualify
    const evaluations = [
      { query_id: 'tq-1', rank_position: null },
      { query_id: 'tq-1', rank_position: null },
      { query_id: 'tq-2', rank_position: null },
      { query_id: 'tq-2', rank_position: null },
      { query_id: 'tq-3', rank_position: null }, // only 1 run
    ];

    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
      competitors: { data: [], error: null },
      target_queries: { data: queries, error: null },
      competitor_intercepts: { data: [], error: null },
      sov_evaluations: { data: evaluations, error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const clusterGaps = gaps.filter((g) => g.gapType === 'zero_citation_cluster');

    // Only 2 queries qualify (tq-1, tq-2) — below threshold of 3
    expect(clusterGaps).toHaveLength(0);
  });

  it('caps gaps at 10 per run', async () => {
    // Create a location with 0 tracked queries and no competitors
    // This will generate 4 discovery + 3 near_me + 5 occasion = 12 untracked gaps
    const supabase = makeMockSupabase({
      locations: { data: MOCK_LOCATION, error: null },
      competitors: { data: [], error: null },
      target_queries: { data: [], error: null },
      competitor_intercepts: { data: [], error: null },
      sov_evaluations: { data: [], error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);

    expect(gaps.length).toBeLessThanOrEqual(10);
  });

  it('deduplicates competitor-discovered gaps with same query text', async () => {
    // Null location → no reference library → no untracked gaps filling the cap
    const supabase = makeMockSupabase({
      locations: { data: null, error: null },
      competitors: { data: [], error: null },
      target_queries: { data: [], error: null },
      competitor_intercepts: {
        data: [
          { query_asked: 'hookah near me', competitor_name: 'Cloud 9', winner: 'Cloud 9' },
          { query_asked: 'hookah near me', competitor_name: 'Sahara', winner: 'Sahara' },
        ],
        error: null,
      },
      sov_evaluations: { data: [], error: null },
    });

    const gaps = await detectQueryGaps('org-001', 'loc-001', supabase);
    const competitorGaps = gaps.filter((g) => g.gapType === 'competitor_discovered');

    // Should be deduplicated to 1
    expect(competitorGaps).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: computeCategoryBreakdown
// ---------------------------------------------------------------------------

describe('computeCategoryBreakdown', () => {
  it('computes citation rate per category', () => {
    const queries = [
      { id: 'q1', query_category: 'discovery' },
      { id: 'q2', query_category: 'discovery' },
      { id: 'q3', query_category: 'near_me' },
      { id: 'q4', query_category: 'occasion' },
    ];

    const evaluations = [
      { query_id: 'q1', rank_position: 1, created_at: '2026-02-20T00:00:00Z' },
      { query_id: 'q2', rank_position: null, created_at: '2026-02-20T00:00:00Z' },
      { query_id: 'q3', rank_position: 2, created_at: '2026-02-20T00:00:00Z' },
      { query_id: 'q4', rank_position: null, created_at: '2026-02-20T00:00:00Z' },
    ];

    const breakdown = computeCategoryBreakdown(queries, evaluations);

    expect(breakdown.discovery.citedCount).toBe(1);
    expect(breakdown.discovery.totalCount).toBe(2);
    expect(breakdown.discovery.citationRate).toBe(50);

    expect(breakdown.near_me.citedCount).toBe(1);
    expect(breakdown.near_me.totalCount).toBe(1);
    expect(breakdown.near_me.citationRate).toBe(100);

    expect(breakdown.occasion.citedCount).toBe(0);
    expect(breakdown.occasion.totalCount).toBe(1);
    expect(breakdown.occasion.citationRate).toBe(0);

    expect(breakdown.comparison.totalCount).toBe(0);
    expect(breakdown.comparison.citationRate).toBe(0);

    expect(breakdown.custom.totalCount).toBe(0);
    expect(breakdown.custom.citationRate).toBe(0);
  });

  it('uses latest evaluation per query for citation status', () => {
    const queries = [{ id: 'q1', query_category: 'discovery' }];

    const evaluations = [
      { query_id: 'q1', rank_position: null, created_at: '2026-02-18T00:00:00Z' },
      { query_id: 'q1', rank_position: 1, created_at: '2026-02-20T00:00:00Z' }, // latest — cited
    ];

    const breakdown = computeCategoryBreakdown(queries, evaluations);
    expect(breakdown.discovery.citedCount).toBe(1);
  });

  it('handles empty inputs', () => {
    const breakdown = computeCategoryBreakdown([], []);

    expect(breakdown.discovery.totalCount).toBe(0);
    expect(breakdown.discovery.citationRate).toBe(0);
    expect(breakdown.near_me.totalCount).toBe(0);
    expect(breakdown.occasion.totalCount).toBe(0);
    expect(breakdown.comparison.totalCount).toBe(0);
    expect(breakdown.custom.totalCount).toBe(0);
  });
});
