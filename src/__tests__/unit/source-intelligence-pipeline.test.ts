// ---------------------------------------------------------------------------
// source-intelligence-pipeline.test.ts — Pipeline function tests
//
// Sprint 82: 7 tests — extractSOVSourceMentions, writeSourceMentions.
//
// Run:
//   npx vitest run src/__tests__/unit/source-intelligence-pipeline.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  extractSOVSourceMentions,
  writeSourceMentions,
} from '@/lib/services/sov-engine.service';
import { MOCK_SOURCE_MENTION_EXTRACTION } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockExtractSourceMentions } = vi.hoisted(() => ({
  mockExtractSourceMentions: vi.fn(),
}));

vi.mock('@/lib/services/source-intelligence.service', () => ({
  extractSourceMentions: mockExtractSourceMentions,
}));

// Mock the other dependencies of sov-engine.service that aren't under test
vi.mock('ai', () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
  MODELS: {},
}));

vi.mock('@/lib/ai/schemas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/schemas')>();
  return {
    ...actual,
    zodSchema: vi.fn((schema: unknown) => schema),
  };
});

vi.mock('@/lib/autopilot/create-draft', () => ({
  createDraft: vi.fn(),
}));

vi.mock('@/lib/services/sentiment.service', () => ({
  extractSentiment: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

function createMockSupabase() {
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      then: vi.fn((cb: (val: { error: null }) => void) => {
        cb({ error: null });
        return Promise.resolve();
      }),
    }),
  });

  const mockFrom = vi.fn(() => ({
    update: mockUpdate,
  }));

  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    from: mockFrom,
    update: mockUpdate,
  };
}

// ---------------------------------------------------------------------------
// extractSOVSourceMentions
// ---------------------------------------------------------------------------

describe('extractSOVSourceMentions', () => {
  beforeEach(() => {
    mockExtractSourceMentions.mockReset();
  });

  it('1. only extracts for results without cited_sources', async () => {
    mockExtractSourceMentions.mockResolvedValue(MOCK_SOURCE_MENTION_EXTRACTION);

    const results = [
      { evaluationId: 'eval-1', rawResponse: 'response text', engine: 'openai' },
      { evaluationId: 'eval-2', rawResponse: 'response text', engine: 'copilot' },
    ];

    const map = await extractSOVSourceMentions(results, 'Test Business');
    expect(mockExtractSourceMentions).toHaveBeenCalledTimes(2);
    expect(map.size).toBe(2);
  });

  it('2. skips results that already have cited_sources', async () => {
    mockExtractSourceMentions.mockResolvedValue(MOCK_SOURCE_MENTION_EXTRACTION);

    const results = [
      {
        evaluationId: 'eval-1',
        rawResponse: 'response text',
        engine: 'google',
        citedSources: [{ url: 'https://yelp.com', title: 'Yelp' }],
      },
      { evaluationId: 'eval-2', rawResponse: 'response text', engine: 'openai' },
    ];

    const map = await extractSOVSourceMentions(results, 'Test Business');
    // Only openai should be extracted (google has citedSources)
    expect(mockExtractSourceMentions).toHaveBeenCalledTimes(1);
    expect(map.has('eval-2')).toBe(true);
  });

  it('3. handles individual extraction failures gracefully', async () => {
    mockExtractSourceMentions
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce(MOCK_SOURCE_MENTION_EXTRACTION);

    const results = [
      { evaluationId: 'eval-1', rawResponse: 'response 1', engine: 'openai' },
      { evaluationId: 'eval-2', rawResponse: 'response 2', engine: 'copilot' },
    ];

    const map = await extractSOVSourceMentions(results, 'Test');
    // First fails (rejected), second succeeds
    expect(map.has('eval-2')).toBe(true);
  });

  it('4. returns Map of evaluationId to SourceMentionExtraction', async () => {
    mockExtractSourceMentions.mockResolvedValue(MOCK_SOURCE_MENTION_EXTRACTION);

    const results = [
      { evaluationId: 'eval-1', rawResponse: 'response text', engine: 'openai' },
    ];

    const map = await extractSOVSourceMentions(results, 'Test');
    expect(map).toBeInstanceOf(Map);
    expect(map.get('eval-1')).toEqual(MOCK_SOURCE_MENTION_EXTRACTION);
  });
});

// ---------------------------------------------------------------------------
// writeSourceMentions
// ---------------------------------------------------------------------------

describe('writeSourceMentions', () => {
  it('5. updates sov_evaluations.source_mentions for each entry', async () => {
    const { client, from } = createMockSupabase();

    const mentionsMap = new Map<string, typeof MOCK_SOURCE_MENTION_EXTRACTION | null>();
    mentionsMap.set('eval-1', MOCK_SOURCE_MENTION_EXTRACTION);

    await writeSourceMentions(client, mentionsMap);
    expect(from).toHaveBeenCalledWith('sov_evaluations');
  });

  it('6. skips null entries', async () => {
    const { client, from } = createMockSupabase();

    const mentionsMap = new Map<string, typeof MOCK_SOURCE_MENTION_EXTRACTION | null>();
    mentionsMap.set('eval-1', null);
    mentionsMap.set('eval-2', MOCK_SOURCE_MENTION_EXTRACTION);

    await writeSourceMentions(client, mentionsMap);
    // Only eval-2 should trigger an update
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('7. logs errors but does not throw', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mockFrom = vi.fn(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: vi.fn((cb: (val: { error: { message: string } }) => void) => {
            cb({ error: { message: 'DB error' } });
            return Promise.resolve();
          }),
        }),
      }),
    }));

    const client = { from: mockFrom } as unknown as SupabaseClient<Database>;

    const mentionsMap = new Map<string, typeof MOCK_SOURCE_MENTION_EXTRACTION | null>();
    mentionsMap.set('eval-1', MOCK_SOURCE_MENTION_EXTRACTION);

    // Should not throw
    await expect(writeSourceMentions(client, mentionsMap)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
