// ---------------------------------------------------------------------------
// reviews-actions.test.ts — Unit tests for app/dashboard/reviews/actions.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before dynamic import
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: mockGetSafeAuthContext }));

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

const mockCaptureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));

const mockPushGBPReply = vi.fn();
vi.mock('@/lib/review-engine/gbp-reply-pusher', () => ({
  pushGBPReply: mockPushGBPReply,
}));

const mockGenerateEntityOptimizedResponse = vi.fn();
vi.mock('@/lib/reviews/review-responder', () => ({
  generateEntityOptimizedResponse: mockGenerateEntityOptimizedResponse,
}));

const mockExtractTopMenuItems = vi.fn().mockReturnValue([]);
const mockExtractKeyAmenities = vi.fn().mockReturnValue([]);
vi.mock('@/lib/reviews/entity-weaver', () => ({
  extractTopMenuItems: mockExtractTopMenuItems,
  extractKeyAmenities: mockExtractKeyAmenities,
}));

const mockAnalyzeSentiment = vi.fn().mockReturnValue({
  label: 'positive',
  score: 0.9,
  rating_band: 'high',
  keywords: [],
  topics: [],
});
vi.mock('@/lib/review-engine/sentiment-analyzer', () => ({
  analyzeSentiment: mockAnalyzeSentiment,
}));

const mockDeriveOrUpdateBrandVoice = vi.fn();
vi.mock('@/lib/review-engine/brand-voice-profiler', () => ({
  deriveOrUpdateBrandVoice: mockDeriveOrUpdateBrandVoice,
}));

const mockHasBannedPhrases = vi.fn().mockReturnValue({ found: false, phrase: null });
vi.mock('@/lib/reviews/banned-phrases', () => ({
  hasBannedPhrases: mockHasBannedPhrases,
  BANNED_PHRASES: ['as a valued customer'],
}));

// ---------------------------------------------------------------------------
// Chainable Supabase mock builder
//
// Supabase query chains are both chainable AND thenable:
//   const { data } = await supabase.from('t').select('*').eq('id', x).maybeSingle();
//   const { error } = await supabase.from('t').update({}).eq('id', x).eq('org_id', y);
//
// We model this by making each chain method return the chain itself, and making
// the chain a thenable that resolves to { data, error }.
// ---------------------------------------------------------------------------

interface ChainResult {
  data: unknown;
  error: unknown;
}

