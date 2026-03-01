/**
 * Unit tests for lib/autopilot/triggers/prompt-missing-trigger.ts
 *
 * Covers: detectPromptMissingTriggers — zero-citation query cluster detection,
 * category grouping, MIN_CLUSTER_SIZE / MAX_QUERIES_PER_CLUSTER enforcement,
 * error handling for both Supabase table calls.
 *
 * 15 test cases.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { detectPromptMissingTriggers } from '@/lib/autopilot/triggers/prompt-missing-trigger';

// ── Constants ────────────────────────────────────────────────────────────────

const ORG_ID = 'org-uuid-001';
const LOCATION_ID = 'loc-uuid-001';

// ── Mock Supabase Factory ────────────────────────────────────────────────────

function makeMockSupabase(
  opts: {
    queries?: unknown[];
    queriesError?: unknown;
    citedEvals?: unknown[];
    evalsError?: unknown;
  } = {},
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'target_queries') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: opts.queries ?? null,
                  error: opts.queriesError ?? null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'sov_evaluations') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({
                data: opts.citedEvals ?? null,
                error: opts.evalsError ?? null,
              }),
            }),
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient<Database>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQuery(
  id: string,
  text: string,
  category: string | null = 'menu',
) {
  return { id, query_text: text, query_category: category };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('detectPromptMissingTriggers', () => {
  // 1
  it('returns empty when no target queries found', async () => {
    const sb = makeMockSupabase({ queries: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 2
  it('returns empty on target_queries DB error', async () => {
    const sb = makeMockSupabase({
      queriesError: { message: 'connection refused', code: '500' },
    });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 3
  it('returns empty on sov_evaluations DB error', async () => {
    const queries = [
      makeQuery('q1', 'best tacos near me'),
      makeQuery('q2', 'taco tuesday deals'),
    ];
    const sb = makeMockSupabase({
      queries,
      evalsError: { message: 'table not found', code: '404' },
    });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 4
  it('returns empty when all queries have citations', async () => {
    const queries = [
      makeQuery('q1', 'best tacos near me'),
      makeQuery('q2', 'taco tuesday deals'),
    ];
    const citedEvals = [{ query_id: 'q1' }, { query_id: 'q2' }];
    const sb = makeMockSupabase({ queries, citedEvals });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 5
  it('returns empty when zero-citation count < MIN_CLUSTER_SIZE (1 query only)', async () => {
    const queries = [
      makeQuery('q1', 'best tacos near me'),
      makeQuery('q2', 'taco tuesday deals'),
    ];
    // q1 is cited, leaving only q2 uncited — below MIN_CLUSTER_SIZE of 2
    const citedEvals = [{ query_id: 'q1' }];
    const sb = makeMockSupabase({ queries, citedEvals });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });

  // 6
  it('returns trigger when 2+ queries in same category have zero citations', async () => {
    const queries = [
      makeQuery('q1', 'best tacos near me', 'menu'),
      makeQuery('q2', 'taco tuesday deals', 'menu'),
    ];
    // No citations at all
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].context.zeroCitationQueries).toEqual([
      'best tacos near me',
      'taco tuesday deals',
    ]);
  });

  // 7
  it('groups queries by query_category', async () => {
    const queries = [
      makeQuery('q1', 'best tacos', 'menu'),
      makeQuery('q2', 'taco tuesday', 'menu'),
      makeQuery('q3', 'happy hour times', 'hours'),
      makeQuery('q4', 'late night hours', 'hours'),
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(2);

    const categories = result.map(
      (t) => t.context.zeroCitationQueries?.[0],
    );
    // Each cluster's first query text should come from a different category
    expect(categories).toContain('best tacos');
    expect(categories).toContain('happy hour times');
  });

  // 8
  it("uses 'uncategorized' for null query_category", async () => {
    const queries = [
      makeQuery('q1', 'question one', null),
      makeQuery('q2', 'question two', null),
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    // Both null-category queries should be grouped together
    expect(result[0].context.zeroCitationQueries).toEqual([
      'question one',
      'question two',
    ]);
  });

  // 9
  it('limits queries per cluster to MAX_QUERIES_PER_CLUSTER (5)', async () => {
    const queries = Array.from({ length: 8 }, (_, i) =>
      makeQuery(`q${i}`, `query text ${i}`, 'big-cluster'),
    );
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].context.zeroCitationQueries).toHaveLength(5);
    // Should be the first 5 query texts
    expect(result[0].context.zeroCitationQueries).toEqual([
      'query text 0',
      'query text 1',
      'query text 2',
      'query text 3',
      'query text 4',
    ]);
  });

  // 10
  it('returns multiple triggers for multiple zero-citation clusters', async () => {
    const queries = [
      makeQuery('q1', 'pasta recipes', 'menu'),
      makeQuery('q2', 'pasta specials', 'menu'),
      makeQuery('q3', 'opening hours', 'hours'),
      makeQuery('q4', 'weekend hours', 'hours'),
      makeQuery('q5', 'parking info', 'amenities'),
      makeQuery('q6', 'outdoor seating', 'amenities'),
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(3);

    const triggerTypes = result.map((t) => t.triggerType);
    expect(triggerTypes).toEqual([
      'prompt_missing',
      'prompt_missing',
      'prompt_missing',
    ]);
  });

  // 11
  it("sets triggerType to 'prompt_missing'", async () => {
    const queries = [
      makeQuery('q1', 'best tacos', 'menu'),
      makeQuery('q2', 'taco tuesday', 'menu'),
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].triggerType).toBe('prompt_missing');
  });

  // 12
  it('uses first query ID as triggerId', async () => {
    const queries = [
      makeQuery('first-query-id', 'best tacos', 'menu'),
      makeQuery('second-query-id', 'taco tuesday', 'menu'),
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('first-query-id');
  });

  // 13
  it('sets consecutiveZeroWeeks to 2', async () => {
    const queries = [
      makeQuery('q1', 'best tacos', 'menu'),
      makeQuery('q2', 'taco tuesday', 'menu'),
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].context.consecutiveZeroWeeks).toBe(2);
  });

  // 14
  it('filters out categories with fewer than MIN_CLUSTER_SIZE queries', async () => {
    const queries = [
      makeQuery('q1', 'best tacos', 'menu'),
      makeQuery('q2', 'taco tuesday', 'menu'),
      makeQuery('q3', 'lone wolf query', 'solo-cat'), // only 1 in this category
    ];
    const sb = makeMockSupabase({ queries, citedEvals: [] });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toHaveLength(1);
    expect(result[0].context.zeroCitationQueries).toEqual([
      'best tacos',
      'taco tuesday',
    ]);
  });

  // 15
  it('returns empty when queries is null', async () => {
    const sb = makeMockSupabase({ queries: undefined });
    const result = await detectPromptMissingTriggers(sb, LOCATION_ID, ORG_ID);
    expect(result).toEqual([]);
  });
});
