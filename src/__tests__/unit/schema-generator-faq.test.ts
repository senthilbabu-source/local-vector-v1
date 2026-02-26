// ---------------------------------------------------------------------------
// schema-generator-faq.test.ts — Sprint 70: FAQPage schema generator tests
//
// Run: npx vitest run src/__tests__/unit/schema-generator-faq.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { generateFAQPageSchema, transformToQuestion } from '@/lib/schema-generator/faq-schema';
import { MOCK_SCHEMA_LOCATION, MOCK_SCHEMA_QUERIES } from '@/__fixtures__/golden-tenant';
import type { SchemaLocationInput, SchemaQueryInput } from '@/lib/schema-generator/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const location: SchemaLocationInput = { ...MOCK_SCHEMA_LOCATION };
const queries: SchemaQueryInput[] = [...MOCK_SCHEMA_QUERIES];

// ---------------------------------------------------------------------------
// generateFAQPageSchema
// ---------------------------------------------------------------------------

describe('generateFAQPageSchema', () => {
  it('returns FAQPage JSON-LD with @context and @type', () => {
    const result = generateFAQPageSchema(location, queries);

    expect(result).not.toBeNull();
    expect(result!.jsonLd).toHaveProperty('@context', 'https://schema.org');
    expect(result!.jsonLd).toHaveProperty('@type', 'FAQPage');
  });

  it('generates Q&A pairs from target_queries', () => {
    const result = generateFAQPageSchema(location, queries);
    const jsonLd = result!.jsonLd as { mainEntity: { '@type': string; name: string }[] };

    expect(jsonLd.mainEntity).toHaveLength(4);
    expect(jsonLd.mainEntity[0]['@type']).toBe('Question');
    expect(jsonLd.mainEntity[0]).toHaveProperty('name');
  });

  it('limits to max 8 FAQ items', () => {
    const manyQueries: SchemaQueryInput[] = Array.from({ length: 12 }, (_, i) => ({
      query_text: `Query number ${i + 1}`,
      query_category: 'discovery',
    }));

    const result = generateFAQPageSchema(location, manyQueries);
    const jsonLd = result!.jsonLd as { mainEntity: unknown[] };

    expect(jsonLd.mainEntity).toHaveLength(8);
  });

  it('returns null when fewer than 2 queries provided', () => {
    const result = generateFAQPageSchema(location, [queries[0]]);
    expect(result).toBeNull();
  });

  it('returns null when zero queries provided', () => {
    const result = generateFAQPageSchema(location, []);
    expect(result).toBeNull();
  });

  it('transforms "Best X in Y" queries into question format', () => {
    const result = generateFAQPageSchema(location, queries);
    const jsonLd = result!.jsonLd as { mainEntity: { name: string }[] };

    // "Best BBQ restaurant in Alpharetta GA" → "What is the best bbq restaurant in alpharetta ga?"
    expect(jsonLd.mainEntity[0].name).toMatch(/^What is the best/i);
    expect(jsonLd.mainEntity[0].name).toMatch(/\?$/);
  });

  it('uses business_name in answers', () => {
    const result = generateFAQPageSchema(location, queries);
    const jsonLd = result!.jsonLd as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };

    const answers = jsonLd.mainEntity.map((q) => q.acceptedAnswer.text);
    for (const answer of answers) {
      expect(answer).toContain('Charcoal N Chill');
    }
  });

  it('includes hours summary in discovery-type answers', () => {
    const discoveryQuery: SchemaQueryInput[] = [
      { query_text: 'Best hookah in Alpharetta', query_category: 'discovery' },
      { query_text: 'Top lounge near me', query_category: 'discovery' },
    ];

    const result = generateFAQPageSchema(location, discoveryQuery);
    const jsonLd = result!.jsonLd as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };

    // Discovery answers should include hour info
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toMatch(/open/i);
  });

  it('includes address in near_me-type answers', () => {
    const nearMeQueries: SchemaQueryInput[] = [
      { query_text: 'hookah bar near Alpharetta', query_category: 'near_me' },
      { query_text: 'restaurant near Johns Creek', query_category: 'near_me' },
    ];

    const result = generateFAQPageSchema(location, nearMeQueries);
    const jsonLd = result!.jsonLd as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };

    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toContain('11950 Jones Bridge Road');
  });

  it('includes amenities in comparison-type answers', () => {
    const compQueries: SchemaQueryInput[] = [
      { query_text: 'Charcoal vs Cloud 9', query_category: 'comparison' },
      { query_text: 'Which is better', query_category: 'comparison' },
    ];

    const result = generateFAQPageSchema(location, compQueries);
    const jsonLd = result!.jsonLd as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };

    // Comparison answers should mention amenities
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toMatch(/outdoor seating|hookah|live music|reservations/i);
  });

  it('does NOT include fabricated/marketing language — only ground truth', () => {
    const result = generateFAQPageSchema(location, queries);
    const jsonLd = result!.jsonLd as {
      mainEntity: { acceptedAnswer: { text: string } }[];
    };

    const allAnswers = jsonLd.mainEntity.map((q) => q.acceptedAnswer.text).join(' ');

    // Should NOT contain marketing language
    expect(allAnswers).not.toMatch(/award-winning|best in class|unmatched|luxury|world-class/i);
    // Should contain verifiable data
    expect(allAnswers).toContain('Charcoal N Chill');
  });

  it('returns schemaType FAQPage and valid jsonLdString', () => {
    const result = generateFAQPageSchema(location, queries);

    expect(result!.schemaType).toBe('FAQPage');
    expect(() => JSON.parse(result!.jsonLdString)).not.toThrow();
    expect(JSON.parse(result!.jsonLdString)).toEqual(result!.jsonLd);
  });

  it('returns description with question count', () => {
    const result = generateFAQPageSchema(location, queries);
    expect(result!.description).toContain('4 questions');
  });
});

// ---------------------------------------------------------------------------
// transformToQuestion
// ---------------------------------------------------------------------------

describe('transformToQuestion', () => {
  it('adds "What is the" prefix to "Best X" queries', () => {
    const result = transformToQuestion('Best hookah lounge near Alpharetta', 'Charcoal N Chill');
    expect(result).toBe('What is the best hookah lounge near alpharetta?');
  });

  it('passes through queries already ending in "?"', () => {
    const result = transformToQuestion('What are the hours for Charcoal N Chill?', 'Charcoal N Chill');
    expect(result).toBe('What are the hours for Charcoal N Chill?');
  });

  it('handles empty string gracefully', () => {
    const result = transformToQuestion('', 'Charcoal N Chill');
    expect(result).toBe('What is Charcoal N Chill?');
  });

  it('handles hours-related queries', () => {
    const result = transformToQuestion('Charcoal N Chill hours', 'Charcoal N Chill');
    expect(result).toBe('What are the hours for Charcoal N Chill?');
  });

  it('handles "near" queries', () => {
    const result = transformToQuestion('hookah bar near Alpharetta', 'Charcoal N Chill');
    expect(result).toMatch(/\?$/);
  });

  it('defaults to "What is {query}?" for generic text', () => {
    const result = transformToQuestion('birthday party venue Alpharetta', 'Charcoal N Chill');
    expect(result).toBe('What is birthday party venue alpharetta?');
  });
});
