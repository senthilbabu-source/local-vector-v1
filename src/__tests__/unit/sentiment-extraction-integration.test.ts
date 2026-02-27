// ---------------------------------------------------------------------------
// sentiment-extraction-integration.test.ts — Pipeline integration tests
//
// Sprint 81: 7 tests — extractSOVSentiment + writeSentimentData.
//
// Run:
//   npx vitest run src/__tests__/unit/sentiment-extraction-integration.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { MOCK_SENTIMENT_EXTRACTION } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExtractSentiment = vi.fn();

vi.mock('@/lib/services/sentiment.service', () => ({
  extractSentiment: (...args: unknown[]) => mockExtractSentiment(...args),
}));

// Must import AFTER mocks are set up
const { extractSOVSentiment, writeSentimentData } = await import('@/lib/services/sov-engine.service');

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

function createMockSupabase() {
  const mockUpdate = vi.fn();
  const mockEq = vi.fn().mockReturnValue({
    then: vi.fn((cb: (res: { error: null }) => void) => {
      cb({ error: null });
      return Promise.resolve();
    }),
  });
  mockUpdate.mockReturnValue({ eq: mockEq });

  const mockFrom = vi.fn(() => ({
    update: mockUpdate,
  }));

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    from: mockFrom,
    update: mockUpdate,
    eq: mockEq,
  };
}

// ---------------------------------------------------------------------------
// extractSOVSentiment
// ---------------------------------------------------------------------------

describe('extractSOVSentiment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. runs extractSentiment for each result in parallel', async () => {
    mockExtractSentiment.mockResolvedValue(MOCK_SENTIMENT_EXTRACTION);

    const results = [
      { evaluationId: 'eval-1', rawResponse: 'Charcoal N Chill is great', engine: 'openai' },
      { evaluationId: 'eval-2', rawResponse: 'Charcoal N Chill is popular', engine: 'perplexity' },
    ];

    await extractSOVSentiment(results, 'Charcoal N Chill');

    expect(mockExtractSentiment).toHaveBeenCalledTimes(2);
  });

  it('2. returns Map of evaluationId to SentimentExtraction', async () => {
    mockExtractSentiment.mockResolvedValue(MOCK_SENTIMENT_EXTRACTION);

    const results = [
      { evaluationId: 'eval-1', rawResponse: 'Charcoal N Chill is great', engine: 'openai' },
    ];

    const map = await extractSOVSentiment(results, 'Charcoal N Chill');

    expect(map.get('eval-1')).toEqual(MOCK_SENTIMENT_EXTRACTION);
  });

  it('3. handles individual extraction failures gracefully', async () => {
    mockExtractSentiment
      .mockResolvedValueOnce(MOCK_SENTIMENT_EXTRACTION)
      .mockRejectedValueOnce(new Error('API error'));

    const results = [
      { evaluationId: 'eval-1', rawResponse: 'Charcoal N Chill is great', engine: 'openai' },
      { evaluationId: 'eval-2', rawResponse: 'Charcoal N Chill is popular', engine: 'perplexity' },
    ];

    const map = await extractSOVSentiment(results, 'Charcoal N Chill');

    expect(map.get('eval-1')).toEqual(MOCK_SENTIMENT_EXTRACTION);
    expect(map.has('eval-2')).toBe(false);
  });

  it('4. skips results with null rawResponse', async () => {
    mockExtractSentiment.mockResolvedValue(null);

    const results = [
      { evaluationId: 'eval-1', rawResponse: null, engine: 'openai' },
    ];

    const map = await extractSOVSentiment(results, 'Charcoal N Chill');

    expect(mockExtractSentiment).toHaveBeenCalledWith(null, 'Charcoal N Chill');
    expect(map.get('eval-1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// writeSentimentData
// ---------------------------------------------------------------------------

describe('writeSentimentData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('5. updates sov_evaluations.sentiment_data for each entry', async () => {
    const { client, from, update } = createMockSupabase();

    const sentimentMap = new Map([
      ['eval-1', MOCK_SENTIMENT_EXTRACTION],
    ]);

    await writeSentimentData(client, sentimentMap);

    expect(from).toHaveBeenCalledWith('sov_evaluations');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ sentiment_data: expect.any(Object) }),
    );
  });

  it('6. skips null sentiment entries', async () => {
    const { client, update } = createMockSupabase();

    const sentimentMap = new Map<string, typeof MOCK_SENTIMENT_EXTRACTION | null>([
      ['eval-1', null],
      ['eval-2', MOCK_SENTIMENT_EXTRACTION],
    ]);

    await writeSentimentData(client, sentimentMap);

    // Only eval-2 should trigger an update
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('7. logs errors but does not throw on individual write failures', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mockEq = vi.fn().mockReturnValue({
      then: vi.fn((cb: (res: { error: { message: string } }) => void) => {
        cb({ error: { message: 'DB error' } });
        return Promise.resolve();
      }),
    });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn(() => ({ update: mockUpdate }));
    const client = { from: mockFrom } as unknown as SupabaseClient<Database>;

    const sentimentMap = new Map([
      ['eval-1', MOCK_SENTIMENT_EXTRACTION],
    ]);

    // Should not throw
    await expect(writeSentimentData(client, sentimentMap)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sentiment] Write failed'),
      expect.any(Object),
    );

    consoleSpy.mockRestore();
  });
});
