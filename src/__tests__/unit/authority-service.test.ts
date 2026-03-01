// ---------------------------------------------------------------------------
// src/__tests__/unit/authority-service.test.ts — Authority Service Tests
//
// Sprint 108: 10 tests covering runAuthorityMapping (7) and
// runAuthorityMappingForAllLocations (3).
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist ALL mock functions so vi.mock factories can reference them
const {
  mockDetectCitationSources,
  mockComputeAuthorityScore,
  mockGetVelocityLabel,
  mockCountActivePlatforms,
  mockCountSameAsUrls,
  mockDetectSameAsGaps,
  mockComputeCitationVelocity,
  mockSaveAuthoritySnapshot,
  mockShouldAlertDecay,
  mockGenerateRecommendations,
  mockPlanSatisfies,
  mockCaptureException,
  mockCaptureMessage,
} = vi.hoisted(() => ({
  mockDetectCitationSources: vi.fn(),
  mockComputeAuthorityScore: vi.fn(),
  mockGetVelocityLabel: vi.fn(),
  mockCountActivePlatforms: vi.fn(),
  mockCountSameAsUrls: vi.fn(),
  mockDetectSameAsGaps: vi.fn(),
  mockComputeCitationVelocity: vi.fn(),
  mockSaveAuthoritySnapshot: vi.fn(),
  mockShouldAlertDecay: vi.fn(),
  mockGenerateRecommendations: vi.fn(),
  mockPlanSatisfies: vi.fn(),
  mockCaptureException: vi.fn(),
  mockCaptureMessage: vi.fn(),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  planSatisfies: mockPlanSatisfies,
}));

vi.mock('@/lib/authority/citation-source-detector', () => ({
  detectCitationSources: mockDetectCitationSources,
}));

vi.mock('@/lib/authority/entity-authority-scorer', () => ({
  computeAuthorityScore: mockComputeAuthorityScore,
  getVelocityLabel: mockGetVelocityLabel,
  countActivePlatforms: mockCountActivePlatforms,
  countSameAsUrls: mockCountSameAsUrls,
}));

vi.mock('@/lib/authority/sameas-enricher', () => ({
  detectSameAsGaps: mockDetectSameAsGaps,
}));

vi.mock('@/lib/authority/citation-velocity-monitor', () => ({
  computeCitationVelocity: mockComputeCitationVelocity,
  saveAuthoritySnapshot: mockSaveAuthoritySnapshot,
  shouldAlertDecay: mockShouldAlertDecay,
}));

vi.mock('@/lib/authority/authority-recommendations', () => ({
  generateRecommendations: mockGenerateRecommendations,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

import {
  runAuthorityMapping,
  runAuthorityMappingForAllLocations,
} from '@/lib/authority/authority-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { CitationSource, SameAsGap } from '@/lib/authority/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_LOCATION = {
  id: 'loc-1',
  org_id: 'org-1',
  business_name: 'Test Biz',
  address_line1: '123 Main',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  phone: '555-0100',
  website_url: 'https://test.com',
};

function makeCitation(overrides: Partial<CitationSource> = {}): CitationSource {
  return {
    url: 'https://example.com/article',
    domain: 'example.com',
    tier: 'tier1',
    source_type: 'local_news',
    snippet: 'A great restaurant.',
    detected_at: '2026-03-01T00:00:00Z',
    sentiment: 'positive',
    is_sameas_candidate: false,
    ...overrides,
  };
}

function makeSameAsGap(overrides: Partial<SameAsGap> = {}): SameAsGap {
  return {
    url: 'https://yelp.com/biz/test',
    platform: 'yelp',
    tier: 'tier2',
    estimated_impact: 'high',
    action_label: 'Claim Yelp listing',
    action_instructions: 'Go to Yelp and claim your listing.',
    already_in_schema: false,
    ...overrides,
  };
}

const DEFAULT_DIMENSIONS = {
  tier1_citation_score: 15,
  tier2_coverage_score: 10,
  platform_breadth_score: 12,
  sameas_score: 6,
  velocity_score: 5,
};

function makeSupabaseMock(overrides: {
  locationData?: unknown;
  locationError?: unknown;
  orgsData?: unknown[];
  orgsError?: unknown;
  locationsForOrg?: unknown[];
} = {}) {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  const fromFn = vi.fn((table: string) => {
    if (table === 'locations') {
      return {
        select: vi.fn().mockImplementation((selectStr: string) => {
          // For the batch function: .select('id').eq('org_id', orgId)
          if (selectStr === 'id') {
            return {
              eq: vi.fn().mockResolvedValue({
                data: overrides.locationsForOrg ?? [{ id: 'loc-1' }],
                error: null,
              }),
            };
          }
          // For runAuthorityMapping: .select('id, org_id, ...').eq('id').eq('org_id').single()
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: overrides.locationData !== undefined
                    ? overrides.locationData
                    : MOCK_LOCATION,
                  error: overrides.locationError ?? null,
                }),
              }),
            }),
          };
        }),
        update: mockUpdate,
      };
    }

    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: overrides.orgsData ?? [{ id: 'org-1', plan: 'growth' }],
            error: overrides.orgsError ?? null,
          }),
        }),
      };
    }

    if (table === 'entity_authority_citations') {
      return { upsert: mockUpsert };
    }

    if (table === 'entity_authority_profiles') {
      return { upsert: mockUpsert };
    }

    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
  });

  const client = {
    from: fromFn,
    _mockUpsert: mockUpsert,
    _mockUpdate: mockUpdate,
  } as unknown as SupabaseClient<Database> & {
    _mockUpsert: typeof mockUpsert;
    _mockUpdate: typeof mockUpdate;
  };

  return client;
}

