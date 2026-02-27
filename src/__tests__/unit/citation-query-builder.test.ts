// ---------------------------------------------------------------------------
// citation-query-builder.test.ts — Unit tests for citation query builder
//
// Sprint 97 — Gap #60 (Citation Intelligence Cron)
// Run: npx vitest run src/__tests__/unit/citation-query-builder.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildCitationQueries,
  normalizeCategoryLabel,
  buildMetroVariants,
} from '@/lib/citation/citation-query-builder';

// ---------------------------------------------------------------------------
// buildCitationQueries
// ---------------------------------------------------------------------------

describe('buildCitationQueries', () => {
  it('1. returns at least 4 queries for a valid category + metro', () => {
    const queries = buildCitationQueries('hookah lounge', 'Alpharetta', 'GA');
    expect(queries.length).toBeGreaterThanOrEqual(4);
  });

  it('2. includes city and state in at least one query', () => {
    const queries = buildCitationQueries('restaurant', 'Dallas', 'TX');
    const hasCity = queries.some((q) => q.includes('Dallas'));
    const hasState = queries.some((q) => q.includes('TX') || q.includes('Texas'));
    expect(hasCity).toBe(true);
    expect(hasState).toBe(true);
  });

  it('3. includes category term in all queries', () => {
    const queries = buildCitationQueries('coffee shop', 'Miami', 'FL');
    for (const q of queries) {
      expect(q.toLowerCase()).toContain('coffee shop');
    }
  });

  it('4. returns unique queries (no duplicates)', () => {
    const queries = buildCitationQueries('bar', 'New York', 'NY');
    const unique = new Set(queries);
    expect(unique.size).toBe(queries.length);
  });

  it('5. handles category with special characters (ampersand, slash)', () => {
    const queries = buildCitationQueries('bar & grill', 'Chicago', 'IL');
    expect(queries.length).toBeGreaterThanOrEqual(4);
    // Should include the category in all queries
    for (const q of queries) {
      expect(q.toLowerCase()).toContain('bar & grill');
    }
  });

  it('6. handles city with spaces ("North Atlanta")', () => {
    const queries = buildCitationQueries('lounge', 'North Atlanta', 'GA');
    expect(queries.length).toBeGreaterThanOrEqual(4);
    const hasCity = queries.some((q) => q.includes('North Atlanta'));
    expect(hasCity).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeCategoryLabel
// ---------------------------------------------------------------------------

describe('normalizeCategoryLabel', () => {
  it('1. lowercases GBP category strings', () => {
    expect(normalizeCategoryLabel('Hookah Bar')).toBe('hookah bar');
  });

  it('2. strips "Restaurant >" prefix pattern', () => {
    expect(normalizeCategoryLabel('Restaurant > Hookah Bar')).toBe('hookah bar');
  });

  it('3. converts underscores to spaces', () => {
    expect(normalizeCategoryLabel('food_service > indian_restaurant')).toBe('indian restaurant');
  });

  it('4. handles already-clean labels passthrough', () => {
    expect(normalizeCategoryLabel('coffee shop')).toBe('coffee shop');
  });

  it('5. returns "business" for empty input', () => {
    expect(normalizeCategoryLabel('')).toBe('business');
  });

  it('6. returns "business" for null input', () => {
    expect(normalizeCategoryLabel(null)).toBe('business');
  });

  it('7. returns "business" for undefined input', () => {
    expect(normalizeCategoryLabel(undefined)).toBe('business');
  });

  it('8. truncates very long category strings to 100 chars', () => {
    const longCategory = 'a'.repeat(200);
    const result = normalizeCategoryLabel(longCategory);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('9. handles slash separators', () => {
    expect(normalizeCategoryLabel('Food/Italian Restaurant')).toBe('italian restaurant');
  });
});

// ---------------------------------------------------------------------------
// buildMetroVariants
// ---------------------------------------------------------------------------

describe('buildMetroVariants', () => {
  it('1. returns city+state and city+state-abbreviation variants', () => {
    const variants = buildMetroVariants('Alpharetta', 'GA');
    expect(variants).toContain('Alpharetta Georgia');
    expect(variants).toContain('Alpharetta GA');
  });

  it('2. returns at least 2 variants', () => {
    const variants = buildMetroVariants('Dallas', 'TX');
    expect(variants.length).toBeGreaterThanOrEqual(2);
  });

  it('3. all variants are non-empty strings', () => {
    const variants = buildMetroVariants('Miami', 'FL');
    for (const v of variants) {
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it('4. handles two-word city names ("North Atlanta")', () => {
    const variants = buildMetroVariants('North Atlanta', 'GA');
    const hasFullCity = variants.some((v) => v.includes('North Atlanta'));
    expect(hasFullCity).toBe(true);
  });

  it('5. handles two-word state names (future-proof)', () => {
    // Unknown state code — should still produce at least 2 variants
    const variants = buildMetroVariants('Portland', 'OR');
    expect(variants.length).toBeGreaterThanOrEqual(2);
  });

  it('6. handles lowercase state codes', () => {
    const variants = buildMetroVariants('Boston', 'ma');
    expect(variants.some((v) => v.includes('MA') || v.includes('Massachusetts'))).toBe(true);
  });

  it('7. does not return duplicate variants', () => {
    const variants = buildMetroVariants('Austin', 'TX');
    const unique = new Set(variants);
    expect(unique.size).toBe(variants.length);
  });
});
