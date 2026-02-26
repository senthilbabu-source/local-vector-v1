// ---------------------------------------------------------------------------
// multi-engine-eval-service.test.ts — Unit tests for multi-engine-eval.service
//
// Tests lib/services/multi-engine-eval.service.ts: buildEvalPrompt(),
// callEngine(), runAllEngines().
//
// Strategy:
//   • generateText is mocked at the 'ai' module level — no real API calls.
//   • hasApiKey is mocked to control mock/real code paths.
//   • Each engine path is tested independently.
//
// Run:
//   npx vitest run src/__tests__/unit/multi-engine-eval-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn(),
  jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })),
}));

// ── Mock the providers ──────────────────────────────────────────────────
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(false),
}));

import {
  buildEvalPrompt,
  callEngine,
  runAllEngines,
  type MultiEngineEvalInput,
} from '@/lib/services/multi-engine-eval.service';
import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';

// ── Fixture ────────────────────────────────────────────────────────────────

const LOCATION: MultiEngineEvalInput = {
  business_name: 'Charcoal N Chill',
  address_line1: '123 Main St',
  city: 'Alpharetta',
  state: 'GA',
  zip: '30009',
  phone: '(770) 555-1234',
  website_url: 'https://charcoalnchill.com',
};

// ── buildEvalPrompt ──────────────────────────────────────────────────────

describe('buildEvalPrompt', () => {
  it('includes business name and address in prompt', () => {
    const prompt = buildEvalPrompt(LOCATION);
    expect(prompt).toContain('Charcoal N Chill');
    expect(prompt).toContain('123 Main St');
    expect(prompt).toContain('Alpharetta');
    expect(prompt).toContain('GA');
    expect(prompt).toContain('30009');
  });

  it('includes phone and website when present', () => {
    const prompt = buildEvalPrompt(LOCATION);
    expect(prompt).toContain('(770) 555-1234');
    expect(prompt).toContain('https://charcoalnchill.com');
  });

  it('shows "not listed" for null optional fields', () => {
    const prompt = buildEvalPrompt({
      business_name: 'Test Bistro',
      address_line1: null,
      city: null,
      state: null,
    });
    expect(prompt).toContain('Phone: not listed');
    expect(prompt).toContain('Website: not listed');
  });

  it('returns valid JSON instructions in prompt', () => {
    const prompt = buildEvalPrompt(LOCATION);
    expect(prompt).toContain('accuracy_score');
    expect(prompt).toContain('hallucinations_detected');
    expect(prompt).toContain('response_text');
    expect(prompt).toContain('Return only valid JSON');
  });
});

// ── callEngine — mock fallback (no API key) ──────────────────────────────

describe('callEngine — mock fallback (no API key)', () => {
  beforeEach(() => {
    vi.mocked(hasApiKey).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mock result for openai when key is absent', async () => {
    const result = await callEngine('openai', 'test prompt');
    expect(result.accuracy_score).toBe(80);
    expect(result.response_text).toContain('[MOCK]');
    expect(result.response_text).toContain('openai');
    expect(result.hallucinations_detected).toHaveLength(2);
  });

  it('returns mock result for perplexity when key is absent', async () => {
    const result = await callEngine('perplexity', 'test prompt');
    expect(result.response_text).toContain('perplexity');
    expect(result.hallucinations_detected[0]).toContain('PERPLEXITY_API_KEY');
  });

  it('returns mock result for anthropic when key is absent', async () => {
    const result = await callEngine('anthropic', 'test prompt');
    expect(result.response_text).toContain('anthropic');
    expect(result.hallucinations_detected[0]).toContain('ANTHROPIC_API_KEY');
  });

  it('returns mock result for gemini when key is absent', async () => {
    const result = await callEngine('gemini', 'test prompt');
    expect(result.response_text).toContain('gemini');
    expect(result.hallucinations_detected[0]).toContain('GOOGLE_GENERATIVE_AI_API_KEY');
  });

  it('does not call generateText when key is absent', async () => {
    await callEngine('openai', 'test prompt');
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });
});

// ── callEngine — with API key ────────────────────────────────────────────

describe('callEngine — with API key', () => {
  beforeEach(() => {
    vi.mocked(hasApiKey).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls generateText with the truth-audit model key', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        accuracy_score: 75,
        hallucinations_detected: ['Wrong hours listed'],
        response_text: 'The restaurant is open...',
      }),
    } as never);

    await callEngine('openai', 'test prompt');

    expect(vi.mocked(generateText)).toHaveBeenCalledOnce();
    expect(vi.mocked(generateText)).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mock-model',
        prompt: 'test prompt',
      }),
    );
  });

  it('parses a valid JSON response', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        accuracy_score: 92,
        hallucinations_detected: [],
        response_text: 'This restaurant is great.',
      }),
    } as never);

    const result = await callEngine('openai', 'test prompt');
    expect(result.accuracy_score).toBe(92);
    expect(result.hallucinations_detected).toEqual([]);
    expect(result.response_text).toBe('This restaurant is great.');
  });

  it('extracts JSON from markdown fences', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n{"accuracy_score": 60, "hallucinations_detected": ["Wrong phone"], "response_text": "Info..."}\n```',
    } as never);

    const result = await callEngine('perplexity', 'test prompt');
    expect(result.accuracy_score).toBe(60);
    expect(result.hallucinations_detected).toEqual(['Wrong phone']);
  });

  it('clamps accuracy_score to 0-100 range', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        accuracy_score: 150,
        hallucinations_detected: [],
        response_text: 'test',
      }),
    } as never);

    const result = await callEngine('openai', 'test prompt');
    expect(result.accuracy_score).toBe(100);
  });

  it('falls back to mock on API error', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Rate limit'));

    const result = await callEngine('openai', 'test prompt');
    expect(result.accuracy_score).toBe(80);
    expect(result.response_text).toContain('[MOCK]');
  });
});

// ── runAllEngines ────────────────────────────────────────────────────────

describe('runAllEngines', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns results for all 4 engines when keys are absent (mocks)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const results = await runAllEngines(LOCATION);
    expect(results).toHaveLength(4);

    const engines = results.map((r) => r.engine);
    expect(engines).toContain('openai');
    expect(engines).toContain('perplexity');
    expect(engines).toContain('anthropic');
    expect(engines).toContain('gemini');
  });

  it('returns results for all 4 engines when API succeeds', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        accuracy_score: 85,
        hallucinations_detected: [],
        response_text: 'Looks good.',
      }),
    } as never);

    const results = await runAllEngines(LOCATION);
    expect(results).toHaveLength(4);
    expect(results.every((r) => r.result.accuracy_score === 85)).toBe(true);
  });

  it('still returns results when some engines fail (Promise.allSettled)', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);

    let callCount = 0;
    vi.mocked(generateText).mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        throw new Error('API down');
      }
      return {
        text: JSON.stringify({
          accuracy_score: 90,
          hallucinations_detected: [],
          response_text: 'OK',
        }),
      } as never;
    });

    const results = await runAllEngines(LOCATION);
    // All 4 should still return — the failed ones get mock fallbacks from callEngine
    expect(results).toHaveLength(4);
  });

  it('each result has engine and result fields', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const results = await runAllEngines(LOCATION);
    for (const evaluation of results) {
      expect(evaluation).toHaveProperty('engine');
      expect(evaluation).toHaveProperty('result');
      expect(evaluation.result).toHaveProperty('accuracy_score');
      expect(evaluation.result).toHaveProperty('hallucinations_detected');
      expect(evaluation.result).toHaveProperty('response_text');
    }
  });
});
