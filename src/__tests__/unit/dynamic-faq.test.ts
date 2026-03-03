// ---------------------------------------------------------------------------
// src/__tests__/unit/dynamic-faq.test.ts — Sprint 128: Dynamic FAQ Generator
//
// Tests: generateFAQs, applyExclusions, toFAQPageJsonLd, stripHtml,
//        truncateAnswer, makeHash, cron registration, schema alignment
// Target: 37 tests
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  generateFAQs,
  applyExclusions,
  makeHash,
} from '@/lib/faq/faq-generator';
import type { FAQGeneratorInput } from '@/lib/faq/faq-generator';

import {
  toFAQPageJsonLd,
  stripHtml,
  truncateAnswer,
} from '@/lib/faq/faq-schema-builder';

const ROOT = join(__dirname, '..', '..', '..');

// ---------------------------------------------------------------------------
// Minimal input factory
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<FAQGeneratorInput> = {}): FAQGeneratorInput {
  return {
    name: 'Charcoal N Chill',
    city: 'Alpharetta',
    state: 'GA',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    hours_data: {
      monday: 'closed' as unknown as null,
      tuesday: { open: '17:00', close: '01:00' },
      wednesday: { open: '17:00', close: '01:00' },
      thursday: { open: '17:00', close: '01:00' },
      friday: { open: '17:00', close: '02:00' },
      saturday: { open: '17:00', close: '02:00' },
      sunday: { open: '17:00', close: '01:00' },
    },
    amenities: {
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: true,
      is_kid_friendly: false,
    },
    categories: ['Hookah Bar', 'Indian Restaurant'],
    display_name: 'Premium hookah lounge',
    operational_status: 'OPERATIONAL',
    menuItemNames: ['Chicken Tikka', 'Lamb Chops', 'Paneer Butter Masala'],
    accepting_new_patients: null,
    telehealth_available: null,
    insurance_types: null,
    specialty_tags: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateFAQs — hours
// ---------------------------------------------------------------------------

describe('generateFAQs — hours', () => {
  it('generates hours question when hours_data present', () => {
    const result = generateFAQs(makeInput());
    const hoursPair = result.find((p) => p.source === 'hours');
    expect(hoursPair).toBeDefined();
    expect(hoursPair!.question).toContain('hours');
  });

  it('skips hours question when hours_data null', () => {
    const result = generateFAQs(makeInput({ hours_data: null }));
    expect(result.find((p) => p.source === 'hours')).toBeUndefined();
  });

  it('formats Mon–Fri when only weekdays have hours', () => {
    const result = generateFAQs(
      makeInput({
        hours_data: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' },
        },
      }),
    );
    const hoursPair = result.find((p) => p.source === 'hours');
    expect(hoursPair!.answer).toContain('Monday–Friday');
  });

  it('formats Monday–Sunday when all 7 days present', () => {
    const result = generateFAQs(
      makeInput({
        hours_data: {
          monday: { open: '09:00', close: '17:00' },
          tuesday: { open: '09:00', close: '17:00' },
          wednesday: { open: '09:00', close: '17:00' },
          thursday: { open: '09:00', close: '17:00' },
          friday: { open: '09:00', close: '17:00' },
          saturday: { open: '10:00', close: '16:00' },
          sunday: { open: '10:00', close: '16:00' },
        },
      }),
    );
    const hoursPair = result.find((p) => p.source === 'hours');
    expect(hoursPair!.answer).toContain('Monday–Sunday');
  });

  it('includes phone in hours answer when phone non-null', () => {
    const result = generateFAQs(makeInput());
    const hoursPair = result.find((p) => p.source === 'hours');
    expect(hoursPair!.answer).toContain('(470) 546-4866');
  });

  it('omits phone from hours answer when phone null', () => {
    const result = generateFAQs(makeInput({ phone: null }));
    const hoursPair = result.find((p) => p.source === 'hours');
    expect(hoursPair!.answer).not.toContain('Call');
  });
});

// ---------------------------------------------------------------------------
// generateFAQs — location
// ---------------------------------------------------------------------------

describe('generateFAQs — location', () => {
  it('generates location question when city + state present', () => {
    const result = generateFAQs(makeInput());
    const locPair = result.find(
      (p) => p.source === 'location' && p.question.includes('located'),
    );
    expect(locPair).toBeDefined();
    expect(locPair!.answer).toContain('Alpharetta, GA');
  });

  it('skips location question when city is empty string', () => {
    const result = generateFAQs(makeInput({ city: '' }));
    const locPair = result.find(
      (p) => p.source === 'location' && p.question.includes('located'),
    );
    expect(locPair).toBeUndefined();
  });

  it('includes website_url in contact answer when present', () => {
    const result = generateFAQs(makeInput());
    const contactPair = result.find(
      (p) => p.source === 'location' && p.question.includes('contact'),
    );
    expect(contactPair).toBeDefined();
    expect(contactPair!.answer).toContain('charcoalnchill.com');
  });
});

// ---------------------------------------------------------------------------
// generateFAQs — operational status
// ---------------------------------------------------------------------------

describe('generateFAQs — operational status', () => {
  it('generates open status question when OPERATIONAL', () => {
    const result = generateFAQs(makeInput());
    const opPair = result.find((p) => p.source === 'operational');
    expect(opPair).toBeDefined();
    expect(opPair!.answer).toContain('currently open');
  });

  it('skips open status question when not OPERATIONAL', () => {
    const result = generateFAQs(
      makeInput({ operational_status: 'CLOSED_TEMPORARILY' }),
    );
    expect(result.find((p) => p.source === 'operational')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateFAQs — menu items (non-medical)
// ---------------------------------------------------------------------------

describe('generateFAQs — menu items (non-medical)', () => {
  it('generates menu question when menuItemNames present', () => {
    const result = generateFAQs(makeInput());
    const menuPair = result.find((p) => p.source === 'menu');
    expect(menuPair).toBeDefined();
    expect(menuPair!.answer).toContain('Chicken Tikka');
  });

  it('skips menu question for medical categories', () => {
    const result = generateFAQs(
      makeInput({
        categories: ['Dentist', 'Dental Clinic'],
        menuItemNames: ['Tooth Extraction'],
      }),
    );
    expect(result.find((p) => p.source === 'menu')).toBeUndefined();
  });

  it('limits to top 3 menu items in answer', () => {
    const result = generateFAQs(
      makeInput({
        menuItemNames: ['A', 'B', 'C', 'D', 'E'],
      }),
    );
    const menuPair = result.find((p) => p.source === 'menu');
    expect(menuPair!.answer).toContain('A, B, C');
    expect(menuPair!.answer).not.toContain('D');
  });
});

// ---------------------------------------------------------------------------
// generateFAQs — amenities (non-medical)
// ---------------------------------------------------------------------------

describe('generateFAQs — amenities (non-medical)', () => {
  it('generates amenity question for first true amenity', () => {
    const result = generateFAQs(makeInput());
    const amenPair = result.find((p) => p.source === 'amenity');
    expect(amenPair).toBeDefined();
  });

  it('skips amenity question when no true amenities', () => {
    const result = generateFAQs(
      makeInput({
        amenities: { has_outdoor_seating: false, serves_alcohol: false },
      }),
    );
    expect(result.find((p) => p.source === 'amenity')).toBeUndefined();
  });

  it('skips amenity question for medical categories', () => {
    const result = generateFAQs(
      makeInput({
        categories: ['Medical Clinic'],
        amenities: { has_outdoor_seating: true },
      }),
    );
    expect(result.find((p) => p.source === 'amenity')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generateFAQs — medical templates
// ---------------------------------------------------------------------------

describe('generateFAQs — medical templates', () => {
  it('uses medical FAQ templates when isMedicalCategory=true', () => {
    const result = generateFAQs(
      makeInput({
        categories: ['Dental Clinic'],
        accepting_new_patients: true,
        telehealth_available: true,
        insurance_types: ['Delta Dental', 'Cigna'],
        specialty_tags: ['Preventive'],
        menuItemNames: [],
      }),
    );
    const medPairs = result.filter((p) => p.source === 'medical');
    expect(medPairs.length).toBeGreaterThan(0);
  });

  it('excludes insurance template when insurance_types is empty array', () => {
    const result = generateFAQs(
      makeInput({
        categories: ['Dental Clinic'],
        insurance_types: [],
        accepting_new_patients: true,
        menuItemNames: [],
      }),
    );
    const medPairs = result.filter((p) => p.source === 'medical');
    const insurancePair = medPairs.find((p) =>
      p.question.toLowerCase().includes('insurance'),
    );
    expect(insurancePair).toBeUndefined();
  });

  it('excludes accepting_new_patients template when value is null', () => {
    const result = generateFAQs(
      makeInput({
        categories: ['Dental Clinic'],
        accepting_new_patients: null,
        insurance_types: ['Aetna'],
        menuItemNames: [],
      }),
    );
    const medPairs = result.filter((p) => p.source === 'medical');
    const newPatientPair = medPairs.find((p) =>
      p.question.toLowerCase().includes('new patients'),
    );
    expect(newPatientPair).toBeUndefined();
  });

  it('renders insurance list in answer', () => {
    const result = generateFAQs(
      makeInput({
        categories: ['Dental Clinic'],
        insurance_types: ['Delta Dental', 'Cigna'],
        accepting_new_patients: true,
        menuItemNames: [],
      }),
    );
    const medPairs = result.filter((p) => p.source === 'medical');
    const insurancePair = medPairs.find((p) =>
      p.question.toLowerCase().includes('insurance'),
    );
    expect(insurancePair).toBeDefined();
    expect(insurancePair!.answer).toContain('Delta Dental, Cigna');
  });
});

// ---------------------------------------------------------------------------
// generateFAQs — general
// ---------------------------------------------------------------------------

describe('generateFAQs — general', () => {
  it('caps output at 15 pairs', () => {
    // Feed a medical location with lots of data to generate many pairs
    const result = generateFAQs(
      makeInput({
        categories: ['Dental Clinic'],
        accepting_new_patients: true,
        telehealth_available: true,
        insurance_types: ['A', 'B', 'C'],
        specialty_tags: ['Preventive', 'Restorative', 'Orthodontics', 'Cosmetic'],
        menuItemNames: [],
      }),
    );
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it('returns 0 pairs for completely empty location (no errors)', () => {
    const result = generateFAQs({
      name: 'Test',
      city: '',
      state: '',
      phone: null,
      website_url: null,
      hours_data: null,
      amenities: null,
      categories: null,
      display_name: null,
      operational_status: 'CLOSED_PERMANENTLY',
      menuItemNames: [],
      accepting_new_patients: null,
      telehealth_available: null,
      insurance_types: null,
      specialty_tags: null,
    });
    expect(result).toEqual([]);
  });

  it('generates at least 1 pair for minimal location (name+city+state)', () => {
    const result = generateFAQs(
      makeInput({
        hours_data: null,
        amenities: null,
        menuItemNames: [],
        phone: null,
        website_url: null,
      }),
    );
    // Should still have location question since city+state present
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('all pairs have non-empty question and answer', () => {
    const result = generateFAQs(makeInput());
    for (const pair of result) {
      expect(pair.question.length).toBeGreaterThan(0);
      expect(pair.answer.length).toBeGreaterThan(0);
    }
  });

  it('all pairs have contentHash populated', () => {
    const result = generateFAQs(makeInput());
    for (const pair of result) {
      expect(pair.contentHash).toBeTruthy();
      expect(pair.contentHash.length).toBe(64); // SHA-256 hex length
    }
  });

  it('contentHash is deterministic for same question text', () => {
    const result1 = generateFAQs(makeInput());
    const result2 = generateFAQs(makeInput());
    expect(result1[0].contentHash).toBe(result2[0].contentHash);
  });
});

// ---------------------------------------------------------------------------
// applyExclusions
// ---------------------------------------------------------------------------

describe('applyExclusions', () => {
  const pairs = generateFAQs(makeInput());

  it('removes pair matching excluded hash', () => {
    const first = pairs[0];
    const filtered = applyExclusions(pairs, [first.contentHash]);
    expect(filtered.find((p) => p.contentHash === first.contentHash)).toBeUndefined();
    expect(filtered.length).toBe(pairs.length - 1);
  });

  it('keeps pairs not in excluded list', () => {
    const filtered = applyExclusions(pairs, ['nonexistent_hash']);
    expect(filtered.length).toBe(pairs.length);
  });

  it('handles empty excluded list', () => {
    const filtered = applyExclusions(pairs, []);
    expect(filtered.length).toBe(pairs.length);
  });

  it('handles empty pairs list', () => {
    const filtered = applyExclusions([], ['some_hash']);
    expect(filtered).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// toFAQPageJsonLd
// ---------------------------------------------------------------------------

describe('toFAQPageJsonLd', () => {
  const pairs = generateFAQs(makeInput());

  it('produces valid @type FAQPage schema', () => {
    const json = toFAQPageJsonLd(pairs);
    const parsed = JSON.parse(json);
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed.mainEntity.length).toBeGreaterThan(0);
  });

  it('caps at 10 pairs even if more passed', () => {
    // Generate enough pairs to exceed 10
    const manyPairs = Array.from({ length: 15 }, (_, i) => ({
      id: `id-${i}`,
      question: `Question ${i}?`,
      answer: `Answer ${i}.`,
      contentHash: `hash-${i}`,
      source: 'hours' as const,
    }));
    const json = toFAQPageJsonLd(manyPairs);
    const parsed = JSON.parse(json);
    expect(parsed.mainEntity.length).toBe(10);
  });

  it('strips HTML from question and answer', () => {
    const htmlPairs = [
      {
        id: 'test',
        question: '<b>What are hours?</b>',
        answer: '<p>We are open <em>daily</em>.</p>',
        contentHash: 'test-hash',
        source: 'hours' as const,
      },
    ];
    const json = toFAQPageJsonLd(htmlPairs);
    const parsed = JSON.parse(json);
    expect(parsed.mainEntity[0].name).toBe('What are hours?');
    expect(parsed.mainEntity[0].acceptedAnswer.text).toBe('We are open daily.');
  });

  it('truncates answer to 300 chars', () => {
    const longPairs = [
      {
        id: 'test',
        question: 'Long Q?',
        answer: 'A'.repeat(400),
        contentHash: 'test-hash',
        source: 'hours' as const,
      },
    ];
    const json = toFAQPageJsonLd(longPairs);
    const parsed = JSON.parse(json);
    expect(parsed.mainEntity[0].acceptedAnswer.text.length).toBe(300);
    expect(parsed.mainEntity[0].acceptedAnswer.text.endsWith('...')).toBe(true);
  });

  it('produces valid JSON string', () => {
    const json = toFAQPageJsonLd(pairs);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// stripHtml + truncateAnswer helpers
// ---------------------------------------------------------------------------

describe('stripHtml', () => {
  it('removes HTML tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    expect(stripHtml('Tom &amp; Jerry &lt;3 &gt;cats')).toBe(
      'Tom & Jerry <3 >cats',
    );
  });

  it('trims whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello');
  });
});

describe('truncateAnswer', () => {
  it('returns text as-is when under 300 chars', () => {
    const short = 'Hello world';
    expect(truncateAnswer(short)).toBe(short);
  });

  it('truncates and adds ellipsis when over 300 chars', () => {
    const long = 'A'.repeat(400);
    const result = truncateAnswer(long);
    expect(result.length).toBe(300);
    expect(result.endsWith('...')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// makeHash
// ---------------------------------------------------------------------------

describe('makeHash', () => {
  it('returns 64-char hex string', () => {
    const hash = makeHash('test question');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    expect(makeHash('same')).toBe(makeHash('same'));
  });

  it('produces different hashes for different inputs', () => {
    expect(makeHash('question A')).not.toBe(makeHash('question B'));
  });
});

// ---------------------------------------------------------------------------
// Cron registration
// ---------------------------------------------------------------------------

describe('Sprint 128 — Cron registration', () => {
  const vercelJson = JSON.parse(
    readFileSync(join(ROOT, 'vercel.json'), 'utf-8'),
  );
  const crons = vercelJson.crons ?? [];

  it('faq-regeneration cron is registered', () => {
    const faqCron = crons.find(
      (c: { path: string }) => c.path === '/api/cron/faq-regeneration',
    );
    expect(faqCron).toBeDefined();
    expect(faqCron.schedule).toBe('0 3 * * *');
  });
});

// ---------------------------------------------------------------------------
// Migration + schema alignment
// ---------------------------------------------------------------------------

describe('Sprint 128 — Migration', () => {
  const migration = readFileSync(
    join(ROOT, 'supabase/migrations/20260322000004_faq_cache.sql'),
    'utf-8',
  );

  it('adds faq_cache column to locations', () => {
    expect(migration).toContain('"faq_cache" jsonb');
    expect(migration).toContain('locations');
    expect(migration).not.toContain('magic_menus');
  });

  it('adds faq_updated_at column to locations', () => {
    expect(migration).toContain('"faq_updated_at"');
  });

  it('adds faq_excluded_hashes column to locations', () => {
    expect(migration).toContain('"faq_excluded_hashes"');
  });
});

describe('Sprint 128 — Schema columns', () => {
  const schema = readFileSync(join(ROOT, 'supabase/prod_schema.sql'), 'utf-8');

  it('has faq_cache on locations', () => {
    // Check that faq_cache appears in the locations CREATE TABLE block
    const locationsBlock = schema.slice(
      schema.indexOf('CREATE TABLE IF NOT EXISTS "public"."locations"'),
      schema.indexOf('ALTER TABLE "public"."locations"'),
    );
    expect(locationsBlock).toContain('"faq_cache"');
  });

  it('has faq_excluded_hashes on locations', () => {
    const locationsBlock = schema.slice(
      schema.indexOf('CREATE TABLE IF NOT EXISTS "public"."locations"'),
      schema.indexOf('ALTER TABLE "public"."locations"'),
    );
    expect(locationsBlock).toContain('"faq_excluded_hashes"');
  });

  it('does NOT have faq_cache on magic_menus', () => {
    const menusBlock = schema.slice(
      schema.indexOf('CREATE TABLE IF NOT EXISTS "public"."magic_menus"'),
      schema.indexOf('ALTER TABLE "public"."magic_menus"'),
    );
    expect(menusBlock).not.toContain('"faq_cache"');
  });
});

describe('Sprint 128 — Database types', () => {
  const types = readFileSync(
    join(ROOT, 'lib/supabase/database.types.ts'),
    'utf-8',
  );

  it('has faq_cache in locations Row type', () => {
    expect(types).toContain('faq_cache: Json | null');
  });

  it('has faq_excluded_hashes in locations type', () => {
    expect(types).toContain('faq_excluded_hashes: Json | null');
  });

  it('has faq_updated_at in locations type', () => {
    expect(types).toContain('faq_updated_at: string | null');
  });
});
