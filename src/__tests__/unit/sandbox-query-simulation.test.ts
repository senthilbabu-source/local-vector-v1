import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGenerateText, mockGetModel, mockHasApiKey, mockCaptureException } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetModel: vi.fn().mockReturnValue('mock-model'),
  mockHasApiKey: vi.fn().mockReturnValue(true),
  mockCaptureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));
vi.mock('@/lib/ai/providers', () => ({
  getModel: mockGetModel,
  hasApiKey: mockHasApiKey,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  simulateQueriesAgainstContent,
  selectQueriesForSimulation,
  buildQuerySimSystemPrompt,
  buildQuerySimUserPrompt,
  evaluateSimulatedAnswer,
  detectHallucinatedFacts,
  checkFactsPresent,
} from '@/lib/sandbox/query-simulation-engine';
import { MOCK_SANDBOX_GROUND_TRUTH } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT = 'Charcoal N Chill is a hookah lounge in Alpharetta, GA at 11950 Jones Bridge Road. Call (470) 546-4866.';

function mockSupabase(rows: unknown[] = []) {
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
      }),
    }),
  });
  return { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;
}

// ---------------------------------------------------------------------------
// buildQuerySimSystemPrompt / buildQuerySimUserPrompt
// ---------------------------------------------------------------------------

describe('buildQuerySimSystemPrompt', () => {
  it('instructs AI to use only provided content', () => {
    const prompt = buildQuerySimSystemPrompt();
    expect(prompt).toContain('ONLY');
    expect(prompt).toContain('business');
  });
});

describe('buildQuerySimUserPrompt', () => {
  it('embeds content and query in prompt', () => {
    const prompt = buildQuerySimUserPrompt('My content', 'My question?');
    expect(prompt).toContain('My content');
    expect(prompt).toContain('My question?');
  });
});

// ---------------------------------------------------------------------------
// checkFactsPresent
// ---------------------------------------------------------------------------

describe('checkFactsPresent', () => {
  it('detects name, city, phone in answer', () => {
    const answer = 'Charcoal N Chill is located in Alpharetta. Call (470) 546-4866.';
    const facts = checkFactsPresent(answer, MOCK_SANDBOX_GROUND_TRUTH);
    expect(facts).toContain('name');
    expect(facts).toContain('city');
    expect(facts).toContain('phone');
  });

  it('returns empty when no facts match', () => {
    const facts = checkFactsPresent('No relevant info here.', MOCK_SANDBOX_GROUND_TRUTH);
    expect(facts).toEqual([]);
  });

  it('detects address when present', () => {
    const answer = 'Located at 11950 Jones Bridge Road Ste 103 in Alpharetta.';
    const facts = checkFactsPresent(answer, MOCK_SANDBOX_GROUND_TRUTH);
    expect(facts).toContain('address');
  });

  it('detects website when present', () => {
    const answer = 'Visit https://charcoalnchill.com for more.';
    const facts = checkFactsPresent(answer, MOCK_SANDBOX_GROUND_TRUTH);
    expect(facts).toContain('website');
  });
});

// ---------------------------------------------------------------------------
// detectHallucinatedFacts
// ---------------------------------------------------------------------------