// ---------------------------------------------------------------------------
// Default mock setups
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  const citations = [
    makeCitation({ url: 'https://news.com/1', tier: 'tier1' }),
    makeCitation({ url: 'https://yelp.com/biz', tier: 'tier2' }),
    makeCitation({ url: 'https://blog.com/review', tier: 'tier3' }),
  ];
  const sameAsGaps = [
    makeSameAsGap(),
    makeSameAsGap({
      url: 'https://tripadvisor.com/r/test',
      platform: 'tripadvisor',
    }),
  ];

  mockDetectCitationSources.mockResolvedValue(citations);
  mockCountActivePlatforms.mockResolvedValue(3);
  mockCountSameAsUrls.mockResolvedValue(2);
  mockComputeCitationVelocity.mockResolvedValue(5);
  mockComputeAuthorityScore.mockReturnValue({
    score: 48,
    dimensions: DEFAULT_DIMENSIONS,
  });
  mockGetVelocityLabel.mockReturnValue('stable');
  mockDetectSameAsGaps.mockResolvedValue(sameAsGaps);
  mockGenerateRecommendations.mockReturnValue([
    {
      priority: 1,
      category: 'tier1_citation',
      title: 'Get local press',
      description: 'Reach out to local news.',
      estimated_score_gain: 10,
      effort: 'medium',
      action_type: 'outreach',
    },
  ]);
  mockSaveAuthoritySnapshot.mockResolvedValue(undefined);
  mockShouldAlertDecay.mockReturnValue(false);
  mockPlanSatisfies.mockImplementation((plan: string, minimum: string) => {
    const tiers = ['trial', 'starter', 'growth', 'agency'];
    return tiers.indexOf(plan) >= tiers.indexOf(minimum);
  });
}

// ---------------------------------------------------------------------------
// runAuthorityMapping — 7 tests
// ---------------------------------------------------------------------------

