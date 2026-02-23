// ---------------------------------------------------------------------------
// competitor-intercept-service.test.ts
// Unit tests for lib/services/competitor-intercept.service.ts
//
// Strategy:
//   • vi.useFakeTimers() eliminates the 3-second mock-fallback delay.
//   • vi.stubGlobal('fetch', ...) intercepts Perplexity and OpenAI calls
//     regardless of which module calls fetch (global stub crosses boundaries).
//   • A minimal Supabase mock is passed directly — no module-level mock needed.
//
// Run:
//   npx vitest run src/__tests__/unit/competitor-intercept-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runInterceptForCompetitor,
  type InterceptParams,
} from '@/lib/services/competitor-intercept.service';

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
  };
}

/** Build a minimal Perplexity API response body. */
function perplexityBody(winner = 'Cloud 9 Lounge') {
  return JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          winner,
          reasoning:           'Better late-night atmosphere.',
          key_differentiators: ['late night', 'happy hour'],
        }),
      },
    }],
  });
}

/** Build a minimal OpenAI GPT-4o-mini response body. */
function openaiBody(winner = 'Cloud 9 Lounge') {
  return JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          winner,
          winning_factor:   '15 more mentions of late-night vibes',
          gap_magnitude:    'high',
          gap_details:      { competitor_mentions: 15, your_mentions: 2 },
          suggested_action: 'Ask 3 customers to mention "late night" in reviews this week',
          action_category:  'reviews',
        }),
      },
    }],
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('runInterceptForCompetitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.PERPLEXITY_API_KEY = 'test-pplx-key';
    process.env.OPENAI_API_KEY     = 'test-openai-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── API calls ─────────────────────────────────────────────────────────

  it('calls the Perplexity API with correct URL when key is present', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(perplexityBody(), { status: 200 }))
      .mockResolvedValueOnce(new Response(openaiBody(),     { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const supabase = makeMockSupabase();
    await runInterceptForCompetitor(BASE_PARAMS, supabase);

    const perplexityCall = mockFetch.mock.calls[0];
    expect(perplexityCall[0]).toBe('https://api.perplexity.ai/chat/completions');
  });

  it('calls GPT-4o-mini with the Perplexity result when both keys are present', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(perplexityBody(), { status: 200 }))
      .mockResolvedValueOnce(new Response(openaiBody(),     { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const supabase = makeMockSupabase();
    await runInterceptForCompetitor(BASE_PARAMS, supabase);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const openaiCall = mockFetch.mock.calls[1];
    expect(openaiCall[0]).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(openaiCall[1].body as string);
    expect(body.model).toBe('gpt-4o-mini');
  });

  // ── Mock fallbacks ────────────────────────────────────────────────────

  it('uses mock Perplexity result (no real fetch) when PERPLEXITY_API_KEY is absent', async () => {
    delete process.env.PERPLEXITY_API_KEY;
    // OpenAI key also absent to keep test focused
    delete process.env.OPENAI_API_KEY;

    // Stub fetch to throw if called — proves mock path is taken instead
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fetch should not be called')));

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    // INSERT must still succeed via mock path
    expect(supabase._mockInsert).toHaveBeenCalledOnce();
    const inserted = supabase._mockInsert.mock.calls[0][0] as Record<string, unknown>;
    // Mock paths produce [MOCK] strings — verify the mock was used
    expect(String(inserted.winner_reason)).toContain('[MOCK]');
  });

  it('uses mock GPT-4o-mini result without second fetch call when OPENAI_API_KEY is absent', async () => {
    // Perplexity key present, OpenAI key absent
    delete process.env.OPENAI_API_KEY;

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(perplexityBody(), { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const supabase = makeMockSupabase();
    const promise  = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    // Only the Perplexity call should fire; OpenAI call is skipped (mock path)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(supabase._mockInsert).toHaveBeenCalledOnce();
  });

  it('falls back to mock Perplexity result when the fetch call rejects', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Perplexity unavailable')) // Stage 1 fails
      .mockResolvedValueOnce(new Response(openaiBody(), { status: 200 })); // Stage 2 succeeds
    vi.stubGlobal('fetch', mockFetch);

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    // INSERT still called — graceful degradation
    expect(supabase._mockInsert).toHaveBeenCalledOnce();
  });

  it('falls back to mock GPT-4o-mini result when the OpenAI fetch call rejects', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(perplexityBody(), { status: 200 })) // Stage 1 OK
      .mockRejectedValueOnce(new Error('OpenAI unavailable'));                // Stage 2 fails
    vi.stubGlobal('fetch', mockFetch);

    const supabase  = makeMockSupabase();
    const promise   = runInterceptForCompetitor(BASE_PARAMS, supabase);
    await vi.runAllTimersAsync();
    await promise;

    expect(supabase._mockInsert).toHaveBeenCalledOnce();
  });

  // ── INSERT shape ──────────────────────────────────────────────────────

  it('inserts a row with model_provider openai-gpt4o-mini and correct gap_analysis shape', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(perplexityBody(), { status: 200 }))
      .mockResolvedValueOnce(new Response(openaiBody(),     { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

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

  // ── Error propagation ─────────────────────────────────────────────────

  it('throws when the supabase insert returns an error', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(new Response(perplexityBody(), { status: 200 }))
      .mockResolvedValueOnce(new Response(openaiBody(),     { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const supabase = makeMockSupabase({ message: 'DB constraint violation' });

    await expect(runInterceptForCompetitor(BASE_PARAMS, supabase))
      .rejects
      .toThrow('DB constraint violation');
  });
});
