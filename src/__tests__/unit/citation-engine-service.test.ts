// ---------------------------------------------------------------------------
// citation-engine-service.test.ts — Unit tests for lib/services/citation-engine.service
//
// Strategy:
//   • generateText is mocked at the 'ai' module level — no real API calls.
//   • hasApiKey is mocked to control mock/real code paths.
//   • Supabase mock is passed as a parameter (service is a pure function).
//
// Run:
//   npx vitest run src/__tests__/unit/citation-engine-service.test.ts
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
  hasApiKey: vi.fn().mockReturnValue(true),
}));

import {
  extractPlatform,
  generateSampleQueries,
  buildCitationPrompt,
  runCitationQuery,
  runCitationSample,
  writeCitationResults,
  calculateCitationGapScore,
  TRACKED_CATEGORIES,
  TRACKED_METROS,
} from '@/lib/services/citation-engine.service';
import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';
import type {
  CitationSourceIntelligence,
  TenantListing,
} from '@/lib/types/citations';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMockSupabase() {
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const client = {
    from: vi.fn(() => ({
      upsert: mockUpsert,
    })),
    _mockUpsert: mockUpsert,
  };
  return client as unknown as SupabaseClient<Database> & {
    _mockUpsert: typeof mockUpsert;
  };
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Constants ────────────────────────────────────────────────────────────

describe('constants', () => {
  it('has 9 tracked categories', () => {
    expect(TRACKED_CATEGORIES).toHaveLength(9);
  });

  it('has 20 tracked metros', () => {
    expect(TRACKED_METROS).toHaveLength(20);
  });

  it('all metros have city and state', () => {
    for (const metro of TRACKED_METROS) {
      expect(metro.city).toBeTruthy();
      expect(metro.state).toBeTruthy();
      expect(metro.state).toMatch(/^[A-Z]{2}$/);
    }
  });
});

// ── extractPlatform tests ────────────────────────────────────────────────

describe('extractPlatform', () => {
  it('returns null for null input', () => {
    expect(extractPlatform(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPlatform('')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractPlatform('not a url')).toBeNull();
  });

  it('maps yelp.com to yelp', () => {
    expect(extractPlatform('https://www.yelp.com/biz/some-business')).toBe('yelp');
  });

  it('maps tripadvisor.com to tripadvisor', () => {
    expect(extractPlatform('https://www.tripadvisor.com/Restaurant_Review-123')).toBe('tripadvisor');
  });

  it('maps google.com/maps to google', () => {
    expect(extractPlatform('https://www.google.com/maps/place/Some+Business')).toBe('google');
  });

  it('maps maps.google.com to google', () => {
    expect(extractPlatform('https://maps.google.com/?q=some+business')).toBe('google');
  });

  it('maps facebook.com to facebook', () => {
    expect(extractPlatform('https://www.facebook.com/somebusiness')).toBe('facebook');
  });

  it('maps instagram.com to instagram', () => {
    expect(extractPlatform('https://www.instagram.com/somebusiness')).toBe('instagram');
  });

  it('maps reddit.com to reddit', () => {
    expect(extractPlatform('https://www.reddit.com/r/Atlanta/comments/abc123')).toBe('reddit');
  });

  it('maps opentable.com to opentable', () => {
    expect(extractPlatform('https://www.opentable.com/some-restaurant')).toBe('opentable');
  });

  it('maps resy.com to resy', () => {
    expect(extractPlatform('https://resy.com/cities/atl/some-restaurant')).toBe('resy');
  });

  it('maps eater.com to eater', () => {
    expect(extractPlatform('https://atlanta.eater.com/best-restaurants')).toBe('eater');
  });

  it('maps zagat.com to zagat', () => {
    expect(extractPlatform('https://www.zagat.com/r/some-restaurant')).toBe('zagat');
  });

  it('returns hostname without TLD for unknown domains', () => {
    expect(extractPlatform('https://someblog.com/best-restaurants')).toBe('someblog');
  });

  it('strips www. from unknown domains', () => {
    expect(extractPlatform('https://www.localmagazine.com/article')).toBe('localmagazine');
  });
});

// ── generateSampleQueries tests ──────────────────────────────────────────

describe('generateSampleQueries', () => {
  it('returns 5 sample queries', () => {
    const queries = generateSampleQueries('hookah lounge', 'Atlanta', 'GA');
    expect(queries).toHaveLength(5);
  });

  it('includes category, city, and state in queries', () => {
    const queries = generateSampleQueries('restaurant', 'Dallas', 'TX');
    expect(queries[0]).toBe('best restaurant in Dallas TX');
    expect(queries[1]).toBe('top restaurant Dallas');
    expect(queries[2]).toBe('restaurant Dallas TX recommendations');
    expect(queries[3]).toBe('where to find restaurant in Dallas');
    expect(queries[4]).toBe('restaurant near Dallas');
  });
});

// ── buildCitationPrompt tests ────────────────────────────────────────────

describe('buildCitationPrompt', () => {
  it('includes the query text', () => {
    const prompt = buildCitationPrompt('best hookah in Atlanta');
    expect(prompt).toContain('best hookah in Atlanta');
  });

  it('asks for JSON response', () => {
    const prompt = buildCitationPrompt('test query');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('recommendations');
    expect(prompt).toContain('source_url');
  });
});

// ── runCitationQuery tests ───────────────────────────────────────────────

describe('runCitationQuery', () => {
  it('returns empty citedUrls when API key is absent', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const result = await runCitationQuery('best hookah in Atlanta');

    expect(result.success).toBe(true);
    expect(result.citedUrls).toEqual([]);
    expect(vi.mocked(generateText)).not.toHaveBeenCalled();
  });

  it('extracts URLs from valid AI response', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        recommendations: [
          { business: 'Cloud 9 Lounge', source_url: 'https://yelp.com/cloud9' },
          { business: 'Sahara Hookah', source_url: 'https://tripadvisor.com/sahara' },
          { business: 'Local Spot', source_url: null },
        ],
      }),
    } as never);

    const result = await runCitationQuery('best hookah in Atlanta');

    expect(result.success).toBe(true);
    expect(result.citedUrls).toEqual([
      'https://yelp.com/cloud9',
      'https://tripadvisor.com/sahara',
    ]);
  });

  it('handles unparseable AI response gracefully', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: 'not valid json at all',
    } as never);

    const result = await runCitationQuery('best hookah in Atlanta');

    expect(result.success).toBe(true);
    expect(result.citedUrls).toEqual([]);
  });
});

