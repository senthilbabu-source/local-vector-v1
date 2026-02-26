// ---------------------------------------------------------------------------
// occasion-engine-service.test.ts — Unit tests for Occasion Engine
//
// Strategy:
//   • generateText is mocked at the 'ai' module level — no real API calls.
//   • hasApiKey / getModel are mocked to control mock/real code paths.
//   • Redis is mocked to control dedup behavior.
//   • Supabase mock is passed as a parameter (service is a pure function).
//
// Run:
//   npx vitest run src/__tests__/unit/occasion-engine-service.test.ts
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

// ── Mock Redis ──────────────────────────────────────────────────────────
const mockRedisGet = vi.fn().mockResolvedValue(null);
const mockRedisSet = vi.fn().mockResolvedValue('OK');
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
  })),
}));

// ── Mock plan enforcer ──────────────────────────────────────────────────
vi.mock('@/lib/plan-enforcer', () => ({
  canRunOccasionEngine: vi.fn((plan: string) => plan === 'growth' || plan === 'agency'),
}));

// ── Import after mocks ──────────────────────────────────────────────────
import {
  getDaysUntilPeak,
  checkOccasionAlerts,
  generateOccasionDraft,
  runOccasionScheduler,
} from '@/lib/services/occasion-engine.service';
import { generateText } from 'ai';
import { hasApiKey } from '@/lib/ai/providers';
import { getRedis } from '@/lib/redis';
import type { LocalOccasionRow } from '@/lib/types/occasions';
import type { SOVQueryResult } from '@/lib/services/sov-engine.service';

// ── Test data ────────────────────────────────────────────────────────────

const VALENTINES: LocalOccasionRow = {
  id: 'occ-valentines',
  name: "Valentine's Day",
  occasion_type: 'holiday',
  trigger_days_before: 28,
  annual_date: '02-14',
  peak_query_patterns: [
    { query: 'romantic dinner {city}', category: 'occasion' },
    { query: 'Valentine dinner {city}', category: 'occasion' },
  ],
  relevant_categories: ['restaurant', 'bar', 'lounge'],
  is_active: true,
};

const BIRTHDAY: LocalOccasionRow = {
  id: 'occ-birthday',
  name: 'Birthday Celebration',
  occasion_type: 'recurring',
  trigger_days_before: 14,
  annual_date: null,
  peak_query_patterns: [
    { query: 'best restaurant for birthday dinner', category: 'occasion' },
  ],
  relevant_categories: ['restaurant', 'bar', 'lounge', 'hookah lounge'],
  is_active: true,
};

const SUPER_BOWL: LocalOccasionRow = {
  id: 'occ-superbowl',
  name: 'Super Bowl Sunday',
  occasion_type: 'seasonal',
  trigger_days_before: 14,
  annual_date: '02-09',
  peak_query_patterns: [
    { query: 'Super Bowl watch party venue {city}', category: 'occasion' },
  ],
  relevant_categories: ['bar', 'pub', 'hookah lounge'],
  is_active: true,
};