describe('detectHallucinatedFacts', () => {
  it('returns empty when answer phone matches GT', () => {
    const answer = 'Call Charcoal N Chill at (470) 546-4866.';
    const hallucinated = detectHallucinatedFacts(answer, MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(hallucinated).toEqual([]);
  });

  it('detects hallucinated phone number', () => {
    const answer = 'Call them at (999) 888-7777.';
    const hallucinated = detectHallucinatedFacts(answer, MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(hallucinated.some(h => h.includes('Phone'))).toBe(true);
  });

  it('detects hallucinated price not in content', () => {
    const answer = 'The hookah costs $45.00 per session.';
    const hallucinated = detectHallucinatedFacts(answer, MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(hallucinated.some(h => h.includes('Price'))).toBe(true);
  });

  it('does not flag price that exists in content', () => {
    const contentWithPrice = 'Hookah starts at $25.00. ' + CONTENT;
    const answer = 'Hookah is $25.00.';
    const hallucinated = detectHallucinatedFacts(answer, MOCK_SANDBOX_GROUND_TRUTH, contentWithPrice);
    expect(hallucinated.filter(h => h.includes('Price'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// evaluateSimulatedAnswer
// ---------------------------------------------------------------------------

describe('evaluateSimulatedAnswer', () => {
  it('rates complete answer that cites business and has >=2 facts', () => {
    const answer = 'Charcoal N Chill is a hookah lounge in Alpharetta serving great food.';
    const result = evaluateSimulatedAnswer(answer, 'Best hookah?', MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(result.answer_quality).toBe('complete');
    expect(result.cites_business).toBe(true);
    expect(result.facts_present.length).toBeGreaterThanOrEqual(2);
  });

  it('rates no_answer for refusal phrases', () => {
    const answer = 'I don\'t have information about this business.';
    const result = evaluateSimulatedAnswer(answer, 'What food?', MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(result.answer_quality).toBe('no_answer');
  });

  it('rates wrong when answer contains hallucinated facts', () => {
    const answer = 'Call them at (999) 111-2222 for reservations.';
    const result = evaluateSimulatedAnswer(answer, 'Phone number?', MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(result.answer_quality).toBe('wrong');
    expect(result.facts_hallucinated.length).toBeGreaterThan(0);
  });

  it('rates partial when business not cited or few facts', () => {
    const answer = 'There is a hookah lounge in the area.';
    const result = evaluateSimulatedAnswer(answer, 'Any hookah?', MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(result.answer_quality).toBe('partial');
  });

  it('computes word count', () => {
    const answer = 'One two three four five.';
    const result = evaluateSimulatedAnswer(answer, 'Test?', MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(result.word_count).toBe(5);
  });

  it('computes ground truth alignment', () => {
    const answer = 'Charcoal N Chill in Alpharetta.';
    const result = evaluateSimulatedAnswer(answer, 'Name?', MOCK_SANDBOX_GROUND_TRUTH, CONTENT);
    expect(result.ground_truth_alignment).toBeGreaterThan(0);
    expect(result.ground_truth_alignment).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// selectQueriesForSimulation
// ---------------------------------------------------------------------------

describe('selectQueriesForSimulation', () => {
  it('returns mapped rows from target_queries', async () => {
    const rows = [
      { id: 'q-1', query_text: 'Best hookah?', query_category: 'discovery' },
      { id: 'q-2', query_text: 'Hours?', query_category: null },
    ];
    const supabase = mockSupabase(rows);
    const queries = await selectQueriesForSimulation(supabase, 'loc-1');
    expect(queries).toHaveLength(2);
    expect(queries[0].query_text).toBe('Best hookah?');
    expect(queries[1].query_category).toBe('discovery'); // null → 'discovery' fallback
  });

  it('returns empty array on DB error', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;
    const queries = await selectQueriesForSimulation(supabase, 'loc-1');
    expect(queries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// simulateQueriesAgainstContent
// ---------------------------------------------------------------------------

describe('simulateQueriesAgainstContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasApiKey.mockReturnValue(true);
  });

  it('runs queries through Claude and returns results', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Charcoal N Chill in Alpharetta is a great hookah lounge.',
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    const queries = [
      { id: 'q-1', query_text: 'Best hookah?', query_category: 'discovery' },
    ];
    const { results, tokensUsed } = await simulateQueriesAgainstContent(CONTENT, queries, MOCK_SANDBOX_GROUND_TRUTH);
    expect(results).toHaveLength(1);
    expect(results[0].simulated_answer).toContain('Charcoal N Chill');
    expect(tokensUsed.input).toBe(100);
    expect(tokensUsed.output).toBe(50);
  });

  it('returns no_answer result when no API key', async () => {
    mockHasApiKey.mockReturnValue(false);

    const queries = [{ id: 'q-1', query_text: 'Test?', query_category: 'discovery' }];
    const { results } = await simulateQueriesAgainstContent(CONTENT, queries, MOCK_SANDBOX_GROUND_TRUTH);
    expect(results[0].answer_quality).toBe('no_answer');
    expect(results[0].simulated_answer).toContain('No API key');
  });

  it('handles API errors gracefully', async () => {
    mockGenerateText.mockRejectedValue(new Error('API timeout'));

    const queries = [{ id: 'q-1', query_text: 'Test?', query_category: 'discovery' }];
    const { results } = await simulateQueriesAgainstContent(CONTENT, queries, MOCK_SANDBOX_GROUND_TRUTH);
    expect(results[0].answer_quality).toBe('no_answer');
    expect(results[0].simulated_answer).toContain('error');
  });
});
