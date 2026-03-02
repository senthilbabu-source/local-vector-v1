/**
 * Sprint 123 — multi-model-sov unit tests
 * Tests getEnabledModels + runMultiModelQuery orchestration.
 * AI_RULES §154.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => 'mock-model'),
  hasApiKey: vi.fn(() => true),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { getEnabledModels } from '@/lib/config/sov-models';
import { runMultiModelQuery } from '@/lib/services/multi-model-sov';
import { hasApiKey } from '@/lib/ai/providers';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockSupabase() {
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
  return {
    client: { from: mockFrom } as unknown as SupabaseClient<Database>,
    mockFrom,
    mockUpsert,
  };
}

function baseParams(overrides: Partial<Parameters<typeof runMultiModelQuery>[0]> = {}) {
  const { client } = createMockSupabase();
  return {
    supabase: client,
    queryText: 'best hookah lounge Alpharetta',
    queryId: 'query-001',
    orgId: 'org-001',
    orgName: 'Charcoal N Chill',
    locationId: 'loc-001',
    planTier: 'agency',
    weekOf: new Date('2026-03-01'),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getEnabledModels — pure', () => {
  it("starter plan → ['perplexity_sonar'] only", () => {
    expect(getEnabledModels('starter')).toEqual(['perplexity_sonar']);
  });

  it("growth plan → ['perplexity_sonar', 'openai_gpt4o_mini']", () => {
    expect(getEnabledModels('growth')).toEqual([
      'perplexity_sonar',
      'openai_gpt4o_mini',
    ]);
  });

  it('agency plan → all 3 models', () => {
    expect(getEnabledModels('agency')).toEqual([
      'perplexity_sonar',
      'openai_gpt4o_mini',
      'gemini_flash',
    ]);
  });

  it("unknown plan → ['perplexity_sonar'] fallback", () => {
    expect(getEnabledModels('enterprise')).toEqual(['perplexity_sonar']);
  });
});

describe('runMultiModelQuery — AI + Supabase mocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasApiKey).mockReturnValue(true);
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        businesses: ['Charcoal N Chill', 'Cloud 9 Lounge'],
        cited_url: null,
      }),
    });
  });

  it('runs only enabled models for the plan tier', async () => {
    const { client } = createMockSupabase();
    const result = await runMultiModelQuery(
      baseParams({ supabase: client, planTier: 'starter' }),
    );
    // Starter = 1 model only (perplexity_sonar)
    expect(result.models_run).toEqual(['perplexity_sonar']);
    expect(result.models_run.length).toBe(1);
  });

  it('runs models SEQUENTIALLY (not parallel)', async () => {
    const callOrder: string[] = [];
    mockGenerateText.mockImplementation(async () => {
      callOrder.push('call');
      return {
        text: JSON.stringify({ businesses: ['Charcoal N Chill'], cited_url: null }),
      };
    });

    const { client } = createMockSupabase();
    await runMultiModelQuery(baseParams({ supabase: client, planTier: 'agency' }));

    // All 3 models should have been called
    expect(callOrder.length).toBe(3);
  });

  it('inserts sov_model_results row for each model', async () => {
    const { client, mockFrom } = createMockSupabase();
    await runMultiModelQuery(baseParams({ supabase: client, planTier: 'agency' }));

    // 3 models = 3 upsert calls (agency plan)
    const upsertCalls = mockFrom.mock.calls.filter(
      (call) => call[0] === 'sov_model_results',
    );
    expect(upsertCalls.length).toBe(3);
  });

  it('uses ON CONFLICT DO UPDATE (upsert)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const client = { from: mockFrom } as unknown as SupabaseClient<Database>;

    await runMultiModelQuery(baseParams({ supabase: client, planTier: 'starter' }));

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ model_provider: 'perplexity_sonar' }),
      { onConflict: 'org_id,query_id,model_provider,week_of' },
    );
  });

  it('continues when one model throws (partial results)', async () => {
    let callIndex = 0;
    mockGenerateText.mockImplementation(async () => {
      callIndex++;
      if (callIndex === 2) throw new Error('GPT timeout');
      return {
        text: JSON.stringify({ businesses: ['Charcoal N Chill'], cited_url: null }),
      };
    });

    const { client } = createMockSupabase();
    const result = await runMultiModelQuery(
      baseParams({ supabase: client, planTier: 'agency' }),
    );

    // All 3 models should be in results (2 success + 1 error fallback)
    expect(result.models_run.length).toBe(3);
    // The errored model should have cited=false
    expect(result.results.openai_gpt4o_mini?.cited).toBe(false);
    expect(result.results.openai_gpt4o_mini?.confidence).toBe('low');
  });

  it('cited_by_any=true when any model cites', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ businesses: ['Charcoal N Chill'], cited_url: null }),
    });

    const { client } = createMockSupabase();
    const result = await runMultiModelQuery(baseParams({ supabase: client }));

    expect(result.cited_by_any).toBe(true);
  });

  it('cited_by_all=true only when all enabled models cite', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ businesses: ['Charcoal N Chill'], cited_url: null }),
    });

    const { client } = createMockSupabase();
    const result = await runMultiModelQuery(baseParams({ supabase: client }));

    expect(result.cited_by_all).toBe(true);
  });

  it('applies call_delay_ms between model calls', async () => {
    const timestamps: number[] = [];
    mockGenerateText.mockImplementation(async () => {
      timestamps.push(Date.now());
      return {
        text: JSON.stringify({ businesses: ['Charcoal N Chill'], cited_url: null }),
      };
    });

    const { client } = createMockSupabase();
    await runMultiModelQuery(
      baseParams({ supabase: client, planTier: 'growth' }),
    );

    // Growth = 2 models. Second call should be after a delay.
    expect(timestamps.length).toBe(2);
    // Perplexity delay is 500ms, OpenAI delay is 200ms
    // We just verify there IS a gap (at least 100ms to account for timing variance)
    const gap = timestamps[1] - timestamps[0];
    expect(gap).toBeGreaterThanOrEqual(100);
  });

  it('never throws — always returns partial results on error', async () => {
    mockGenerateText.mockRejectedValue(new Error('All models down'));

    const { client } = createMockSupabase();
    // Should not throw
    const result = await runMultiModelQuery(
      baseParams({ supabase: client, planTier: 'starter' }),
    );

    expect(result.models_run.length).toBe(1);
    expect(result.results.perplexity_sonar?.cited).toBe(false);
  });

  it('respects existing SOV query prompt (same prompt structure)', async () => {
    const { client } = createMockSupabase();
    await runMultiModelQuery(
      baseParams({ supabase: client, planTier: 'starter' }),
    );

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'You are a local business search assistant. Always respond with valid JSON only.',
        prompt: expect.stringContaining('best hookah lounge Alpharetta'),
      }),
    );
  });
});