// ── runCitationSample tests ──────────────────────────────────────────────

describe('runCitationSample', () => {
  it('counts platforms across multiple queries', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);

    // First query returns yelp + tripadvisor
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({
        recommendations: [
          { business: 'Biz A', source_url: 'https://yelp.com/bizA' },
          { business: 'Biz B', source_url: 'https://tripadvisor.com/bizB' },
        ],
      }),
    } as never);

    // Second query returns yelp + google
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({
        recommendations: [
          { business: 'Biz C', source_url: 'https://yelp.com/bizC' },
          { business: 'Biz D', source_url: 'https://www.google.com/maps/place/bizD' },
        ],
      }),
    } as never);

    // Third through fifth queries return empty
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({ recommendations: [] }),
    } as never);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({ recommendations: [] }),
    } as never);
    vi.mocked(generateText).mockResolvedValueOnce({
      text: JSON.stringify({ recommendations: [] }),
    } as never);

    const { platformCounts, successfulQueries } = await runCitationSample(
      'hookah lounge',
      'Atlanta',
      'GA',
    );

    expect(successfulQueries).toBe(5);
    expect(platformCounts['yelp']).toBe(2);
    expect(platformCounts['tripadvisor']).toBe(1);
    expect(platformCounts['google']).toBe(1);
  });

  it('returns empty counts when API key is absent', async () => {
    vi.mocked(hasApiKey).mockReturnValue(false);

    const { platformCounts, successfulQueries } = await runCitationSample(
      'restaurant',
      'Dallas',
      'TX',
    );

    expect(successfulQueries).toBe(5);
    expect(Object.keys(platformCounts)).toHaveLength(0);
  });

  it('continues when individual queries throw', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);

    // First query throws
    vi.mocked(generateText).mockRejectedValueOnce(new Error('Rate limit'));

    // Remaining queries succeed with empty results
    for (let i = 0; i < 4; i++) {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: JSON.stringify({ recommendations: [] }),
      } as never);
    }

    const { successfulQueries } = await runCitationSample(
      'bar',
      'Miami',
      'FL',
    );

    // 4 succeed, 1 fails
    expect(successfulQueries).toBe(4);
  });
});

// ── writeCitationResults tests ───────────────────────────────────────────

describe('writeCitationResults', () => {
  it('returns 0 when successfulQueries is 0', async () => {
    const supabase = makeMockSupabase();
    const result = await writeCitationResults(
      'hookah lounge', 'Atlanta', 'GA', { yelp: 3 }, 0, null, supabase,
    );

    expect(result).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('upserts with correct frequency calculation', async () => {
    const supabase = makeMockSupabase();
    const platformCounts = { yelp: 4, tripadvisor: 2 };

    await writeCitationResults(
      'hookah lounge', 'Atlanta', 'GA', platformCounts, 5, 'best hookah in Atlanta GA', supabase,
    );

    // 2 upserts (one per platform)
    expect(supabase.from).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenCalledWith('citation_source_intelligence');

    // Check frequency: 4/5 = 0.800
    expect(supabase._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        business_category: 'hookah lounge',
        city: 'Atlanta',
        state: 'GA',
        platform: 'yelp',
        citation_frequency: 0.8,
        sample_size: 5,
        model_provider: 'perplexity-sonar',
        sample_query: 'best hookah in Atlanta GA',
      }),
      expect.objectContaining({
        onConflict: 'business_category,city,state,platform,model_provider',
      }),
    );

    // Check frequency: 2/5 = 0.400
    expect(supabase._mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'tripadvisor',
        citation_frequency: 0.4,
      }),
      expect.any(Object),
    );
  });

  it('returns count of platforms written', async () => {
    const supabase = makeMockSupabase();
    const platformCounts = { yelp: 3, google: 2, reddit: 1 };

    const result = await writeCitationResults(
      'restaurant', 'Dallas', 'TX', platformCounts, 5, null, supabase,
    );

    expect(result).toBe(3);
  });

  it('handles upsert errors gracefully', async () => {
    const supabase = makeMockSupabase();
    supabase._mockUpsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    });
    supabase._mockUpsert.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await writeCitationResults(
      'bar', 'Miami', 'FL', { yelp: 3, google: 2 }, 5, null, supabase,
    );

    // Only 1 of 2 succeeded
    expect(result).toBe(1);
  });
});

