// ---------------------------------------------------------------------------
// Unit tests — lib/authority/authority-recommendations.ts
//
// 15 tests covering all three exported pure functions.
// No I/O, no mocks needed.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  generateRecommendations,
  buildTier1CitationRecommendation,
  buildVelocityDecayRecommendation,
} from '@/lib/authority/authority-recommendations';
import type {
  EntityAuthorityProfile,
  SameAsGap,
  AuthorityDimensions,
} from '@/lib/authority/types';
import type { GroundTruth } from '@/lib/nap-sync/types';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeGroundTruth(overrides?: Partial<GroundTruth>): GroundTruth {
  return {
    location_id: 'loc_001',
    org_id: 'org_001',
    name: 'Test Restaurant',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    phone: '512-555-0100',
    ...overrides,
  };
}

function makeDimensions(overrides?: Partial<AuthorityDimensions>): AuthorityDimensions {
  return {
    tier1_citation_score: 25,
    tier2_coverage_score: 20,
    platform_breadth_score: 16,
    sameas_score: 12,
    velocity_score: 8,
    ...overrides,
  };
}

function makeProfile(
  overrides?: Partial<Omit<EntityAuthorityProfile, 'recommendations'>>,
): Omit<EntityAuthorityProfile, 'recommendations'> {
  return {
    location_id: 'loc_001',
    org_id: 'org_001',
    entity_authority_score: 72,
    dimensions: makeDimensions(),
    tier_breakdown: { tier1: 3, tier2: 5, tier3: 8, unknown: 1 },
    top_citations: [],
    sameas_gaps: [],
    citation_velocity: 5,
    velocity_label: 'growing',
    snapshot_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeGap(overrides?: Partial<SameAsGap>): SameAsGap {
  return {
    url: 'https://yelp.com/biz/test',
    platform: 'yelp',
    tier: 'tier2',
    estimated_impact: 'high',
    action_label: 'Add Yelp sameAs',
    action_instructions: 'Add your Yelp URL to schema markup.',
    already_in_schema: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildTier1CitationRecommendation
// ---------------------------------------------------------------------------

describe('buildTier1CitationRecommendation', () => {
  it('returns priority 1 with category tier1_citation', () => {
    const rec = buildTier1CitationRecommendation();
    expect(rec.priority).toBe(1);
    expect(rec.category).toBe('tier1_citation');
    expect(rec.estimated_score_gain).toBe(22);
    expect(rec.effort).toBe('high');
    expect(rec.action_type).toBe('outreach');
  });

  it('uses city from groundTruth in the title', () => {
    const gt = makeGroundTruth({ city: 'Portland' });
    const rec = buildTier1CitationRecommendation(gt, 0);
    expect(rec.title).toBe('Get featured in Portland local press');
  });

  it('falls back to "your city" when groundTruth is undefined', () => {
    const rec = buildTier1CitationRecommendation(undefined, 0);
    expect(rec.title).toBe('Get featured in your city local press');
  });
});

// ---------------------------------------------------------------------------
// buildVelocityDecayRecommendation
// ---------------------------------------------------------------------------

describe('buildVelocityDecayRecommendation', () => {
  it('returns priority 1 with category velocity_recovery', () => {
    const rec = buildVelocityDecayRecommendation(-35, 'tier1');
    expect(rec.priority).toBe(1);
    expect(rec.category).toBe('velocity_recovery');
    expect(rec.action_type).toBe('create_content');
  });

  it('includes the absolute velocity percentage in description', () => {
    const rec = buildVelocityDecayRecommendation(-42.7, 'tier1');
    expect(rec.description).toContain('43%');
    expect(rec.description).not.toContain('-43');
  });

  it('has autopilot_trigger set to true', () => {
    const rec = buildVelocityDecayRecommendation(-25, 'tier2');
    expect(rec.autopilot_trigger).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateRecommendations
// ---------------------------------------------------------------------------

describe('generateRecommendations', () => {
  it('returns empty array when all metrics are strong', () => {
    // Strong profile: tier1 > 0, velocity >= -20, platform_breadth >= 12,
    // tier2 >= 3, sameas_score >= 9, no sameAs gaps
    const profile = makeProfile();
    const result = generateRecommendations(profile, []);
    expect(result).toEqual([]);
  });

  it('includes tier1 citation recommendation when tier1 count is 0', () => {
    const profile = makeProfile({
      tier_breakdown: { tier1: 0, tier2: 5, tier3: 8, unknown: 1 },
    });
    const result = generateRecommendations(profile, []);
    const tier1Rec = result.find(r => r.category === 'tier1_citation');
    expect(tier1Rec).toBeDefined();
    expect(tier1Rec!.priority).toBe(1);
    expect(tier1Rec!.estimated_score_gain).toBe(22);
  });

  it('includes velocity decay recommendation when velocity < -20', () => {
    const profile = makeProfile({ citation_velocity: -30 });
    const result = generateRecommendations(profile, []);
    const velocityRec = result.find(r => r.category === 'velocity_recovery');
    expect(velocityRec).toBeDefined();
    expect(velocityRec!.priority).toBe(1);
    expect(velocityRec!.description).toContain('30%');
  });

  it('includes high-impact sameAs gaps as priority 2 recommendations', () => {
    const gaps: SameAsGap[] = [
      makeGap({ platform: 'yelp', estimated_impact: 'high', already_in_schema: false }),
      makeGap({ platform: 'tripadvisor', estimated_impact: 'high', already_in_schema: false, url: 'https://tripadvisor.com/test' }),
    ];
    const profile = makeProfile();
    const result = generateRecommendations(profile, gaps);
    const sameAsRecs = result.filter(r => r.category === 'sameas' && r.priority === 2);
    expect(sameAsRecs).toHaveLength(2);
    expect(sameAsRecs[0].action_type).toBe('add_sameas');
  });

  it('gives wikidata/wikipedia gaps 8 points and others 5 points', () => {
    const gaps: SameAsGap[] = [
      makeGap({ platform: 'wikidata', estimated_impact: 'high', url: 'https://wikidata.org/entity/Q123', action_label: 'Add Wikidata sameAs' }),
      makeGap({ platform: 'wikipedia', estimated_impact: 'high', url: 'https://en.wikipedia.org/wiki/Test', action_label: 'Add Wikipedia sameAs' }),
      makeGap({ platform: 'yelp', estimated_impact: 'high', url: 'https://yelp.com/biz/test', action_label: 'Add Yelp sameAs' }),
    ];
    const profile = makeProfile();
    const result = generateRecommendations(profile, gaps);
    const sameAsRecs = result.filter(r => r.category === 'sameas' && r.priority === 2);
    expect(sameAsRecs).toHaveLength(3);

    const wikidataRec = sameAsRecs.find(r => r.title === 'Add Wikidata sameAs');
    const wikiRec = sameAsRecs.find(r => r.title === 'Add Wikipedia sameAs');
    const yelpRec = sameAsRecs.find(r => r.title === 'Add Yelp sameAs');
    expect(wikidataRec!.estimated_score_gain).toBe(8);
    expect(wikiRec!.estimated_score_gain).toBe(8);
    expect(yelpRec!.estimated_score_gain).toBe(5);
  });

  it('includes platform breadth recommendation when score < 12', () => {
    const profile = makeProfile({
      dimensions: makeDimensions({ platform_breadth_score: 8 }),
    });
    const result = generateRecommendations(profile, []);
    const breadthRec = result.find(r => r.category === 'platform_breadth');
    expect(breadthRec).toBeDefined();
    expect(breadthRec!.priority).toBe(2);
    expect(breadthRec!.action_type).toBe('claim_listing');
  });

  it('includes tier2 recommendation when tier2 count < 3', () => {
    const profile = makeProfile({
      tier_breakdown: { tier1: 3, tier2: 1, tier3: 8, unknown: 1 },
    });
    const result = generateRecommendations(profile, []);
    const tier2Rec = result.find(r => r.category === 'tier2_listing');
    expect(tier2Rec).toBeDefined();
    expect(tier2Rec!.priority).toBe(3);
    expect(tier2Rec!.action_type).toBe('review_request');
  });

  it('sorts recommendations by priority ASC then estimated_score_gain DESC', () => {
    // Trigger multiple priorities: tier1=0 (P1, 22pts), velocity=-25 (P1, 10pts),
    // platform_breadth=8 (P2, 5pts), tier2=1 (P3, 3pts)
    const profile = makeProfile({
      tier_breakdown: { tier1: 0, tier2: 1, tier3: 8, unknown: 1 },
      citation_velocity: -25,
      dimensions: makeDimensions({ platform_breadth_score: 8 }),
    });
    const result = generateRecommendations(profile, [], makeGroundTruth());

    expect(result.length).toBeGreaterThanOrEqual(4);

    // Priority ordering: all P1 before P2, all P2 before P3
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.priority === curr.priority) {
        expect(prev.estimated_score_gain).toBeGreaterThanOrEqual(curr.estimated_score_gain);
      } else {
        expect(prev.priority).toBeLessThan(curr.priority);
      }
    }

    // Specifically: tier1_citation (P1, 22) comes before velocity_recovery (P1, 10)
    const tier1Idx = result.findIndex(r => r.category === 'tier1_citation');
    const velocityIdx = result.findIndex(r => r.category === 'velocity_recovery');
    expect(tier1Idx).toBeLessThan(velocityIdx);
  });

  it('caps the output at 5 recommendations maximum', () => {
    // Trigger everything: tier1=0 (P1), velocity=-30 (P1), platform_breadth=5 (P2),
    // tier2=0 (P3), sameas_score=5 (P3), plus 3 high-impact sameAs gaps (P2)
    const profile = makeProfile({
      tier_breakdown: { tier1: 0, tier2: 0, tier3: 8, unknown: 1 },
      citation_velocity: -30,
      dimensions: makeDimensions({
        platform_breadth_score: 5,
        sameas_score: 5,
      }),
    });
    const gaps: SameAsGap[] = [
      makeGap({ platform: 'wikidata', estimated_impact: 'high', url: 'https://wikidata.org/Q1' }),
      makeGap({ platform: 'wikipedia', estimated_impact: 'high', url: 'https://en.wikipedia.org/wiki/X' }),
      makeGap({ platform: 'yelp', estimated_impact: 'high', url: 'https://yelp.com/biz/x' }),
      makeGap({ platform: 'foursquare', estimated_impact: 'medium', already_in_schema: false }),
    ];

    const result = generateRecommendations(profile, gaps, makeGroundTruth());

    // Should be exactly 5 even though more conditions triggered
    expect(result).toHaveLength(5);
  });
});
