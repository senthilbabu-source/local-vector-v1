import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { detectCompetitorGapTriggers } from '@/lib/autopilot/triggers/competitor-gap-trigger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-uuid-001';
const LOCATION_ID = 'loc-uuid-001';
const BUSINESS_NAME = 'Test Business';

// ---------------------------------------------------------------------------
// Mock Supabase Factory
// ---------------------------------------------------------------------------

function makeMockSupabase(opts: { data?: unknown[] | null; error?: unknown } = {}) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: opts.data ?? null,
      error: opts.error ?? null,
    }),
  };
  return {
    client: {
      from: vi.fn(() => mockChain),
    } as unknown as SupabaseClient<Database>,
    chain: mockChain,
  };
}

// ---------------------------------------------------------------------------
// Intercept Row Factory
// ---------------------------------------------------------------------------

function makeIntercept(overrides: Record<string, unknown> = {}) {
  return {
    id: 'intercept-uuid-001',
    query_asked: 'best pizza near me',
    competitor_name: 'Rival Pizza Co',
    winning_factor: 'More Google reviews',
    suggested_action: 'Add more reviews',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectCompetitorGapTriggers', () => {
  it('returns empty array when no intercepts found', async () => {
    const { client } = makeMockSupabase({ data: [] });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toEqual([]);
  });

  it('returns empty array on database error', async () => {
    const { client } = makeMockSupabase({
      data: null,
      error: { message: 'DB connection failed', code: '500' },
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toEqual([]);
  });

  it('returns triggers for high-magnitude intercepts', async () => {
    const intercept = makeIntercept();
    const { client } = makeMockSupabase({ data: [intercept] });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].triggerType).toBe('competitor_gap');
  });

  it('deduplicates by query_asked (case-insensitive)', async () => {
    const { client } = makeMockSupabase({
      data: [
        makeIntercept({ id: 'id-1', query_asked: 'Best Pizza Near Me' }),
        makeIntercept({ id: 'id-2', query_asked: 'best pizza near me' }),
        makeIntercept({ id: 'id-3', query_asked: 'BEST PIZZA NEAR ME' }),
      ],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('id-1');
  });

  it('keeps only the first (most recent) for duplicate queries', async () => {
    const { client } = makeMockSupabase({
      data: [
        makeIntercept({ id: 'recent-id', query_asked: 'top sushi downtown' }),
        makeIntercept({ id: 'older-id', query_asked: 'top sushi downtown' }),
      ],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('recent-id');
  });

  it('filters out rows with empty/null query_asked', async () => {
    const { client } = makeMockSupabase({
      data: [
        makeIntercept({ id: 'id-null', query_asked: null }),
        makeIntercept({ id: 'id-empty', query_asked: '' }),
        makeIntercept({ id: 'id-valid', query_asked: 'valid query' }),
      ],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('id-valid');
  });

  it('maps intercept fields to DraftTrigger context correctly', async () => {
    const intercept = makeIntercept({
      id: 'ctx-id',
      query_asked: 'best brunch spot',
      competitor_name: 'Sunrise Cafe',
      winning_factor: 'Outdoor seating',
    });
    const { client } = makeMockSupabase({ data: [intercept] });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result[0].context).toEqual({
      targetQuery: 'best brunch spot',
      competitorName: 'Sunrise Cafe',
      winningFactor: 'Outdoor seating',
    });
  });

  it('sets triggerType to competitor_gap', async () => {
    const { client } = makeMockSupabase({
      data: [makeIntercept(), makeIntercept({ id: 'id-2', query_asked: 'another query' })],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    for (const trigger of result) {
      expect(trigger.triggerType).toBe('competitor_gap');
    }
  });

  it('uses intercept id as triggerId', async () => {
    const { client } = makeMockSupabase({
      data: [makeIntercept({ id: 'my-specific-uuid' })],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result[0].triggerId).toBe('my-specific-uuid');
  });

  it('passes orgId and locationId through', async () => {
    const { client } = makeMockSupabase({ data: [makeIntercept()] });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result[0].orgId).toBe(ORG_ID);
    expect(result[0].locationId).toBe(LOCATION_ID);
  });

  it('limits to 10 intercepts via the query chain', async () => {
    const { client, chain } = makeMockSupabase({ data: [makeIntercept()] });

    await detectCompetitorGapTriggers(client, LOCATION_ID, ORG_ID, BUSINESS_NAME);

    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('returns empty array when intercepts is null', async () => {
    const { client } = makeMockSupabase({ data: null });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toEqual([]);
  });

  it('handles intercepts with null competitor_name', async () => {
    const { client } = makeMockSupabase({
      data: [makeIntercept({ competitor_name: null })],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].context.competitorName).toBeUndefined();
  });

  it('handles intercepts with null winning_factor', async () => {
    const { client } = makeMockSupabase({
      data: [makeIntercept({ winning_factor: null })],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].context.winningFactor).toBeUndefined();
  });

  it('trims whitespace on query_asked for dedup', async () => {
    const { client } = makeMockSupabase({
      data: [
        makeIntercept({ id: 'id-trimmed', query_asked: '  best tacos  ' }),
        makeIntercept({ id: 'id-dup', query_asked: 'best tacos' }),
      ],
    });

    const result = await detectCompetitorGapTriggers(
      client,
      LOCATION_ID,
      ORG_ID,
      BUSINESS_NAME,
    );

    expect(result).toHaveLength(1);
    expect(result[0].triggerId).toBe('id-trimmed');
  });
});