// ── calculateCitationGapScore tests ──────────────────────────────────────

describe('calculateCitationGapScore', () => {
  const makePlatform = (
    platform: string,
    frequency: number,
  ): CitationSourceIntelligence => ({
    id: `id-${platform}`,
    business_category: 'hookah lounge',
    city: 'Atlanta',
    state: 'GA',
    platform,
    citation_frequency: frequency,
    sample_query: null,
    sample_size: 5,
    model_provider: 'perplexity-sonar',
    measured_at: new Date().toISOString(),
  });

  const makeListing = (directory: string, sync_status: string): TenantListing => ({
    directory,
    sync_status,
  });

  it('returns gapScore 100 with no platform data (optimistic default)', () => {
    const result = calculateCitationGapScore([], []);

    expect(result.gapScore).toBe(100);
    expect(result.platformsCovered).toBe(0);
    expect(result.platformsThatMatter).toBe(0);
    expect(result.topGap).toBeNull();
  });

  it('returns gapScore 100 when all relevant platforms are covered', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
      makePlatform('google', 0.94),
      makePlatform('tripadvisor', 0.62),
    ];
    const listings = [
      makeListing('yelp', 'synced'),
      makeListing('google', 'synced'),
      makeListing('tripadvisor', 'synced'),
    ];

    const result = calculateCitationGapScore(platforms, listings);

    expect(result.gapScore).toBe(100);
    expect(result.platformsCovered).toBe(3);
    expect(result.platformsThatMatter).toBe(3);
    expect(result.topGap).toBeNull();
  });

  it('returns gapScore 0 when no relevant platforms are covered', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
      makePlatform('google', 0.94),
    ];
    const listings: TenantListing[] = [];

    const result = calculateCitationGapScore(platforms, listings);

    expect(result.gapScore).toBe(0);
    expect(result.platformsCovered).toBe(0);
    expect(result.platformsThatMatter).toBe(2);
    expect(result.topGap?.platform).toBe('google'); // highest frequency uncovered
  });

  it('calculates partial coverage correctly', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
      makePlatform('google', 0.94),
      makePlatform('tripadvisor', 0.62),
    ];
    const listings = [
      makeListing('google', 'synced'),
    ];

    const result = calculateCitationGapScore(platforms, listings);

    expect(result.gapScore).toBe(33); // 1/3 = 33%
    expect(result.platformsCovered).toBe(1);
    expect(result.platformsThatMatter).toBe(3);
    expect(result.topGap?.platform).toBe('yelp'); // 0.87 > 0.62
  });

  it('filters out platforms below 30% threshold', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
      makePlatform('reddit', 0.15), // below threshold
      makePlatform('nextdoor', 0.10), // below threshold
    ];
    const listings = [
      makeListing('yelp', 'synced'),
    ];

    const result = calculateCitationGapScore(platforms, listings);

    // Only yelp qualifies (>= 0.30), and it's covered
    expect(result.gapScore).toBe(100);
    expect(result.platformsThatMatter).toBe(1);
  });

  it('excludes not_linked listings from coverage', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
      makePlatform('google', 0.94),
    ];
    const listings = [
      makeListing('yelp', 'not_linked'), // not valid
      makeListing('google', 'synced'),
    ];

    const result = calculateCitationGapScore(platforms, listings);

    expect(result.gapScore).toBe(50); // Only google covered
    expect(result.platformsCovered).toBe(1);
  });

  it('matches platform names case-insensitively', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
    ];
    const listings = [
      makeListing('Yelp', 'synced'),
    ];

    const result = calculateCitationGapScore(platforms, listings);

    expect(result.gapScore).toBe(100);
  });

  it('includes mismatch listings as covered', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
    ];
    const listings = [
      makeListing('yelp', 'mismatch'),
    ];

    const result = calculateCitationGapScore(platforms, listings);

    // mismatch means listed but data doesn't match — still "listed"
    expect(result.gapScore).toBe(100);
  });

  it('topGap action includes frequency percentage', () => {
    const platforms = [
      makePlatform('yelp', 0.87),
      makePlatform('tripadvisor', 0.62),
    ];
    const listings: TenantListing[] = [];

    const result = calculateCitationGapScore(platforms, listings);

    expect(result.topGap?.action).toContain('87%');
    expect(result.topGap?.action).toContain('Yelp');
  });
});