const MOCK_SOV_RESULTS: SOVQueryResult[] = [
  {
    queryId: 'q1',
    queryText: 'romantic dinner Alpharetta',
    queryCategory: 'occasion',
    locationId: 'loc-001',
    ourBusinessCited: false,
    businessesFound: [],
    citationUrl: null,
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function makeMockSupabase(occasions: LocalOccasionRow[] = [], existingDrafts: unknown[] = []) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'local_occasions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: occasions, error: null }),
        };
      }
      if (table === 'content_drafts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: existingDrafts, error: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'draft-new-001' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue('OK');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getDaysUntilPeak tests ──────────────────────────────────────────────

describe('getDaysUntilPeak', () => {
  it('returns correct days for a fixed date in the future', () => {
    // Testing from Jan 1 → Feb 14 = 44 days
    const today = new Date(2026, 0, 1); // Jan 1, 2026
    const days = getDaysUntilPeak(VALENTINES, today);
    expect(days).toBe(44);
  });

  it('returns days to next year when date has passed this year', () => {
    // Testing from Mar 1 → next Feb 14 = ~350 days
    const today = new Date(2026, 2, 1); // Mar 1, 2026
    const days = getDaysUntilPeak(VALENTINES, today);
    expect(days).toBeGreaterThan(300);
    expect(days).toBeLessThan(366);
  });

  it('returns trigger_days_before for evergreen occasions (null annual_date)', () => {
    const today = new Date(2026, 5, 15);
    const days = getDaysUntilPeak(BIRTHDAY, today);
    expect(days).toBe(BIRTHDAY.trigger_days_before);
  });

  it('returns 0 on the exact occasion date', () => {
    const today = new Date(2026, 1, 14); // Feb 14, 2026
    const days = getDaysUntilPeak(VALENTINES, today);
    expect(days).toBe(0);
  });
});

// ── checkOccasionAlerts tests ────────────────────────────────────────────

describe('checkOccasionAlerts', () => {
  it('returns empty alerts when no active occasions exist', async () => {
    const supabase = makeMockSupabase([]);
    const { alerts } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['restaurant'], [], supabase,
    );
    expect(alerts).toEqual([]);
  });

  it('filters out occasions outside trigger window', async () => {
    // Valentine's trigger is 28 days. If we're 300+ days away, it's out of window.
    const farFutureOccasion: LocalOccasionRow = {
      ...VALENTINES,
      annual_date: '12-25', // Christmas — far from a Jan test date
      trigger_days_before: 21,
    };
    const supabase = makeMockSupabase([farFutureOccasion]);

    // Mock today to be far from the occasion
    const { alerts } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['restaurant'], [], supabase,
    );
    // The occasion is hundreds of days away, should not be in alerts
    // (unless today happens to be within 21 days of Dec 25)
    const daysToChristmas = getDaysUntilPeak(farFutureOccasion, new Date());
    if (daysToChristmas > 21) {
      expect(alerts).toEqual([]);
    }
  });

  it('filters out category-irrelevant occasions', async () => {
    // Super Bowl is relevant for bar/pub/hookah — not for coffee shops
    const supabase = makeMockSupabase([SUPER_BOWL]);
    // Make sure the occasion is in-window for the test
    const inWindowSuperBowl: LocalOccasionRow = {
      ...SUPER_BOWL,
      annual_date: null, // make it evergreen so it's always in window
    };
    const supabase2 = makeMockSupabase([inWindowSuperBowl]);

    const { alerts } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['coffee shop', 'bakery'], [], supabase2,
    );
    expect(alerts).toEqual([]);
  });

  it('includes category-relevant occasions', async () => {
    // Birthday is evergreen and relevant for restaurants
    const supabase = makeMockSupabase([BIRTHDAY]);

    const { alerts } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['restaurant'], [], supabase,
    );
    expect(alerts.length).toBe(1);
    expect(alerts[0].occasionName).toBe('Birthday Celebration');
  });

  it('skips occasion when Redis dedup key exists', async () => {
    mockRedisGet.mockResolvedValue('1');
    const supabase = makeMockSupabase([BIRTHDAY]);

    const { alerts, skipped } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['restaurant'], [], supabase,
    );
    expect(alerts).toEqual([]);
    expect(skipped).toBe(1);
  });

  it('proceeds when Redis is unavailable (graceful degradation)', async () => {
    vi.mocked(getRedis).mockImplementation(() => {
      throw new Error('Redis unavailable');
    });
    const supabase = makeMockSupabase([BIRTHDAY]);

    const { alerts } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['restaurant'], [], supabase,
    );
    expect(alerts.length).toBe(1);
  });

  it('sets citedForAnyQuery when SOV results match occasion patterns', async () => {
    const supabase = makeMockSupabase([BIRTHDAY]);
    const sovResults: SOVQueryResult[] = [
      {
        queryId: 'q1',
        queryText: 'best restaurant for birthday dinner Alpharetta',
        queryCategory: 'occasion',
        locationId: 'loc-001',
        ourBusinessCited: true,
        businessesFound: [],
        citationUrl: 'https://yelp.com/test',
      },
    ];

    const { alerts } = await checkOccasionAlerts(
      'org-001', 'loc-001', ['restaurant'], sovResults, supabase,
    );
    expect(alerts.length).toBe(1);
    expect(alerts[0].citedForAnyQuery).toBe(true);
  });
});

// ── generateOccasionDraft tests ──────────────────────────────────────────