describe('runAuthorityMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('returns error result when location not found', async () => {
    const sb = makeSupabaseMock({ locationData: null });
    const result = await runAuthorityMapping(sb, 'loc-missing', 'org-1');

    expect(result.entity_authority_score).toBe(0);
    expect(result.citations_detected).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe('Location not found: loc-missing');
    expect(result.location_id).toBe('loc-missing');
    expect(result.org_id).toBe('org-1');
  });

  it('returns score 0 and error when location query fails', async () => {
    const sb = makeSupabaseMock({
      locationData: null,
      locationError: { message: 'DB connection lost', code: '500' },
    });
    const result = await runAuthorityMapping(sb, 'loc-1', 'org-1');

    expect(result.entity_authority_score).toBe(0);
    expect(result.errors).toContain('Location not found: loc-1');
    expect(result.velocity).toBeNull();
    expect(result.sameas_gaps_found).toBe(0);
  });

  it('calls detectCitationSources with groundTruth built from location row', async () => {
    const sb = makeSupabaseMock();
    await runAuthorityMapping(sb, 'loc-1', 'org-1');

    expect(mockDetectCitationSources).toHaveBeenCalledOnce();
    const groundTruth = mockDetectCitationSources.mock.calls[0][0];
    expect(groundTruth).toEqual({
      location_id: 'loc-1',
      org_id: 'org-1',
      name: 'Test Biz',
      address: '123 Main',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      phone: '555-0100',
      website: 'https://test.com',
    });
  });

  it('returns correct entity_authority_score from computeAuthorityScore', async () => {
    mockComputeAuthorityScore.mockReturnValue({
      score: 72,
      dimensions: DEFAULT_DIMENSIONS,
    });

    const sb = makeSupabaseMock();
    const result = await runAuthorityMapping(sb, 'loc-1', 'org-1');

    expect(result.entity_authority_score).toBe(72);
    expect(mockComputeAuthorityScore).toHaveBeenCalledOnce();
    // Verify it was called with the right arguments
    const [citations, platformCount, sameAsCount, velocity] =
      mockComputeAuthorityScore.mock.calls[0];
    expect(citations).toHaveLength(3);
    expect(platformCount).toBe(3);
    expect(sameAsCount).toBe(2);
    expect(velocity).toBe(5);
  });

  it('returns citations_detected = number of detected citations', async () => {
    const fiveCitations = [
      makeCitation({ url: 'https://a.com' }),
      makeCitation({ url: 'https://b.com' }),
      makeCitation({ url: 'https://c.com' }),
      makeCitation({ url: 'https://d.com' }),
      makeCitation({ url: 'https://e.com' }),
    ];
    mockDetectCitationSources.mockResolvedValue(fiveCitations);

    const sb = makeSupabaseMock();
    const result = await runAuthorityMapping(sb, 'loc-1', 'org-1');

    expect(result.citations_detected).toBe(5);
  });

  it('returns sameas_gaps_found = number of detected sameAs gaps', async () => {
    const threeGaps = [
      makeSameAsGap({ url: 'https://yelp.com/biz/1' }),
      makeSameAsGap({ url: 'https://tripadvisor.com/r/1' }),
      makeSameAsGap({ url: 'https://facebook.com/p/1' }),
    ];
    mockDetectSameAsGaps.mockResolvedValue(threeGaps);

    const sb = makeSupabaseMock();
    const result = await runAuthorityMapping(sb, 'loc-1', 'org-1');

    expect(result.sameas_gaps_found).toBe(3);
  });

  it('handles partial failures gracefully — errors array but still returns result', async () => {
    // countActivePlatforms throws, but the pipeline continues
    mockCountActivePlatforms.mockRejectedValue(
      new Error('Platform DB timeout'),
    );
    // countSameAsUrls also throws
    mockCountSameAsUrls.mockRejectedValue(new Error('SameAs DB timeout'));

    const sb = makeSupabaseMock();
    const result = await runAuthorityMapping(sb, 'loc-1', 'org-1');

    // Should still return a valid result with a score
    expect(result.entity_authority_score).toBe(48);
    expect(result.citations_detected).toBe(3);
    expect(result.errors).toContain('Failed to count active platforms');
    expect(result.errors).toContain('Failed to count sameAs URLs');
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    // Sentry should have been notified of the partial failures
    expect(mockCaptureException).toHaveBeenCalledTimes(2);
    // run_at should be set
    expect(result.run_at).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// runAuthorityMappingForAllLocations — 3 tests
// ---------------------------------------------------------------------------

describe('runAuthorityMappingForAllLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    // Speed up tests by resolving the 1-second delay immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns { processed: 0, errors: 1 } when orgs query fails', async () => {
    const sb = makeSupabaseMock();
    // Override the from mock to return error for organizations
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation(
      (table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB down', code: '500' },
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      },
    );

    const promise = runAuthorityMappingForAllLocations(sb);
    // Advance timers so any pending setTimeout resolves
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ processed: 0, errors: 1 });
  });

  it('filters to Growth+ orgs only', async () => {
    const sb = makeSupabaseMock();
    // Override the from mock to return mixed-plan orgs
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation(
      (table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'org-starter', plan: 'starter' },
                  { id: 'org-growth', plan: 'growth' },
                  { id: 'org-agency', plan: 'agency' },
                  { id: 'org-trial', plan: 'trial' },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'locations') {
          return {
            select: vi.fn().mockImplementation((selectStr: string) => {
              if (selectStr === 'id') {
                return {
                  eq: vi.fn().mockResolvedValue({
                    data: [{ id: 'loc-1' }],
                    error: null,
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: MOCK_LOCATION,
                      error: null,
                    }),
                  }),
                }),
              };
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (
          table === 'entity_authority_citations' ||
          table === 'entity_authority_profiles'
        ) {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      },
    );

    const promise = runAuthorityMappingForAllLocations(sb);
    await vi.runAllTimersAsync();
    const result = await promise;

    // planSatisfies should have been called for all 4 orgs
    expect(mockPlanSatisfies).toHaveBeenCalledTimes(4);
    expect(mockPlanSatisfies).toHaveBeenCalledWith('starter', 'growth');
    expect(mockPlanSatisfies).toHaveBeenCalledWith('growth', 'growth');
    expect(mockPlanSatisfies).toHaveBeenCalledWith('agency', 'growth');
    expect(mockPlanSatisfies).toHaveBeenCalledWith('trial', 'growth');

    // Only growth and agency satisfy 'growth' minimum — 2 locations processed
    expect(result.processed).toBe(2);
  });

  it('processes locations and returns correct counts', async () => {
    const sb = makeSupabaseMock();
    // Set up: 1 org with 2 locations, one succeeds and one has errors
    (sb.from as ReturnType<typeof vi.fn>).mockImplementation(
      (table: string) => {
        if (table === 'organizations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'org-1', plan: 'growth' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'locations') {
          return {
            select: vi.fn().mockImplementation((selectStr: string) => {
              if (selectStr === 'id') {
                return {
                  eq: vi.fn().mockResolvedValue({
                    data: [{ id: 'loc-1' }, { id: 'loc-2' }],
                    error: null,
                  }),
                };
              }
              return {
                eq: vi.fn().mockImplementation((_col: string, val: string) => ({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue(
                      val === 'loc-2'
                        ? { data: null, error: { message: 'Not found' } }
                        : { data: MOCK_LOCATION, error: null },
                    ),
                  }),
                })),
              };
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (
          table === 'entity_authority_citations' ||
          table === 'entity_authority_profiles'
        ) {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      },
    );

    const promise = runAuthorityMappingForAllLocations(sb);
    await vi.runAllTimersAsync();
    const result = await promise;

    // loc-1 succeeds (processed), loc-2 returns errors (errors)
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
  });
});
