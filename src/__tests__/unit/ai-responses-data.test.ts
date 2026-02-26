// ---------------------------------------------------------------------------
// ai-responses-data.test.ts — Sprint 69: "AI Says" Response Library data layer
//
// Tests for fetchAIResponses() and parseDisplayText().
//
// Run: npx vitest run src/__tests__/unit/ai-responses-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_SOV_RESPONSE } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers — mock Supabase client builder
// ---------------------------------------------------------------------------

const ORG_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function mockQuery(data: unknown[] | null, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({ data, error }),
  };
}

function mockQueryNoLimit(data: unknown[] | null, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue({ data, error }),
    limit: vi.fn().mockReturnValue({ data, error }),
  };
}

function createMockSupabase(
  queries: { id: string; query_text: string; query_category: string }[],
  evals: {
    query_id: string;
    engine: string;
    rank_position: number | null;
    raw_response: string | null;
    mentioned_competitors: string[];
    created_at: string;
  }[],
) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue({ data: queries, error: null }),
  };

  const evalChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({ data: evals, error: null }),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'target_queries') return queryChain;
      if (table === 'sov_evaluations') return evalChain;
      return queryChain;
    }),
  } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// Import after type setup
// ---------------------------------------------------------------------------

import { fetchAIResponses, parseDisplayText } from '@/lib/data/ai-responses';

// ---------------------------------------------------------------------------
// parseDisplayText tests
// ---------------------------------------------------------------------------

