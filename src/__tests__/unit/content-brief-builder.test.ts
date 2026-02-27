// ---------------------------------------------------------------------------
// content-brief-builder.test.ts — Unit tests for pure brief structure builder
//
// Sprint 86: 17 tests — slug, title, H1, schemas, content type, llms.txt.
//
// Run:
//   npx vitest run src/__tests__/unit/content-brief-builder.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildBriefStructure,
  slugify,
  buildTitleTag,
  buildH1,
  inferContentType,
  recommendSchemas,
  buildLlmsTxtEntry,
} from '@/lib/services/content-brief-builder.service';
import { MOCK_BRIEF_STRUCTURE_INPUT } from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('generates slug from query text', () => {
    expect(slugify('private event venue Alpharetta')).toBe('private-event-venue-alpharetta');
  });

  it('lowercases and hyphenates slug', () => {
    expect(slugify('Best BBQ In Town')).toBe('best-bbq-in-town');
  });

  it('removes special characters from slug', () => {
    expect(slugify("What's the best restaurant?")).toBe('whats-the-best-restaurant');
  });

  it('truncates slug to 80 characters', () => {
    const longQuery = 'a'.repeat(100);
    expect(slugify(longQuery).length).toBeLessThanOrEqual(80);
  });
});

// ---------------------------------------------------------------------------
// buildTitleTag
// ---------------------------------------------------------------------------

describe('buildTitleTag', () => {
  it('builds title tag with capitalized query + business name', () => {
    const result = buildTitleTag('private event venue Alpharetta', 'Charcoal N Chill');
    expect(result).toBe('Private Event Venue Alpharetta | Charcoal N Chill');
  });
});

// ---------------------------------------------------------------------------
// buildH1
// ---------------------------------------------------------------------------

describe('buildH1', () => {
  it('builds H1 with "at" business name pattern', () => {
    const result = buildH1('private event venue Alpharetta', 'Charcoal N Chill');
    expect(result).toBe('Private Event Venue Alpharetta at Charcoal N Chill');
  });
});

// ---------------------------------------------------------------------------
// recommendSchemas
// ---------------------------------------------------------------------------

describe('recommendSchemas', () => {
  it('recommends FAQPage schema for all categories', () => {
    expect(recommendSchemas('discovery')).toContain('FAQPage');
    expect(recommendSchemas('occasion')).toContain('FAQPage');
    expect(recommendSchemas('comparison')).toContain('FAQPage');
    expect(recommendSchemas('near_me')).toContain('FAQPage');
    expect(recommendSchemas('custom')).toContain('FAQPage');
  });

  it('recommends Event schema for occasion queries', () => {
    const schemas = recommendSchemas('occasion');
    expect(schemas).toContain('Event');
  });

  it('recommends LocalBusiness for discovery queries', () => {
    const schemas = recommendSchemas('discovery');
    expect(schemas).toContain('LocalBusiness');
  });

  it('recommends LocalBusiness for near_me queries', () => {
    const schemas = recommendSchemas('near_me');
    expect(schemas).toContain('LocalBusiness');
  });
});

// ---------------------------------------------------------------------------
// inferContentType
// ---------------------------------------------------------------------------

describe('inferContentType', () => {
  it('infers landing_page content type for discovery', () => {
    expect(inferContentType('discovery')).toBe('landing_page');
  });

  it('infers occasion_page content type for occasion', () => {
    expect(inferContentType('occasion')).toBe('occasion_page');
  });

  it('infers blog_post content type for comparison', () => {
    expect(inferContentType('comparison')).toBe('blog_post');
  });

  it('infers blog_post content type for unknown category', () => {
    expect(inferContentType('some_unknown_category')).toBe('blog_post');
  });
});

// ---------------------------------------------------------------------------
// buildLlmsTxtEntry
// ---------------------------------------------------------------------------

describe('buildLlmsTxtEntry', () => {
  it('builds llms.txt entry with query, business name, city, state', () => {
    const result = buildLlmsTxtEntry(
      'private event venue Alpharetta',
      'Charcoal N Chill',
      'Alpharetta',
      'GA',
    );
    expect(result).toContain('## private event venue Alpharetta');
    expect(result).toContain('Charcoal N Chill in Alpharetta, GA');
    expect(result).toContain('See the dedicated page for full details.');
  });
});

// ---------------------------------------------------------------------------
// buildBriefStructure (integration)
// ---------------------------------------------------------------------------

describe('buildBriefStructure', () => {
  it('builds suggested URL with leading slash', () => {
    const result = buildBriefStructure(MOCK_BRIEF_STRUCTURE_INPUT);
    expect(result.suggestedUrl).toBe('/private-event-venue-alpharetta');
  });

  it('produces valid structure from MOCK_BRIEF_STRUCTURE_INPUT', () => {
    const result = buildBriefStructure(MOCK_BRIEF_STRUCTURE_INPUT);

    expect(result.suggestedSlug).toBe('private-event-venue-alpharetta');
    expect(result.suggestedUrl).toBe('/private-event-venue-alpharetta');
    expect(result.titleTag).toBe('Private Event Venue Alpharetta | Charcoal N Chill');
    expect(result.h1).toBe('Private Event Venue Alpharetta at Charcoal N Chill');
    expect(result.recommendedSchemas).toContain('FAQPage');
    expect(result.recommendedSchemas).toContain('LocalBusiness');
    expect(result.contentType).toBe('landing_page');
    expect(result.llmsTxtEntry).toContain('Charcoal N Chill in Alpharetta, GA');
  });
});
