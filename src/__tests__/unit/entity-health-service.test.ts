// ---------------------------------------------------------------------------
// entity-health-service.test.ts — Unit tests for Entity Health service
//
// Sprint 80: 27 tests — pure functions, no mocks needed.
//
// Run:
//   npx vitest run src/__tests__/unit/entity-health-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  computeEntityHealth,
  ENTITY_PLATFORM_REGISTRY,
  type EntityCheckRow,
} from '@/lib/services/entity-health.service';
import { MOCK_ENTITY_CHECK } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheck(overrides: Partial<EntityCheckRow> = {}): EntityCheckRow {
  return {
    google_knowledge_panel: 'unchecked',
    google_business_profile: 'unchecked',
    yelp: 'unchecked',
    tripadvisor: 'unchecked',
    apple_maps: 'unchecked',
    bing_places: 'unchecked',
    wikidata: 'unchecked',
    platform_metadata: {},
    ...overrides,
  };
}

function makeAllConfirmed(): EntityCheckRow {
  return makeCheck({
    google_knowledge_panel: 'confirmed',
    google_business_profile: 'confirmed',
    yelp: 'confirmed',
    tripadvisor: 'confirmed',
    apple_maps: 'confirmed',
    bing_places: 'confirmed',
    wikidata: 'unchecked',
  });
}

function makeAllMissing(): EntityCheckRow {
  return makeCheck({
    google_knowledge_panel: 'missing',
    google_business_profile: 'missing',
    yelp: 'missing',
    tripadvisor: 'missing',
    apple_maps: 'missing',
    bing_places: 'missing',
    wikidata: 'missing',
  });
}

// ---------------------------------------------------------------------------
// computeEntityHealth — Score computation
// ---------------------------------------------------------------------------

