// ---------------------------------------------------------------------------
// sentiment-service.test.ts — Unit tests for sentiment extraction & aggregation
//
// Sprint 81: 28 tests — extractSentiment, aggregateSentiment, utility functions.
//
// Run:
//   npx vitest run src/__tests__/unit/sentiment-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractSentiment,
  aggregateSentiment,
  countFrequencies,
  dedupeByFrequency,
  groupBy,
  topKey,
  type SentimentSummary,
} from '@/lib/services/sentiment.service';
import type { SentimentExtraction } from '@/lib/ai/schemas';
import { MOCK_SENTIMENT_EXTRACTION } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGenerateObject, mockGetModel, mockHasApiKey } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
  mockGetModel: vi.fn().mockReturnValue('mock-model'),
  mockHasApiKey: vi.fn().mockImplementation((provider: string) => provider === 'openai'),
}));

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: mockGetModel,
  hasApiKey: mockHasApiKey,
}));

vi.mock('@/lib/ai/schemas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/schemas')>();
  return {
    ...actual,
    zodSchema: vi.fn((schema: unknown) => schema),
  };
});

// ---------------------------------------------------------------------------
// extractSentiment
// ---------------------------------------------------------------------------

describe('extractSentiment', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
    mockGetModel.mockReturnValue('mock-model');
    mockHasApiKey.mockImplementation((provider: string) => provider === 'openai');
  });

  it('1. returns null when rawResponse is null', async () => {
    const result = await extractSentiment(null, 'Charcoal N Chill');
    expect(result).toBeNull();
  });

  it('2. returns null when rawResponse is empty string', async () => {
    const result = await extractSentiment('', 'Charcoal N Chill');
    expect(result).toBeNull();
  });

  it('3. returns null when rawResponse is whitespace only', async () => {
    const result = await extractSentiment('   ', 'Charcoal N Chill');
    expect(result).toBeNull();
  });

  it('4. returns null when hasApiKey returns false', async () => {
    mockHasApiKey.mockReturnValue(false);

    const result = await extractSentiment('Some response about Charcoal N Chill', 'Charcoal N Chill');
    expect(result).toBeNull();
  });

  it('5. returns not_mentioned result when business name not in response', async () => {
    const result = await extractSentiment(
      'Some response about Cloud 9 Lounge only',
      'Charcoal N Chill',
    );
    expect(result).toEqual({
      score: 0,
      label: 'neutral',
      descriptors: { positive: [], negative: [], neutral: [] },
      tone: 'matter_of_fact',
      recommendation_strength: 'not_mentioned',
    });
  });

  it('6. calls generateObject with sentiment-extract model key', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_SENTIMENT_EXTRACTION });

    await extractSentiment('Charcoal N Chill is great', 'Charcoal N Chill');

    expect(mockGetModel).toHaveBeenCalledWith('sentiment-extract');
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        prompt: expect.stringContaining('Charcoal N Chill'),
      }),
    );
  });

  it('7. returns SentimentExtraction on happy path', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_SENTIMENT_EXTRACTION });

    const result = await extractSentiment('Charcoal N Chill is popular and premium', 'Charcoal N Chill');
    expect(result).toEqual(MOCK_SENTIMENT_EXTRACTION);
  });

  it('8. returns null when generateObject throws', async () => {
    mockGenerateObject.mockRejectedValue(new Error('API error'));

    const result = await extractSentiment('Charcoal N Chill is popular', 'Charcoal N Chill');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// aggregateSentiment
// ---------------------------------------------------------------------------

const makeSentiment = (overrides: Partial<SentimentExtraction> = {}): SentimentExtraction => ({
  score: 0.7,
  label: 'positive',
  descriptors: { positive: ['popular'], negative: [], neutral: [] },
  tone: 'positive',
  recommendation_strength: 'primary',
  ...overrides,
});

describe('aggregateSentiment', () => {
  describe('Empty input', () => {
    it('9. returns zero/neutral defaults for empty evaluations array', () => {
      const result = aggregateSentiment([]);
      expect(result.averageScore).toBe(0);
      expect(result.dominantLabel).toBe('neutral');
      expect(result.dominantTone).toBe('matter_of_fact');
      expect(result.evaluationCount).toBe(0);
    });

    it('10. returns zero evaluationCount for all-null sentiment_data', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: null },
        { engine: 'perplexity', sentiment_data: null },
      ]);
      expect(result.evaluationCount).toBe(0);
    });
  });

  describe('Score calculation', () => {
    it('11. computes average score across evaluations', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ score: 0.8 }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ score: 0.6 }) },
      ]);
      expect(result.averageScore).toBe(0.7);
    });

    it('12. rounds averageScore to 2 decimal places', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ score: 0.333 }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ score: 0.666 }) },
      ]);
      // (0.333 + 0.666) / 2 = 0.4995 → rounds to 0.5
      expect(result.averageScore).toBe(0.5);
    });
  });

  describe('Dominant label/tone', () => {
    it('13. selects most frequent label as dominantLabel', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ label: 'positive' }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ label: 'positive' }) },
        { engine: 'google', sentiment_data: makeSentiment({ label: 'neutral' }) },
      ]);
      expect(result.dominantLabel).toBe('positive');
    });

    it('14. selects most frequent tone as dominantTone', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ tone: 'enthusiastic' }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ tone: 'enthusiastic' }) },
        { engine: 'google', sentiment_data: makeSentiment({ tone: 'matter_of_fact' }) },
      ]);
      expect(result.dominantTone).toBe('enthusiastic');
    });
  });

  describe('Descriptors', () => {
    it('15. aggregates positive descriptors across all evaluations', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: ['popular'], negative: [], neutral: [] } }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ descriptors: { positive: ['premium'], negative: [], neutral: [] } }) },
      ]);
      expect(result.topPositive).toContain('popular');
      expect(result.topPositive).toContain('premium');
    });

    it('16. aggregates negative descriptors across all evaluations', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: [], negative: ['slow'], neutral: [] } }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ descriptors: { positive: [], negative: ['overpriced'], neutral: [] } }) },
      ]);
      expect(result.topNegative).toContain('slow');
      expect(result.topNegative).toContain('overpriced');
    });

    it('17. deduplicates descriptors (case-insensitive)', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: ['Popular'], negative: [], neutral: [] } }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ descriptors: { positive: ['popular'], negative: [], neutral: [] } }) },
      ]);
      expect(result.topPositive).toHaveLength(1);
      expect(result.topPositive[0]).toBe('popular');
    });

    it('18. sorts descriptors by frequency (most common first)', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: ['rare', 'popular'], negative: [], neutral: [] } }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ descriptors: { positive: ['popular'], negative: [], neutral: [] } }) },
        { engine: 'google', sentiment_data: makeSentiment({ descriptors: { positive: ['popular'], negative: [], neutral: [] } }) },
      ]);
      expect(result.topPositive[0]).toBe('popular');
    });

    it('19. limits topPositive to 15 items', () => {
      const manyDescriptors = Array.from({ length: 20 }, (_, i) => `adj${i}`);
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: manyDescriptors, negative: [], neutral: [] } }) },
      ]);
      expect(result.topPositive).toHaveLength(15);
    });

    it('20. limits topNegative to 15 items', () => {
      const manyDescriptors = Array.from({ length: 20 }, (_, i) => `bad${i}`);
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: [], negative: manyDescriptors, neutral: [] } }) },
      ]);
      expect(result.topNegative).toHaveLength(15);
    });
  });

  describe('Per-engine breakdown', () => {
    it('21. groups evaluations by engine', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ score: 0.8 }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ score: 0.6 }) },
      ]);
      expect(Object.keys(result.byEngine)).toEqual(expect.arrayContaining(['openai', 'perplexity']));
    });

    it('22. computes per-engine average score', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ score: 0.8 }) },
        { engine: 'openai', sentiment_data: makeSentiment({ score: 0.6 }) },
      ]);
      expect(result.byEngine.openai.averageScore).toBe(0.7);
    });

    it('23. computes per-engine dominant label', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ label: 'positive' }) },
        { engine: 'openai', sentiment_data: makeSentiment({ label: 'positive' }) },
        { engine: 'openai', sentiment_data: makeSentiment({ label: 'neutral' }) },
      ]);
      expect(result.byEngine.openai.label).toBe('positive');
    });

    it('24. computes per-engine descriptors (max 10 each)', () => {
      const manyDescriptors = Array.from({ length: 15 }, (_, i) => `desc${i}`);
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ descriptors: { positive: manyDescriptors, negative: [], neutral: [] } }) },
      ]);
      expect(result.byEngine.openai.descriptors.positive).toHaveLength(10);
    });
  });

  describe('Integration', () => {
    it('25. produces valid SentimentSummary from MOCK evaluations', () => {
      const result = aggregateSentiment([
        { engine: 'perplexity', sentiment_data: MOCK_SENTIMENT_EXTRACTION },
        { engine: 'openai', sentiment_data: { ...MOCK_SENTIMENT_EXTRACTION, score: 0.65 } },
      ]);
      expect(result.evaluationCount).toBe(2);
      expect(result.averageScore).toBeGreaterThan(0);
      expect(result.topPositive.length).toBeGreaterThan(0);
    });

    it('26. handles mixed engines with different sentiments', () => {
      const result = aggregateSentiment([
        { engine: 'openai', sentiment_data: makeSentiment({ score: 0.8, label: 'very_positive' }) },
        { engine: 'perplexity', sentiment_data: makeSentiment({ score: -0.5, label: 'negative' }) },
      ]);
      expect(result.averageScore).toBe(0.15);
      expect(result.byEngine.openai.averageScore).toBe(0.8);
      expect(result.byEngine.perplexity.averageScore).toBe(-0.5);
    });
  });
});

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

describe('utility functions', () => {
  it('27. countFrequencies counts occurrences correctly', () => {
    const result = countFrequencies(['a', 'b', 'a', 'c', 'a']);
    expect(result).toEqual({ a: 3, b: 1, c: 1 });
  });

  it('28. dedupeByFrequency preserves order by frequency', () => {
    const result = dedupeByFrequency(['rare', 'Popular', 'popular', 'POPULAR', 'rare']);
    expect(result[0]).toBe('popular'); // 3 occurrences
    expect(result[1]).toBe('rare');    // 2 occurrences
  });

  it('29. groupBy groups items by key function', () => {
    const items = [
      { name: 'a', type: 'x' },
      { name: 'b', type: 'y' },
      { name: 'c', type: 'x' },
    ];
    const result = groupBy(items, i => i.type);
    expect(result.x).toHaveLength(2);
    expect(result.y).toHaveLength(1);
  });

  it('30. topKey returns key with highest count', () => {
    const result = topKey({ a: 1, b: 5, c: 3 });
    expect(result).toBe('b');
  });
});
