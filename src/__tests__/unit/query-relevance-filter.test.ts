// ---------------------------------------------------------------------------
// query-relevance-filter.test.ts — Ground Truth Relevance Filter
//
// Tests scoreQueryRelevance() against Charcoal N Chill golden tenant:
//   Hours: Tue–Sun 5pm–1/2am, Mon closed
//   Amenities: alcohol ✓, hookah ✓, live music ✓, DJ ✓, private rooms ✓,
//              outdoor seating ✗, kid-friendly ✗
//   Categories: Hookah Bar, Indian Restaurant, Fusion Restaurant, Lounge
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  scoreQueryRelevance,
  scoreQueriesBatch,
  filterRelevantQueries,
} from '@/lib/relevance';
import type { QueryInput, BusinessGroundTruth } from '@/lib/relevance';
import { GOLDEN_TENANT } from '@/__fixtures__/golden-tenant';

// ── Build ground truth from golden tenant ───────────────────────────────────

const CNC_GROUND_TRUTH: BusinessGroundTruth = {
  hoursData: GOLDEN_TENANT.location.hours_data as BusinessGroundTruth['hoursData'],
  amenities: GOLDEN_TENANT.location.amenities as BusinessGroundTruth['amenities'],
  categories: GOLDEN_TENANT.location.categories as unknown as string[],
  operationalStatus: GOLDEN_TENANT.location.operational_status,
};

function q(text: string, category: QueryInput['queryCategory'] = 'discovery'): QueryInput {
  return { queryText: text, queryCategory: category };
}

// ── Time-of-Day Filtering ───────────────────────────────────────────────────

