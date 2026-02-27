// ---------------------------------------------------------------------------
// cron-citation.test.ts — SUPERSEDED by citation-cron-tenant.test.ts
//
// The citation cron route was rewritten in Sprint 97 to be tenant-derived
// (deriving category+metro pairs from real org data instead of hardcoded
// TRACKED_CATEGORIES × TRACKED_METROS arrays).
//
// All tests for the new route are in citation-cron-tenant.test.ts.
//
// This file retains a single smoke test to verify the old import paths
// still resolve (the citation-engine.service.ts still exports the constants
// for use in other contexts like calculateCitationGapScore).
//
// Run: npx vitest run src/__tests__/unit/cron-citation.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  TRACKED_CATEGORIES,
  TRACKED_METROS,
  extractPlatform,
  calculateCitationGapScore,
} from '@/lib/services/citation-engine.service';

describe('citation-engine.service — Legacy Constants & Gap Score', () => {
  it('TRACKED_CATEGORIES still exports 9 categories', () => {
    expect(TRACKED_CATEGORIES.length).toBe(9);
    expect(TRACKED_CATEGORIES).toContain('hookah lounge');
  });

  it('TRACKED_METROS still exports 20 metros', () => {
    expect(TRACKED_METROS.length).toBe(20);
    expect(TRACKED_METROS[0]).toEqual({ city: 'Atlanta', state: 'GA' });
  });

  it('extractPlatform maps yelp.com correctly', () => {
    expect(extractPlatform('https://www.yelp.com/biz/test')).toBe('yelp');
  });

  it('extractPlatform returns null for malformed URL', () => {
    expect(extractPlatform('')).toBeNull();
  });

  it('calculateCitationGapScore returns 100 for no relevant platforms', () => {
    const result = calculateCitationGapScore([], []);
    expect(result.gapScore).toBe(100);
  });

  it('calculateCitationGapScore calculates gap from coverage', () => {
    const platforms = [
      { id: '1', business_category: 'hookah lounge', city: 'Atlanta', state: 'GA', platform: 'yelp', citation_frequency: 0.8, sample_query: 'test', sample_size: 5, model_provider: 'perplexity-sonar', measured_at: '2026-01-01' },
      { id: '2', business_category: 'hookah lounge', city: 'Atlanta', state: 'GA', platform: 'google', citation_frequency: 0.6, sample_query: 'test', sample_size: 5, model_provider: 'perplexity-sonar', measured_at: '2026-01-01' },
    ];
    const listings = [
      { directory: 'yelp', sync_status: 'synced' },
    ];
    const result = calculateCitationGapScore(platforms, listings);
    expect(result.gapScore).toBe(50); // 1 of 2 platforms covered
    expect(result.platformsCovered).toBe(1);
    expect(result.platformsThatMatter).toBe(2);
    expect(result.topGap?.platform).toBe('google');
  });
});
