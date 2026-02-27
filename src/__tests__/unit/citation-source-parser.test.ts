// ---------------------------------------------------------------------------
// citation-source-parser.test.ts — Unit tests for citation source parser
//
// Sprint 97 — Gap #60 (Citation Intelligence Cron)
// Run: npx vitest run src/__tests__/unit/citation-source-parser.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  extractDomain,
  domainToPlatform,
  aggregatePlatformCounts,
  calculateCitationFrequency,
  KNOWN_CITATION_PLATFORMS,
} from '@/lib/citation/citation-source-parser';

// ---------------------------------------------------------------------------
// extractDomain
// ---------------------------------------------------------------------------

describe('extractDomain', () => {
  it('1. extracts root domain from full URL', () => {
    expect(extractDomain('https://www.yelp.com/biz/charcoal-n-chill')).toBe('yelp.com');
  });

  it('2. strips www. prefix', () => {
    expect(extractDomain('https://www.tripadvisor.com/Restaurant')).toBe('tripadvisor.com');
  });

  it('3. strips path and query params', () => {
    expect(extractDomain('https://google.com/maps/place/abc?q=test')).toBe('google.com');
  });

  it('4. handles https and http', () => {
    expect(extractDomain('http://facebook.com/page')).toBe('facebook.com');
    expect(extractDomain('https://facebook.com/page')).toBe('facebook.com');
  });

  it('5. returns empty string for malformed URL', () => {
    expect(extractDomain('not-a-url')).toBe('');
  });

  it('6. returns empty string for empty input', () => {
    expect(extractDomain('')).toBe('');
  });

  it('7. preserves subdomain (maps.google.com)', () => {
    expect(extractDomain('https://maps.google.com/place/abc')).toBe('maps.google.com');
  });
});

// ---------------------------------------------------------------------------
// domainToPlatform
// ---------------------------------------------------------------------------

describe('domainToPlatform', () => {
  it('1. maps yelp.com to "yelp"', () => {
    expect(domainToPlatform('yelp.com')).toBe('yelp');
  });

  it('2. maps maps.google.com to "google"', () => {
    expect(domainToPlatform('maps.google.com')).toBe('google');
  });

  it('3. maps tripadvisor.com to "tripadvisor"', () => {
    expect(domainToPlatform('tripadvisor.com')).toBe('tripadvisor');
  });

  it('4. returns domain as-is for unknown platforms', () => {
    expect(domainToPlatform('unknowndomain.com')).toBe('unknowndomain.com');
  });

  it('5. returns empty string for empty input', () => {
    expect(domainToPlatform('')).toBe('');
  });

  it('6. maps doordash.com to "doordash"', () => {
    expect(domainToPlatform('doordash.com')).toBe('doordash');
  });

  it('7. maps google.com to "google"', () => {
    expect(domainToPlatform('google.com')).toBe('google');
  });
});

// ---------------------------------------------------------------------------
// aggregatePlatformCounts
// ---------------------------------------------------------------------------

describe('aggregatePlatformCounts', () => {
  it('1. returns one count per unique platform', () => {
    const results = [
      { citedUrls: ['https://yelp.com/biz/a', 'https://tripadvisor.com/r'] },
    ];
    const counts = aggregatePlatformCounts(results);
    expect(counts['yelp']).toBe(1);
    expect(counts['tripadvisor']).toBe(1);
  });

  it('2. counts appearances correctly across multiple responses', () => {
    const results = [
      { citedUrls: ['https://yelp.com/a'] },
      { citedUrls: ['https://yelp.com/b'] },
      { citedUrls: ['https://yelp.com/c'] },
    ];
    const counts = aggregatePlatformCounts(results);
    expect(counts['yelp']).toBe(3);
  });

  it('3. handles empty citations array', () => {
    const counts = aggregatePlatformCounts([{ citedUrls: [] }]);
    expect(Object.keys(counts).length).toBe(0);
  });

  it('4. handles empty input array', () => {
    const counts = aggregatePlatformCounts([]);
    expect(Object.keys(counts).length).toBe(0);
  });

  it('5. deduplicates same domain appearing in same response multiple times', () => {
    const results = [
      { citedUrls: ['https://yelp.com/biz/a', 'https://yelp.com/biz/b', 'https://yelp.com/biz/c'] },
    ];
    const counts = aggregatePlatformCounts(results);
    // Same platform in same response = counted once
    expect(counts['yelp']).toBe(1);
  });

  it('6. handles mixed known and unknown platforms', () => {
    const results = [
      { citedUrls: ['https://yelp.com/a', 'https://unknownsite.com/b'] },
    ];
    const counts = aggregatePlatformCounts(results);
    expect(counts['yelp']).toBe(1);
    expect(counts['unknownsite.com']).toBe(1);
  });

  it('7. ignores malformed URLs', () => {
    const results = [
      { citedUrls: ['not-a-url', 'https://yelp.com/a'] },
    ];
    const counts = aggregatePlatformCounts(results);
    expect(counts['yelp']).toBe(1);
    expect(Object.keys(counts).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateCitationFrequency
// ---------------------------------------------------------------------------

describe('calculateCitationFrequency', () => {
  it('1. calculates frequency as appearances / total', () => {
    expect(calculateCitationFrequency(3, 5)).toBe(0.6);
  });

  it('2. returns 0 when total is 0', () => {
    expect(calculateCitationFrequency(3, 0)).toBe(0);
  });

  it('3. returns 1.0 max (caps at 1.0)', () => {
    expect(calculateCitationFrequency(10, 5)).toBe(1);
  });

  it('4. rounds to 3 decimal places', () => {
    const result = calculateCitationFrequency(1, 3);
    expect(result).toBe(0.333);
  });

  it('5. returns 0 when appearances is 0', () => {
    expect(calculateCitationFrequency(0, 5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// KNOWN_CITATION_PLATFORMS
// ---------------------------------------------------------------------------

describe('KNOWN_CITATION_PLATFORMS', () => {
  it('1. contains Yelp mapping', () => {
    expect(KNOWN_CITATION_PLATFORMS['yelp.com']).toBe('yelp');
  });

  it('2. contains TripAdvisor mapping', () => {
    expect(KNOWN_CITATION_PLATFORMS['tripadvisor.com']).toBe('tripadvisor');
  });

  it('3. contains Google Maps mapping', () => {
    expect(KNOWN_CITATION_PLATFORMS['google.com']).toBe('google');
    expect(KNOWN_CITATION_PLATFORMS['maps.google.com']).toBe('google');
  });

  it('4. has at least 15 platform entries', () => {
    expect(Object.keys(KNOWN_CITATION_PLATFORMS).length).toBeGreaterThanOrEqual(15);
  });
});