function buildChain(result: ChainResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make the chain itself thenable so `await chain` resolves to the result.
  // This covers patterns like: const { error } = await chain.update().eq().eq();
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

const mockCreateClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_CTX = { orgId: 'org-001', userId: 'user-001' };

const MOCK_REVIEW_APPROVE = {
  id: 'rev-001',
  response_draft: 'Great food!',
  response_status: 'draft_ready',
};

const MOCK_REVIEW_PUBLISH = {
  id: 'rev-001',
  response_draft: 'Thank you for visiting!',
  response_status: 'approved',
  platform: 'google',
};

const MOCK_REVIEW_REGEN = {
  id: 'rev-001',
  platform_review_id: 'gbp-rev-001',
  platform: 'google',
  location_id: 'loc-001',
  org_id: 'org-001',
  reviewer_name: 'John D.',
  rating: 4,
  text: 'Loved the tacos',
  published_at: '2026-03-01T00:00:00Z',
  keywords: ['tacos', 'fast'],
};

const MOCK_LOCATION = {
  id: 'loc-001',
  org_id: 'org-001',
  business_name: 'Taco Palace',
  address_line1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  phone: '512-555-0100',
  website_url: 'https://tacopalace.com',
  categories: ['Mexican'],
  amenities: { has_outdoor_seating: true },
};

const MOCK_BRAND_VOICE = {
  location_id: 'loc-001',
  tone: 'warm' as const,
  formality: 'casual' as const,
  use_emojis: false,
  sign_off: 'The Taco Palace Team',
  highlight_keywords: ['fresh', 'authentic'],
  avoid_phrases: [] as string[],
  derived_from: 'manual' as const,
  last_updated_at: '2026-03-01T00:00:00Z',
};

const MOCK_DRAFT = {
  review_id: 'gbp-rev-001',
  platform: 'google' as const,
  draft_text: 'Thanks for the kind words about our tacos!',
  character_count: 42,
  seo_keywords_used: ['tacos'],
  tone_match_score: 0.85,
  generation_method: 'ai' as const,
  requires_approval: false,
  generated_at: '2026-03-08T00:00:00Z',
  entityOptimized: true,
};

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock supabase client where `from(table)` returns a chain whose
 * `.maybeSingle()` (or `await` directly) resolves to the given result.
 *
 * For tables that need multiple calls (e.g., reviews: first select, then update),
 * pass an array of results — they will be returned in order.
 */
function setupSupabase(config: Record<string, ChainResult | ChainResult[]> = {}) {
  const callCounts: Record<string, number> = {};

  const supabase = {
    from: vi.fn((table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const cfg = config[table];
      if (Array.isArray(cfg)) {
        const idx = Math.min(callCounts[table] - 1, cfg.length - 1);
        return buildChain(cfg[idx]);
      }
      return buildChain(cfg ?? { data: null, error: null });
    }),
  };

  mockCreateClient.mockResolvedValue(supabase);
  return supabase;
}

// ---------------------------------------------------------------------------
// Module under test (dynamic import so mocks apply)
// ---------------------------------------------------------------------------

let approveReviewResponse: typeof import('@/app/dashboard/reviews/actions').approveReviewResponse;
let publishReviewResponse: typeof import('@/app/dashboard/reviews/actions').publishReviewResponse;
let regenerateResponse: typeof import('@/app/dashboard/reviews/actions').regenerateResponse;
let skipResponse: typeof import('@/app/dashboard/reviews/actions').skipResponse;

beforeEach(async () => {
  vi.clearAllMocks();
  mockGetSafeAuthContext.mockResolvedValue(AUTH_CTX);
  mockDeriveOrUpdateBrandVoice.mockResolvedValue(MOCK_BRAND_VOICE);
  mockGenerateEntityOptimizedResponse.mockResolvedValue(MOCK_DRAFT);
  mockHasBannedPhrases.mockReturnValue({ found: false, phrase: null });

  const mod = await import('@/app/dashboard/reviews/actions');
  approveReviewResponse = mod.approveReviewResponse;
  publishReviewResponse = mod.publishReviewResponse;
  regenerateResponse = mod.regenerateResponse;
  skipResponse = mod.skipResponse;
});

// ---------------------------------------------------------------------------
// approveReviewResponse
// ---------------------------------------------------------------------------

describe('approveReviewResponse', () => {
  it('returns Unauthorized when auth context is null', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce(null);
    setupSupabase();

    const result = await approveReviewResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when review not found', async () => {
    setupSupabase({ reviews: { data: null, error: null } });

    const result = await approveReviewResponse('rev-999');
    expect(result).toEqual({ success: false, error: 'Review not found' });
  });

  it('returns error when no draft to approve', async () => {
    setupSupabase({
      reviews: { data: { id: 'rev-001', response_draft: null, response_status: null }, error: null },
    });

    const result = await approveReviewResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'No draft to approve' });
  });

  it('approves successfully and revalidates path', async () => {
    setupSupabase({
      reviews: [
        { data: MOCK_REVIEW_APPROVE, error: null }, // select
        { data: null, error: null },                 // update
      ],
    });

    const result = await approveReviewResponse('rev-001');
    expect(result).toEqual({ success: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/reviews');
  });

  it('returns DB error message on update failure', async () => {
    setupSupabase({
      reviews: [
        { data: MOCK_REVIEW_APPROVE, error: null },
        { data: null, error: { message: 'Row-level security violation' } },
      ],
    });

    const result = await approveReviewResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Row-level security violation' });
  });
});

// ---------------------------------------------------------------------------
// publishReviewResponse
// ---------------------------------------------------------------------------

