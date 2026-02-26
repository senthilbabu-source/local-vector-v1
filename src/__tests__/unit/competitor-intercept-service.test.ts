// ---------------------------------------------------------------------------
// competitor-intercept-service.test.ts
// Unit tests for lib/services/competitor-intercept.service.ts
//
// Strategy:
//   • vi.mock('ai') + vi.mock('@/lib/ai/providers') — intercepts AI SDK calls
//     at module level (same pattern as sov-engine-service.test.ts).
//   • vi.useFakeTimers() eliminates the 3-second mock-fallback delay.
//   • A minimal Supabase mock is passed directly — no module-level mock needed.
//
// Run:
//   npx vitest run src/__tests__/unit/competitor-intercept-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText:   vi.fn(),
  generateObject: vi.fn(),
  jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })),
}));

// ── Mock the providers ──────────────────────────────────────────────────
vi.mock('@/lib/ai/providers', () => ({
  getModel:  vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(true),
}));

// ── Imports after mock declarations ──────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  runInterceptForCompetitor,
  type InterceptParams,
} from '@/lib/services/competitor-intercept.service';
import { generateText, generateObject } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';

// ── Constants ──────────────────────────────────────────────────────────────
const ORG_ID      = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const LOCATION_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const BASE_PARAMS: InterceptParams = {
  orgId:        ORG_ID,
  locationId:   LOCATION_ID,
  businessName: 'Charcoal N Chill',
  categories:   ['Hookah Bar'],
  city:         'Alpharetta',
  state:        'GA',
  competitor: {
    id:              'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    competitor_name: 'Cloud 9 Lounge',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a mock supabase client that captures insert calls. */
function makeMockSupabase(insertError: { message: string } | null = null) {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: insertError });
  return {
    from: vi.fn(() => ({ insert: mockInsert })),
    _mockInsert: mockInsert,
  } as unknown as SupabaseClient<Database> & { _mockInsert: ReturnType<typeof vi.fn> };
}

/** Mock generateText return value for Stage 1 (Perplexity). */
function mockGenerateTextResult(winner = 'Cloud 9 Lounge') {
  return {
    text: JSON.stringify({
      winner,
      reasoning:           'Better late-night atmosphere.',
      key_differentiators: ['late night', 'happy hour'],
    }),
  };
}

/** Mock generateObject return value for Stage 2 (OpenAI). */
function mockGenerateObjectResult(winner = 'Cloud 9 Lounge') {
  return {
    object: {
      winner,
      winning_factor:   '15 more mentions of late-night vibes',
      gap_magnitude:    'high' as const,
      gap_details:      { competitor_mentions: 15, your_mentions: 2 },
      suggested_action: 'Ask 3 customers to mention "late night" in reviews this week',
      action_category:  'reviews' as const,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('runInterceptForCompetitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Default: both API keys present
    vi.mocked(hasApiKey).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── AI SDK calls ────────────────────────────────────────────────────

  it('calls Perplexity via generateText with correct model key', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const supabase = makeMockSupabase();
    await runInterceptForCompetitor(BASE_PARAMS, supabase);

    expect(vi.mocked(generateText)).toHaveBeenCalledOnce();
    expect(vi.mocked(generateText)).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'mock-model' }),
    );
  });

  it('calls GPT-4o-mini via generateObject with correct model key and schema', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const supabase = makeMockSupabase();
    await runInterceptForCompetitor(BASE_PARAMS, supabase);

    expect(vi.mocked(generateObject)).toHaveBeenCalledOnce();
    expect(vi.mocked(generateObject)).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'mock-model' }),
    );
  });

  // ── Mock fallbacks ──────────────────────────────────────────────────

  it('uses mock Perplexity result (no generateText call) when perplexity key absent', async () => {
    // Both keys absent → pure mock path
    vi.mocked(hasApiKey).mockReturnValue(false);

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
    expect(supabase._mockInsert).toHaveBeenCalledOnce();
    const inserted = supabase._mockInsert.mock.calls[0][0] as Record<string, unknown>;
    // Mock paths produce [MOCK] strings — verify the mock was used
    expect(String(inserted.winner_reason)).toContain('[MOCK]');
  });

  it('uses mock GPT-4o-mini result without generateObject call when openai key absent', async () => {
    // Perplexity present, OpenAI absent
    vi.mocked(hasApiKey).mockImplementation(
      (provider: string) => provider === 'perplexity',
    );
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    // Only Stage 1 (Perplexity) fires; Stage 2 (OpenAI) is mocked
    expect(vi.mocked(generateText)).toHaveBeenCalledOnce();
    expect(vi.mocked(generateObject)).not.toHaveBeenCalled();
    expect(supabase._mockInsert).toHaveBeenCalledOnce();
  });

  it('falls back to mock Perplexity result when generateText throws', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('Perplexity unavailable'));
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    // INSERT still called — graceful degradation
    expect(supabase._mockInsert).toHaveBeenCalledOnce();
  });

  it('falls back to mock GPT-4o-mini result when generateObject throws', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockRejectedValue(new Error('OpenAI unavailable'));

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    expect(supabase._mockInsert).toHaveBeenCalledOnce();
  });

  // ── INSERT shape ────────────────────────────────────────────────────

  it('inserts a row with model_provider openai-gpt4o-mini and correct gap_analysis shape', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const supabase = makeMockSupabase();
    await runInterceptForCompetitor(BASE_PARAMS, supabase);

    expect(supabase._mockInsert).toHaveBeenCalledOnce();
    const inserted = supabase._mockInsert.mock.calls[0][0] as Record<string, unknown>;

    expect(inserted.org_id).toBe(ORG_ID);
    expect(inserted.location_id).toBe(LOCATION_ID);
    expect(inserted.model_provider).toBe('openai-gpt4o-mini');
    expect(inserted.action_status).toBe('pending');
    // GapAnalysis shape (AI_RULES §19.1)
    expect(inserted.gap_analysis).toMatchObject({
      competitor_mentions: 15,
      your_mentions:       2,
    });
  });

  // ── Error propagation ───────────────────────────────────────────────

  it('throws when the supabase insert returns an error', async () => {
    vi.mocked(generateText).mockResolvedValue(mockGenerateTextResult() as never);
    vi.mocked(generateObject).mockResolvedValue(mockGenerateObjectResult() as never);

    const supabase = makeMockSupabase({ message: 'DB constraint violation' });

    await expect(runInterceptForCompetitor(BASE_PARAMS, supabase))
      .rejects
      .toThrow('DB constraint violation');
  });
});