describe('computeEntityHealth', () => {
  describe('Score computation', () => {
    it('1. scores 100 when all 6 core platforms confirmed', () => {
      const result = computeEntityHealth(makeAllConfirmed());
      expect(result.score).toBe(100);
    });

    it('2. scores 50 when 3 of 6 confirmed', () => {
      const check = makeCheck({
        google_knowledge_panel: 'confirmed',
        google_business_profile: 'confirmed',
        yelp: 'confirmed',
      });
      const result = computeEntityHealth(check);
      expect(result.score).toBe(50);
    });

    it('3. scores 0 when none confirmed', () => {
      const result = computeEntityHealth(makeAllMissing());
      expect(result.score).toBe(0);
    });

    it('4. excludes wikidata from score denominator', () => {
      const result = computeEntityHealth(makeAllConfirmed());
      expect(result.totalPlatforms).toBe(6);
    });

    it('5. wikidata=confirmed does not increase score above 6-platform cap', () => {
      const check = makeAllConfirmed();
      check.wikidata = 'confirmed';
      const result = computeEntityHealth(check);
      expect(result.score).toBe(100);
      expect(result.confirmedCount).toBe(6); // still 6, not 7
    });
  });

  // ---------------------------------------------------------------------------
  // Rating
  // ---------------------------------------------------------------------------

  describe('Rating', () => {
    it('6. returns strong when 5+ platforms confirmed', () => {
      const check = makeCheck({
        google_knowledge_panel: 'confirmed',
        google_business_profile: 'confirmed',
        yelp: 'confirmed',
        tripadvisor: 'confirmed',
        apple_maps: 'confirmed',
      });
      const result = computeEntityHealth(check);
      expect(result.rating).toBe('strong');
    });

    it('7. returns at_risk when 3-4 platforms confirmed', () => {
      const check = makeCheck({
        google_knowledge_panel: 'confirmed',
        google_business_profile: 'confirmed',
        yelp: 'confirmed',
      });
      const result = computeEntityHealth(check);
      expect(result.rating).toBe('at_risk');
    });

    it('8. returns critical when 0-2 platforms confirmed', () => {
      const check = makeCheck({
        google_knowledge_panel: 'confirmed',
        google_business_profile: 'missing',
      });
      const result = computeEntityHealth(check);
      expect(result.rating).toBe('critical');
    });

    it('9. returns unknown when all platforms are unchecked', () => {
      const result = computeEntityHealth(makeCheck());
      expect(result.rating).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // Platforms
  // ---------------------------------------------------------------------------

  describe('Platforms', () => {
    it('10. returns all 7 platforms in result', () => {
      const result = computeEntityHealth(makeCheck());
      expect(result.platforms).toHaveLength(7);
    });

    it('11. maps each platform to its registry info', () => {
      const result = computeEntityHealth(makeCheck());
      const keys = result.platforms.map((p) => p.info.key);
      expect(keys).toContain('google_knowledge_panel');
      expect(keys).toContain('wikidata');
    });

    it('12. includes status from check row', () => {
      const check = makeCheck({ yelp: 'confirmed' });
      const result = computeEntityHealth(check);
      const yelp = result.platforms.find((p) => p.info.key === 'yelp');
      expect(yelp!.status).toBe('confirmed');
    });

    it('13. includes metadata from platform_metadata JSONB', () => {
      const check = makeCheck({
        google_knowledge_panel: 'confirmed',
        platform_metadata: { google_knowledge_panel: { place_id: 'ChIJtest' } },
      });
      const result = computeEntityHealth(check);
      const gkp = result.platforms.find((p) => p.info.key === 'google_knowledge_panel');
      expect(gkp!.metadata).toEqual({ place_id: 'ChIJtest' });
    });
  });

  // ---------------------------------------------------------------------------
  // Recommendations
  // ---------------------------------------------------------------------------

  describe('Recommendations', () => {
    it('14. recommends missing platforms with claim guide', () => {
      const check = makeCheck({ tripadvisor: 'missing' });
      const result = computeEntityHealth(check);
      const rec = result.recommendations.find((r) => r.platform === 'tripadvisor');
      expect(rec).toBeDefined();
      expect(rec!.action).toContain('Claim');
    });

    it('15. recommends incomplete platforms with fix action', () => {
      const check = makeCheck({ bing_places: 'incomplete' });
      const result = computeEntityHealth(check);
      const rec = result.recommendations.find((r) => r.platform === 'bing_places');
      expect(rec).toBeDefined();
      expect(rec!.action).toContain('Complete');
    });

    it('16. recommends unchecked platforms with check action', () => {
      const check = makeCheck({ apple_maps: 'unchecked' });
      const result = computeEntityHealth(check);
      const rec = result.recommendations.find((r) => r.platform === 'apple_maps');
      expect(rec).toBeDefined();
      expect(rec!.action).toContain('Check');
    });

    it('17. does not recommend confirmed platforms', () => {
      const check = makeCheck({ google_knowledge_panel: 'confirmed' });
      const result = computeEntityHealth(check);
      const rec = result.recommendations.find((r) => r.platform === 'google_knowledge_panel');
      expect(rec).toBeUndefined();
    });

    it('18. sorts recommendations by priority descending', () => {
      const check = makeCheck({
        wikidata: 'missing',       // priority 3
        tripadvisor: 'missing',    // priority 7
        yelp: 'missing',           // priority 9
      });
      const result = computeEntityHealth(check);
      const priorities = result.recommendations.map((r) => r.priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]!);
      }
    });

    it('19. includes claimUrl in each recommendation', () => {
      const result = computeEntityHealth(makeCheck());
      for (const rec of result.recommendations) {
        expect(rec.claimUrl).toBeTruthy();
        expect(rec.claimUrl.startsWith('https://')).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('Edge cases', () => {
    it('20. uses MOCK_ENTITY_CHECK and produces score=50, rating=at_risk', () => {
      const result = computeEntityHealth(MOCK_ENTITY_CHECK);
      expect(result.score).toBe(50);
      expect(result.rating).toBe('at_risk');
    });

    it('21. handles all confirmed (no recommendations for core platforms)', () => {
      const result = computeEntityHealth(makeAllConfirmed());
      // Only wikidata should remain as recommendation (it's unchecked)
      const coreRecs = result.recommendations.filter((r) => r.platform !== 'wikidata');
      expect(coreRecs).toHaveLength(0);
    });

    it('22. handles all missing (6 recommendations for core platforms)', () => {
      const result = computeEntityHealth(makeAllMissing());
      expect(result.recommendations.length).toBeGreaterThanOrEqual(6);
    });

    it('23. handles incomplete status correctly (different action text than missing)', () => {
      const checkIncomplete = makeCheck({ bing_places: 'incomplete' });
      const checkMissing = makeCheck({ bing_places: 'missing' });
      const resultIncomplete = computeEntityHealth(checkIncomplete);
      const resultMissing = computeEntityHealth(checkMissing);
      const incRec = resultIncomplete.recommendations.find((r) => r.platform === 'bing_places');
      const misRec = resultMissing.recommendations.find((r) => r.platform === 'bing_places');
      expect(incRec!.action).not.toBe(misRec!.action);
    });
  });
});

// ---------------------------------------------------------------------------
// ENTITY_PLATFORM_REGISTRY
// ---------------------------------------------------------------------------

describe('ENTITY_PLATFORM_REGISTRY', () => {
  it('24. has exactly 7 platforms', () => {
    expect(ENTITY_PLATFORM_REGISTRY).toHaveLength(7);
  });

  it('25. each platform has non-empty label, description, aiImpact, claimGuide, claimUrl', () => {
    for (const platform of ENTITY_PLATFORM_REGISTRY) {
      expect(platform.label.length).toBeGreaterThan(0);
      expect(platform.description.length).toBeGreaterThan(0);
      expect(platform.aiImpact.length).toBeGreaterThan(0);
      expect(platform.claimGuide.length).toBeGreaterThan(0);
      expect(platform.claimUrl.length).toBeGreaterThan(0);
    }
  });

  it('26. google_knowledge_panel and google_business_profile are autoDetectable', () => {
    const gkp = ENTITY_PLATFORM_REGISTRY.find((p) => p.key === 'google_knowledge_panel');
    const gbp = ENTITY_PLATFORM_REGISTRY.find((p) => p.key === 'google_business_profile');
    expect(gkp!.autoDetectable).toBe(true);
    expect(gbp!.autoDetectable).toBe(true);
  });

  it('27. yelp through wikidata are not autoDetectable', () => {
    const nonAuto = ['yelp', 'tripadvisor', 'apple_maps', 'bing_places', 'wikidata'];
    for (const key of nonAuto) {
      const platform = ENTITY_PLATFORM_REGISTRY.find((p) => p.key === key);
      expect(platform!.autoDetectable).toBe(false);
    }
  });
});