describe('publishReviewResponse', () => {
  it('returns Unauthorized when auth context is null', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce(null);
    setupSupabase();

    const result = await publishReviewResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when review not found', async () => {
    setupSupabase({ reviews: { data: null, error: null } });

    const result = await publishReviewResponse('rev-999');
    expect(result).toEqual({ success: false, error: 'Review not found' });
  });

  it('calls pushGBPReply for google platform and succeeds', async () => {
    setupSupabase({
      reviews: { data: MOCK_REVIEW_PUBLISH, error: null },
    });
    mockPushGBPReply.mockResolvedValueOnce({ ok: true });

    const result = await publishReviewResponse('rev-001');
    expect(result).toEqual({ success: true });
    expect(mockPushGBPReply).toHaveBeenCalledWith(
      expect.anything(),
      'rev-001',
      'Thank you for visiting!',
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/reviews');
  });

  it('returns error when pushGBPReply fails for google platform', async () => {
    setupSupabase({
      reviews: { data: MOCK_REVIEW_PUBLISH, error: null },
    });
    mockPushGBPReply.mockResolvedValueOnce({ ok: false, error: 'Token expired' });

    const result = await publishReviewResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Token expired' });
  });

  it('marks yelp review as published locally without calling pushGBPReply', async () => {
    const yelpReview = { ...MOCK_REVIEW_PUBLISH, platform: 'yelp' };
    const supabase = setupSupabase({
      reviews: [
        { data: yelpReview, error: null },  // select
        { data: null, error: null },         // update
      ],
    });

    const result = await publishReviewResponse('rev-001');
    expect(result).toEqual({ success: true });
    expect(mockPushGBPReply).not.toHaveBeenCalled();

    // Verify the second from('reviews') call was for the update
    const secondCall = supabase.from.mock.results[1].value;
    expect(secondCall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        response_status: 'published',
        response_published_text: 'Thank you for visiting!',
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/reviews');
  });
});

// ---------------------------------------------------------------------------
// regenerateResponse
// ---------------------------------------------------------------------------

describe('regenerateResponse', () => {
  function setupRegenSupabase(overrides: {
    review?: unknown;
    location?: unknown;
    menu?: unknown;
  } = {}) {
    return setupSupabase({
      reviews: [
        { data: overrides.review !== undefined ? overrides.review : MOCK_REVIEW_REGEN, error: null },
        { data: null, error: null }, // update chain
      ],
      locations: { data: overrides.location !== undefined ? overrides.location : MOCK_LOCATION, error: null },
      magic_menus: { data: overrides.menu !== undefined ? overrides.menu : null, error: null },
    });
  }

  it('returns Unauthorized when auth context is null', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce(null);
    setupRegenSupabase();

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns error when review not found', async () => {
    setupRegenSupabase({ review: null });

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Review not found' });
  });

  it('returns error when location not found', async () => {
    setupRegenSupabase({ location: null });

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Location not found' });
  });

  it('generates entity-optimized response and saves draft', async () => {
    setupRegenSupabase();

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: true });
    expect(mockGenerateEntityOptimizedResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        review: expect.objectContaining({ id: 'gbp-rev-001', platform: 'google' }),
        groundTruth: expect.objectContaining({ name: 'Taco Palace', city: 'Austin' }),
        brandVoice: MOCK_BRAND_VOICE,
        locationCategories: ['Mexican'],
        signatureMenuItems: [],
        reviewKeywords: ['tacos', 'fast'],
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/reviews');
  });

  it('retries with banned phrase added to avoid list on first banned check', async () => {
    setupRegenSupabase();

    // First call finds banned phrase, retry is clean
    mockHasBannedPhrases
      .mockReturnValueOnce({ found: true, phrase: 'as a valued customer' })
      .mockReturnValueOnce({ found: false, phrase: null });

    const retryDraft = { ...MOCK_DRAFT, draft_text: 'Clean retry draft' };
    mockGenerateEntityOptimizedResponse
      .mockResolvedValueOnce(MOCK_DRAFT)    // first attempt
      .mockResolvedValueOnce(retryDraft);   // retry

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: true });

    // Verify retry was called with banned phrase in avoid_phrases
    expect(mockGenerateEntityOptimizedResponse).toHaveBeenCalledTimes(2);
    const retryCall = mockGenerateEntityOptimizedResponse.mock.calls[1][0];
    expect(retryCall.brandVoice.avoid_phrases).toContain('as a valued customer');
  });

  it('returns error when draft generation returns null', async () => {
    setupRegenSupabase();
    mockGenerateEntityOptimizedResponse.mockResolvedValueOnce(null);

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Draft generation failed' });
  });

  it('captures exception in Sentry on unexpected error', async () => {
    setupRegenSupabase();
    mockDeriveOrUpdateBrandVoice.mockRejectedValueOnce(new Error('Brand voice DB timeout'));

    const result = await regenerateResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Regeneration failed' });
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { action: 'regenerateResponse', sprint: '132' } }),
    );
  });
});

// ---------------------------------------------------------------------------
// skipResponse
// ---------------------------------------------------------------------------

describe('skipResponse', () => {
  it('returns Unauthorized when auth context is null', async () => {
    mockGetSafeAuthContext.mockResolvedValueOnce(null);
    setupSupabase();

    const result = await skipResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('skips successfully and revalidates path', async () => {
    const supabase = setupSupabase({
      reviews: { data: null, error: null },
    });

    const result = await skipResponse('rev-001');
    expect(result).toEqual({ success: true });

    const chain = supabase.from.mock.results[0].value;
    expect(chain.update).toHaveBeenCalledWith({ response_status: 'skipped' });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/reviews');
  });

  it('returns DB error message on update failure', async () => {
    setupSupabase({
      reviews: { data: null, error: { message: 'Connection reset' } },
    });

    const result = await skipResponse('rev-001');
    expect(result).toEqual({ success: false, error: 'Connection reset' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