describe('parseDisplayText', () => {
  it('returns plain text as-is', () => {
    const text = 'Here are some of the best BBQ restaurants in Alpharetta.';
    expect(parseDisplayText(text)).toBe(text);
  });

  it('returns null for null input', () => {
    expect(parseDisplayText(null)).toBeNull();
  });

  it('returns null for JSON { businesses: [...] } format', () => {
    const json = JSON.stringify({
      businesses: ['Dreamland BBQ', 'Charcoal N Chill'],
      cited_url: 'https://example.com',
    });
    expect(parseDisplayText(json)).toBeNull();
  });

  it('returns parsed string if JSON is a plain string', () => {
    const json = JSON.stringify('A simple AI response text');
    expect(parseDisplayText(json)).toBe('A simple AI response text');
  });

  it('returns null for JSON object without businesses key', () => {
    const json = JSON.stringify({ foo: 'bar' });
    expect(parseDisplayText(json)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchAIResponses tests
// ---------------------------------------------------------------------------

describe('fetchAIResponses', () => {
  it('returns entries grouped by query with engine responses', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'Best BBQ in Alpharetta', query_category: 'discovery' }],
      [
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 2,
          raw_response: 'Some AI text about BBQ',
          mentioned_competitors: ['Dreamland BBQ'],
          created_at: '2026-02-26T12:00:00Z',
        },
        {
          query_id: 'q1',
          engine: 'perplexity',
          rank_position: 1,
          raw_response: 'Perplexity says great BBQ',
          mentioned_competitors: [],
          created_at: '2026-02-26T12:05:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result).toHaveLength(1);
    expect(result[0].queryText).toBe('Best BBQ in Alpharetta');
    expect(result[0].engines).toHaveLength(2);
    expect(result[0].engines[0].engine).toBe('openai');
    expect(result[0].engines[1].engine).toBe('perplexity');
  });

  it('keeps only latest eval per (query, engine) pair', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'Best hookah bar', query_category: 'discovery' }],
      [
        // Newest first (ordered by created_at DESC)
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 1,
          raw_response: 'Latest response',
          mentioned_competitors: [],
          created_at: '2026-02-26T14:00:00Z',
        },
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 3,
          raw_response: 'Older response',
          mentioned_competitors: [],
          created_at: '2026-02-26T10:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result).toHaveLength(1);
    expect(result[0].engines).toHaveLength(1);
    expect(result[0].engines[0].rawResponse).toBe('Latest response');
    expect(result[0].engines[0].rankPosition).toBe(1);
  });

  it('includes raw_response text in engine responses', async () => {
    const rawText = MOCK_SOV_RESPONSE.engines[0].rawResponse;
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'Best BBQ', query_category: 'discovery' }],
      [
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 2,
          raw_response: rawText,
          mentioned_competitors: [],
          created_at: '2026-02-26T12:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result[0].engines[0].rawResponse).toBe(rawText);
  });

  it('handles null raw_response gracefully', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'Some query', query_category: 'comparison' }],
      [
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: null,
          raw_response: null,
          mentioned_competitors: [],
          created_at: '2026-02-26T12:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result).toHaveLength(1);
    expect(result[0].engines[0].rawResponse).toBeNull();
    expect(result[0].engines[0].rankPosition).toBeNull();
  });

  it('skips queries with no evaluations', async () => {
    const supabase = createMockSupabase(
      [
        { id: 'q1', query_text: 'Query with evals', query_category: 'discovery' },
        { id: 'q2', query_text: 'Query without evals', query_category: 'near_me' },
      ],
      [
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 2,
          raw_response: 'Some text',
          mentioned_competitors: [],
          created_at: '2026-02-26T12:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result).toHaveLength(1);
    expect(result[0].queryText).toBe('Query with evals');
  });

  it('returns empty array when no target_queries exist', async () => {
    const supabase = createMockSupabase([], []);

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result).toEqual([]);
  });

  it('returns empty array when no sov_evaluations exist', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'Some query', query_category: 'discovery' }],
      [],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result).toEqual([]);
  });

  it('sets latestDate to most recent eval timestamp across engines', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'BBQ query', query_category: 'discovery' }],
      [
        {
          query_id: 'q1',
          engine: 'perplexity',
          rank_position: 1,
          raw_response: 'Response B',
          mentioned_competitors: [],
          created_at: '2026-02-26T14:00:00Z',
        },
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 2,
          raw_response: 'Response A',
          mentioned_competitors: [],
          created_at: '2026-02-26T12:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result[0].latestDate).toBe('2026-02-26T14:00:00Z');
  });

  it('preserves query_category in output', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'Hookah near me', query_category: 'near_me' }],
      [
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 1,
          raw_response: 'Text',
          mentioned_competitors: [],
          created_at: '2026-02-26T12:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result[0].queryCategory).toBe('near_me');
  });

  it('deduplicates engines correctly when multiple evals exist for same (query, engine)', async () => {
    const supabase = createMockSupabase(
      [{ id: 'q1', query_text: 'BBQ query', query_category: 'discovery' }],
      [
        // Newest first
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 1,
          raw_response: 'Newest',
          mentioned_competitors: ['A'],
          created_at: '2026-02-26T16:00:00Z',
        },
        {
          query_id: 'q1',
          engine: 'perplexity',
          rank_position: 2,
          raw_response: 'PX latest',
          mentioned_competitors: [],
          created_at: '2026-02-26T15:00:00Z',
        },
        {
          query_id: 'q1',
          engine: 'openai',
          rank_position: 3,
          raw_response: 'Older',
          mentioned_competitors: ['B'],
          created_at: '2026-02-26T10:00:00Z',
        },
        {
          query_id: 'q1',
          engine: 'perplexity',
          rank_position: null,
          raw_response: null,
          mentioned_competitors: [],
          created_at: '2026-02-26T09:00:00Z',
        },
      ],
    );

    const result = await fetchAIResponses(ORG_ID, supabase);

    expect(result[0].engines).toHaveLength(2);
    const openai = result[0].engines.find((e) => e.engine === 'openai')!;
    const perplexity = result[0].engines.find((e) => e.engine === 'perplexity')!;
    expect(openai.rawResponse).toBe('Newest');
    expect(openai.mentionedCompetitors).toEqual(['A']);
    expect(perplexity.rawResponse).toBe('PX latest');
  });
});