describe('generateOccasionDraft', () => {
  it('creates draft when all conditions are met (mock mode)', async () => {
    const alert = {
      occasionId: 'occ-birthday',
      occasionName: 'Birthday Celebration',
      occasionType: 'recurring',
      daysUntilPeak: 14,
      peakQueryPatterns: [{ query: 'birthday dinner {city}', category: 'occasion' }],
      citedForAnyQuery: false,
      autoDraftTriggered: false,
      autoDraftId: null,
    };
    const supabase = makeMockSupabase([], []);

    const result = await generateOccasionDraft(
      alert, 'org-001', 'loc-001', 'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.triggered).toBe(true);
    expect(result.draftId).toBe('draft-new-001');
  });

  it('skips draft when daysUntilPeak > 21', async () => {
    const alert = {
      occasionId: 'occ-valentines',
      occasionName: "Valentine's Day",
      occasionType: 'holiday',
      daysUntilPeak: 25,
      peakQueryPatterns: [],
      citedForAnyQuery: false,
      autoDraftTriggered: false,
      autoDraftId: null,
    };
    const supabase = makeMockSupabase();

    const result = await generateOccasionDraft(
      alert, 'org-001', 'loc-001', 'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.triggered).toBe(false);
  });

  it('skips draft when business is already cited', async () => {
    const alert = {
      occasionId: 'occ-birthday',
      occasionName: 'Birthday Celebration',
      occasionType: 'recurring',
      daysUntilPeak: 14,
      peakQueryPatterns: [],
      citedForAnyQuery: true,
      autoDraftTriggered: false,
      autoDraftId: null,
    };
    const supabase = makeMockSupabase();

    const result = await generateOccasionDraft(
      alert, 'org-001', 'loc-001', 'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.triggered).toBe(false);
  });

  it('skips draft when existing draft found (idempotency)', async () => {
    const alert = {
      occasionId: 'occ-birthday',
      occasionName: 'Birthday Celebration',
      occasionType: 'recurring',
      daysUntilPeak: 14,
      peakQueryPatterns: [],
      citedForAnyQuery: false,
      autoDraftTriggered: false,
      autoDraftId: null,
    };
    const supabase = makeMockSupabase([], [{ id: 'existing-draft' }]);

    const result = await generateOccasionDraft(
      alert, 'org-001', 'loc-001', 'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.triggered).toBe(false);
  });

  it('uses real AI when API key is present', async () => {
    vi.mocked(hasApiKey).mockReturnValue(true);
    vi.mocked(generateText).mockResolvedValue({
      text: JSON.stringify({
        title: 'Charcoal N Chill — Birthday Party in Alpharetta',
        content: 'Celebrate your birthday at Charcoal N Chill...',
        estimated_aeo_score: 82,
        target_keywords: ['birthday dinner Alpharetta', 'birthday party venue'],
      }),
    } as never);

    const alert = {
      occasionId: 'occ-birthday',
      occasionName: 'Birthday Celebration',
      occasionType: 'recurring',
      daysUntilPeak: 14,
      peakQueryPatterns: [{ query: 'birthday dinner {city}', category: 'occasion' }],
      citedForAnyQuery: false,
      autoDraftTriggered: false,
      autoDraftId: null,
    };
    const supabase = makeMockSupabase([], []);

    const result = await generateOccasionDraft(
      alert, 'org-001', 'loc-001', 'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.triggered).toBe(true);
    expect(vi.mocked(generateText)).toHaveBeenCalled();
  });
});

// ── runOccasionScheduler tests ──────────────────────────────────────────

describe('runOccasionScheduler', () => {
  it('returns zero counts when no occasions are active', async () => {
    const supabase = makeMockSupabase([]);

    const result = await runOccasionScheduler(
      'org-001', 'loc-001', ['restaurant'], 'growth', [],
      'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.alertsFired).toBe(0);
    expect(result.draftsCreated).toBe(0);
  });

  it('generates drafts for growth plan', async () => {
    const supabase = makeMockSupabase([BIRTHDAY], []);

    const result = await runOccasionScheduler(
      'org-001', 'loc-001', ['restaurant'], 'growth', MOCK_SOV_RESULTS,
      'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.alertsFired).toBe(1);
    expect(result.draftsCreated).toBe(1);
  });

  it('does not generate drafts for starter plan', async () => {
    const supabase = makeMockSupabase([BIRTHDAY], []);

    const result = await runOccasionScheduler(
      'org-001', 'loc-001', ['restaurant'], 'starter', MOCK_SOV_RESULTS,
      'Charcoal N Chill', 'Alpharetta', 'GA', 'restaurant', supabase,
    );
    expect(result.alertsFired).toBe(1);
    expect(result.draftsCreated).toBe(0);
  });
});