describe('scoreQueryRelevance — Time-of-Day', () => {
  it('rejects "brunch" — CNC opens at 17:00, brunch requires before 12:00', () => {
    const result = scoreQueryRelevance(q('best brunch spots this weekend'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.relevant).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.groundTruthFields).toContain('hoursData');
    expect(result.reason).toContain('brunch');
  });

  it('rejects "breakfast" — CNC opens at 17:00, breakfast requires before 10:00', () => {
    const result = scoreQueryRelevance(q('best breakfast Alpharetta'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.relevant).toBe(false);
    expect(result.reason).toContain('breakfast');
  });

  it('rejects "lunch" — CNC opens at 17:00, lunch requires before 13:00', () => {
    const result = scoreQueryRelevance(q('lunch specials near me', 'near_me'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.relevant).toBe(false);
    expect(result.reason).toContain('lunch');
  });

  it('accepts "late night" — CNC open until 01:00/02:00', () => {
    const result = scoreQueryRelevance(q('late night dining options'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
    expect(result.relevant).toBe(true);
  });

  it('accepts brunch for a business that opens at 10:00', () => {
    const brunchPlace: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      hoursData: {
        saturday: { open: '10:00', close: '15:00' },
        sunday: { open: '10:00', close: '15:00' },
      },
    };
    const result = scoreQueryRelevance(q('best brunch spots'), brunchPlace);
    expect(result.verdict).toBe('relevant');
  });

  it('skips time check when hoursData is null — defaults to relevant', () => {
    const noHours: BusinessGroundTruth = { ...CNC_GROUND_TRUTH, hoursData: null };
    const result = scoreQueryRelevance(q('best brunch spots'), noHours);
    // Can't determine — should not reject
    expect(result.verdict).not.toBe('not_applicable');
  });

  it('handles all-closed hours gracefully', () => {
    const allClosed: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      hoursData: {
        monday: 'closed',
        tuesday: 'closed',
        wednesday: 'closed',
        thursday: 'closed',
        friday: 'closed',
        saturday: 'closed',
        sunday: 'closed',
      },
    };
    const result = scoreQueryRelevance(q('best brunch spots'), allClosed);
    expect(result.verdict).toBe('not_applicable');
  });
});

// ── Amenity Filtering ───────────────────────────────────────────────────────

describe('scoreQueryRelevance — Amenities', () => {
  it('rejects "outdoor seating" — CNC has_outdoor_seating: false', () => {
    const result = scoreQueryRelevance(q('restaurant with outdoor seating'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.relevant).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.groundTruthFields).toContain('amenities');
    expect(result.reason).toContain('outdoor seating');
  });

  it('rejects "patio" — maps to has_outdoor_seating: false', () => {
    const result = scoreQueryRelevance(q('restaurants with patio near me', 'near_me'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.reason).toContain('patio');
  });

  it('rejects "family friendly" — CNC is_kid_friendly: false', () => {
    const result = scoreQueryRelevance(q('family friendly dining options'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.reason).toContain('family friendly');
  });

  it('rejects "kids menu" — maps to is_kid_friendly: false', () => {
    const result = scoreQueryRelevance(q('restaurant with kids menu'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
  });

  it('accepts "hookah" — CNC has_hookah: true', () => {
    const result = scoreQueryRelevance(q('hookah bar near me', 'near_me'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.reason).toContain('hookah');
    expect(result.suggestedAction).toBeDefined();
    expect(result.suggestedAction!.type).toBe('content_draft');
  });

  it('accepts "live music" — CNC has_live_music: true', () => {
    const result = scoreQueryRelevance(q('live music restaurant Alpharetta'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
    expect(result.reason).toContain('live music');
  });

  it('accepts "private events" — CNC has_private_rooms: true', () => {
    const result = scoreQueryRelevance(q('private events near me', 'near_me'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
    expect(result.reason).toContain('private event');
  });

  it('accepts "reservation" — CNC takes_reservations: true', () => {
    const result = scoreQueryRelevance(q('restaurant with reservation'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
  });

  it('skips amenity check when amenities is null — defaults to relevant', () => {
    const noAmenities: BusinessGroundTruth = { ...CNC_GROUND_TRUTH, amenities: null };
    const result = scoreQueryRelevance(q('restaurant with outdoor seating'), noAmenities);
    expect(result.verdict).not.toBe('not_applicable');
  });

  it('handles undefined amenity value — falls through to default', () => {
    const partialAmenities: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      amenities: {
        has_outdoor_seating: false,
        serves_alcohol: true,
        has_hookah: true,
        is_kid_friendly: false,
        takes_reservations: true,
        has_live_music: true,
        // has_dj is undefined — not set
      },
    };
    // "dj night" maps to has_dj which is undefined
    const result = scoreQueryRelevance(q('dj night venue Alpharetta'), partialAmenities);
    // Should NOT reject — undefined means we don't know
    expect(result.verdict).not.toBe('not_applicable');
  });
});

// ── Service Keywords ────────────────────────────────────────────────────────

describe('scoreQueryRelevance — Services', () => {
  it('marks "catering" as aspirational — CNC categories do not include catering', () => {
    const result = scoreQueryRelevance(q('catering services for corporate events'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('aspirational');
    expect(result.relevant).toBe(false);
    expect(result.confidence).toBe('medium');
    expect(result.reason).toContain('catering');
  });

  it('marks "delivery" as aspirational — CNC categories do not include delivery', () => {
    const result = scoreQueryRelevance(q('food delivery near me', 'near_me'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('aspirational');
    expect(result.reason).toContain('delivery');
  });

  it('accepts "catering" if categories include it', () => {
    const caterer: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      categories: ['Restaurant', 'Catering Service'],
    };
    const result = scoreQueryRelevance(q('catering services'), caterer);
    expect(result.verdict).toBe('relevant');
  });
});

// ── Comparison & Custom Queries ─────────────────────────────────────────────

describe('scoreQueryRelevance — Always Relevant', () => {
  it('comparison queries are always relevant', () => {
    const result = scoreQueryRelevance(
      q('Charcoal N Chill vs Cloud 9 Lounge', 'comparison'),
      CNC_GROUND_TRUTH,
    );
    expect(result.verdict).toBe('relevant');
    expect(result.confidence).toBe('high');
  });

  it('custom queries are always relevant', () => {
    const result = scoreQueryRelevance(
      q('anything goes here', 'custom'),
      CNC_GROUND_TRUTH,
    );
    expect(result.verdict).toBe('relevant');
    expect(result.confidence).toBe('high');
  });
});

// ── Operational Status ──────────────────────────────────────────────────────

describe('scoreQueryRelevance — Operational Status', () => {
  it('rejects all queries for temporarily closed business', () => {
    const closed: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      operationalStatus: 'TEMPORARILY_CLOSED',
    };
    const result = scoreQueryRelevance(q('best hookah bar Alpharetta'), closed);
    expect(result.verdict).toBe('not_applicable');
    expect(result.reason).toContain('temporarily closed');
  });

  it('rejects all queries for permanently closed business', () => {
    const closed: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      operationalStatus: 'PERMANENTLY_CLOSED',
    };
    const result = scoreQueryRelevance(q('hookah bar near me', 'near_me'), closed);
    expect(result.verdict).toBe('not_applicable');
  });

  it('accepts queries for OPERATIONAL business', () => {
    const result = scoreQueryRelevance(q('hookah bar near me', 'near_me'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
  });

  it('accepts queries when operational status is null', () => {
    const noStatus: BusinessGroundTruth = { ...CNC_GROUND_TRUTH, operationalStatus: null };
    const result = scoreQueryRelevance(q('hookah bar near me', 'near_me'), noStatus);
    expect(result.verdict).not.toBe('not_applicable');
  });
});

// ── Default Behavior ────────────────────────────────────────────────────────

describe('scoreQueryRelevance — Default', () => {
  it('returns relevant with low confidence for generic queries', () => {
    const result = scoreQueryRelevance(q('best restaurant Alpharetta'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
    expect(result.relevant).toBe(true);
    expect(result.confidence).toBe('low');
  });

  it('returns relevant for queries with no matching patterns', () => {
    const result = scoreQueryRelevance(q('romantic restaurant Alpharetta', 'occasion'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
  });

  it('provides a suggested action for generic relevant queries', () => {
    const result = scoreQueryRelevance(q('best Indian restaurant Alpharetta'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
    expect(result.suggestedAction).toBeDefined();
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────────────

describe('scoreQueryRelevance — Edge Cases', () => {
  it('handles completely null ground truth — all queries relevant', () => {
    const empty: BusinessGroundTruth = {
      hoursData: null,
      amenities: null,
      categories: null,
      operationalStatus: null,
    };
    const result = scoreQueryRelevance(q('best brunch spots'), empty);
    expect(result.verdict).toBe('relevant');
    expect(result.confidence).toBe('low');
  });

  it('handles empty query text — returns relevant', () => {
    const result = scoreQueryRelevance(q(''), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
  });

  it('is case-insensitive for keyword matching', () => {
    const result = scoreQueryRelevance(q('Best BRUNCH Spots This Weekend'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
  });

  it('matches partial keywords in longer queries', () => {
    const result = scoreQueryRelevance(
      q('where can I find a restaurant with great outdoor seating area'),
      CNC_GROUND_TRUTH,
    );
    expect(result.verdict).toBe('not_applicable');
  });

  it('time check takes priority over amenity check (first match wins)', () => {
    // "family friendly brunch" — brunch is rejected by time before family-friendly check
    const result = scoreQueryRelevance(q('family friendly brunch spot'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('not_applicable');
    expect(result.reason).toContain('brunch');
  });

  it('handles hours with malformed time strings gracefully', () => {
    const badHours: BusinessGroundTruth = {
      ...CNC_GROUND_TRUTH,
      hoursData: { monday: { open: 'invalid', close: 'bad' } },
    };
    // Should not crash — bad times are skipped
    const result = scoreQueryRelevance(q('best brunch spots'), badHours);
    // Can't determine from bad data, so rejects (no valid day open before 12:00)
    expect(result.verdict).toBe('not_applicable');
  });

  it('wrapping hours (close < open) counts as late-night', () => {
    // CNC closes at 01:00/02:00 — close < open means wrapping past midnight
    const result = scoreQueryRelevance(q('late night dining options'), CNC_GROUND_TRUTH);
    expect(result.verdict).toBe('relevant');
  });
});

// ── Batch Helpers ───────────────────────────────────────────────────────────

describe('scoreQueriesBatch', () => {
  it('returns a result for each query', () => {
    const queries = [
      q('best brunch spots'),
      q('hookah bar near me', 'near_me'),
      q('outdoor seating restaurant'),
    ];
    const results = scoreQueriesBatch(queries, CNC_GROUND_TRUTH);
    expect(results.size).toBe(3);
    expect(results.get('best brunch spots')!.verdict).toBe('not_applicable');
    expect(results.get('hookah bar near me')!.verdict).toBe('relevant');
    expect(results.get('outdoor seating restaurant')!.verdict).toBe('not_applicable');
  });
});

describe('filterRelevantQueries', () => {
  it('removes not_applicable, keeps relevant and aspirational', () => {
    const queries = [
      q('best brunch spots'),                        // not_applicable (time)
      q('hookah bar near me', 'near_me'),            // relevant (amenity)
      q('catering services for corporate events'),   // aspirational (service)
      q('outdoor seating restaurant'),               // not_applicable (amenity)
      q('best Indian restaurant Alpharetta'),        // relevant (default)
    ];
    const filtered = filterRelevantQueries(queries, CNC_GROUND_TRUTH);
    expect(filtered).toHaveLength(3);
    expect(filtered.map((q) => q.queryText)).toEqual([
      'hookah bar near me',
      'catering services for corporate events',
      'best Indian restaurant Alpharetta',
    ]);
  });

  it('returns all queries when ground truth is null', () => {
    const empty: BusinessGroundTruth = {
      hoursData: null,
      amenities: null,
      categories: null,
      operationalStatus: null,
    };
    const queries = [q('brunch'), q('hookah'), q('outdoor')];
    const filtered = filterRelevantQueries(queries, empty);
    expect(filtered).toHaveLength(3);
  });
});

// ── Charcoal N Chill Full Scenario ──────────────────────────────────────────

describe('scoreQueryRelevance — CNC Full Scenario', () => {
  const scenarios: [string, string, QueryInput['queryCategory']][] = [
    ['not_applicable', 'best brunch spots this weekend', 'discovery'],
    ['not_applicable', 'family friendly dining options', 'discovery'],
    ['not_applicable', 'restaurant with outdoor seating', 'near_me'],
    ['not_applicable', 'best breakfast Alpharetta', 'discovery'],
    ['not_applicable', 'lunch specials near me', 'near_me'],
    ['not_applicable', 'kids menu restaurant', 'discovery'],
    ['aspirational', 'catering services for corporate events', 'discovery'],
    ['aspirational', 'food delivery near me', 'near_me'],
    ['relevant', 'hookah bar near me', 'near_me'],
    ['relevant', 'late night dining options', 'discovery'],
    ['relevant', 'private events near me', 'near_me'],
    ['relevant', 'live music restaurant Alpharetta', 'discovery'],
    ['relevant', 'best Indian restaurant Alpharetta', 'discovery'],
    ['relevant', 'birthday dinner Alpharetta', 'occasion'],
    ['relevant', 'Charcoal N Chill vs Cloud 9 Lounge', 'comparison'],
  ];

  it.each(scenarios)('"%s" for "%s" (%s)', (expected, queryText, category) => {
    const result = scoreQueryRelevance(
      { queryText, queryCategory: category },
      CNC_GROUND_TRUTH,
    );
    expect(result.verdict).toBe(expected);
  });
});
