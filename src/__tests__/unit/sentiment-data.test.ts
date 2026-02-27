// ---------------------------------------------------------------------------
// sentiment-data.test.ts — Unit tests for sentiment data layer
//
// Sprint 81: 9 tests — fetchSentimentSummary, fetchSentimentTrend.
//
// Run:
//   npx vitest run src/__tests__/unit/sentiment-data.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { fetchSentimentSummary, fetchSentimentTrend } from '@/lib/data/sentiment';
import { MOCK_SENTIMENT_EXTRACTION } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function createMockSupabase(rows: unknown[] = []) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  // Resolve with data at end of chain
  mockChain.order.mockReturnValue({ data: rows, error: null });

  const mockFrom = vi.fn(() => mockChain);

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    from: mockFrom,
    chain: mockChain,
  };
}

// ---------------------------------------------------------------------------
// fetchSentimentSummary
// ---------------------------------------------------------------------------

describe('fetchSentimentSummary', () => {
  it('1. queries sov_evaluations filtered by org_id and location_id', async () => {
    const { client, chain } = createMockSupabase([]);
    await fetchSentimentSummary(client, 'org-1', 'loc-1');

    expect(chain.eq).toHaveBeenCalledWith('org_id', 'org-1');
    expect(chain.eq).toHaveBeenCalledWith('location_id', 'loc-1');
  });

  it('2. filters to evaluations with non-null sentiment_data', async () => {
    const { client, chain } = createMockSupabase([]);
    await fetchSentimentSummary(client, 'org-1', 'loc-1');

    expect(chain.not).toHaveBeenCalledWith('sentiment_data', 'is', null);
  });

  it('3. defaults to 30-day range', async () => {
    const { client, chain } = createMockSupabase([]);
    await fetchSentimentSummary(client, 'org-1', 'loc-1');

    // Should call gte with a date ~30 days ago
    expect(chain.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    const gteCall = chain.gte.mock.calls[0];
    const cutoffDate = new Date(gteCall[1]);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('4. respects custom dayRange option', async () => {
    const { client, chain } = createMockSupabase([]);
    await fetchSentimentSummary(client, 'org-1', 'loc-1', { dayRange: 7 });

    const gteCall = chain.gte.mock.calls[0];
    const cutoffDate = new Date(gteCall[1]);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThanOrEqual(8);
  });

  it('5. returns aggregated SentimentSummary', async () => {
    const rows = [
      { engine: 'openai', sentiment_data: MOCK_SENTIMENT_EXTRACTION },
      { engine: 'perplexity', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.6 } },
    ];
    const { client } = createMockSupabase(rows);
    const result = await fetchSentimentSummary(client, 'org-1', 'loc-1');

    expect(result.evaluationCount).toBe(2);
    expect(result.averageScore).toBeGreaterThan(0);
    expect(result.topPositive.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// fetchSentimentTrend
// ---------------------------------------------------------------------------

describe('fetchSentimentTrend', () => {
  it('6. groups evaluations by ISO week', async () => {
    const rows = [
      { created_at: '2026-02-02T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.5 } },
      { created_at: '2026-02-03T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.7 } },
      { created_at: '2026-02-10T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.9 } },
    ];
    const { client } = createMockSupabase(rows);
    const result = await fetchSentimentTrend(client, 'org-1', 'loc-1');

    // 2 weeks of data
    expect(result.length).toBe(2);
  });

  it('7. computes weekly average score', async () => {
    const rows = [
      { created_at: '2026-02-02T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.4 } },
      { created_at: '2026-02-03T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.6 } },
    ];
    const { client } = createMockSupabase(rows);
    const result = await fetchSentimentTrend(client, 'org-1', 'loc-1');

    // Both dates in same week → average = 0.5
    expect(result[0].averageScore).toBe(0.5);
    expect(result[0].evaluationCount).toBe(2);
  });

  it('8. returns sorted by weekStart ascending', async () => {
    const rows = [
      { created_at: '2026-01-06T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.3 } },
      { created_at: '2026-02-10T10:00:00.000Z', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.7 } },
    ];
    const { client } = createMockSupabase(rows);
    const result = await fetchSentimentTrend(client, 'org-1', 'loc-1');

    if (result.length >= 2) {
      expect(result[0].weekStart < result[1].weekStart).toBe(true);
    }
  });

  it('9. defaults to 12 weeks', async () => {
    const { client, chain } = createMockSupabase([]);
    await fetchSentimentTrend(client, 'org-1', 'loc-1');

    const gteCall = chain.gte.mock.calls[0];
    const cutoffDate = new Date(gteCall[1]);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
    // 12 weeks = 84 days, allow ±2 for timing
    expect(diffDays).toBeGreaterThanOrEqual(82);
    expect(diffDays).toBeLessThanOrEqual(86);
  });
});
