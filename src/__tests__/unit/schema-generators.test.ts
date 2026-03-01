// ---------------------------------------------------------------------------
// src/__tests__/unit/schema-generators.test.ts — Schema Generator Tests
//
// Sprint 106: 45 tests covering all 5 generators, validation, and embed snippet.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external modules
const mockGetModel = vi.fn();
const mockHasApiKey = vi.fn();
const mockGenerateText = vi.fn();

vi.mock('@/lib/ai/providers', () => ({
  getModel: mockGetModel,
  hasApiKey: mockHasApiKey,
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/lib/schema-generator/local-business-schema', () => ({
  inferSchemaOrgType: vi.fn((categories: string[] | null) => {
    if (!categories) return 'LocalBusiness';
    const joined = categories.join(' ').toLowerCase();
    if (joined.includes('bar') || joined.includes('pub') || joined.includes('hookah')) return 'BarOrPub';
    if (joined.includes('restaurant') || joined.includes('food')) return 'Restaurant';
    return 'LocalBusiness';
  }),
}));

vi.mock('@/lib/schema-generator/hours-schema', () => ({
  generateOpeningHoursSchema: vi.fn((input: Record<string, unknown>) => {
    if (!input.hours_data) return null;
    return {
      jsonLd: {
        openingHoursSpecification: [
          { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Tuesday', opens: '17:00', closes: '01:00' },
        ],
      },
    };
  }),
}));

vi.mock('@/lib/indexnow', () => ({
  pingIndexNow: vi.fn().mockResolvedValue(true),
}));

import { LocalBusinessGenerator } from '@/lib/schema-expansion/generators/local-business.generator';
import { FAQPageGenerator } from '@/lib/schema-expansion/generators/faq-page.generator';
import { EventGenerator } from '@/lib/schema-expansion/generators/event.generator';
import { BlogPostingGenerator } from '@/lib/schema-expansion/generators/blog-posting.generator';
import { ServiceGenerator } from '@/lib/schema-expansion/generators/service.generator';
import { getGeneratorForPageType } from '@/lib/schema-expansion/generators';
import { generateEmbedSnippet, validateSchemaBeforePublish } from '@/lib/schema-expansion/schema-host';
import type { SchemaGeneratorInput, CrawledPage } from '@/lib/schema-expansion/types';
import {
  MOCK_SCHEMA_GROUND_TRUTH,
  MOCK_CRAWLED_HOMEPAGE,
  MOCK_CRAWLED_FAQ,
  MOCK_CRAWLED_EVENTS,
  MOCK_EXPECTED_HOMEPAGE_SCHEMA,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<SchemaGeneratorInput> = {}): SchemaGeneratorInput {
  return {
    groundTruth: MOCK_SCHEMA_GROUND_TRUTH,
    page: MOCK_CRAWLED_HOMEPAGE,
    orgId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    locationId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    ...overrides,
  };
}

function makePage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://charcoalnchill.com',
    page_type: 'homepage',
    title: 'Test Page',
    meta_description: 'Test description',
    h1: 'Test H1',
    body_excerpt: 'Test body content',
    detected_faqs: [],
    detected_events: [],
    crawled_at: '2026-03-01T04:00:00.000Z',
    http_status: 200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LocalBusinessGenerator — 12 tests
// ---------------------------------------------------------------------------

describe('LocalBusinessGenerator', () => {
  const generator = new LocalBusinessGenerator();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('infers @type BarOrPub when categories include hookah/bar', async () => {
    const input = makeInput({
      categories: ['Hookah Lounge', 'Bar'],
    });
    const result = await generator.generate(input);
    expect(result.json_ld[0]['@type']).toBe('BarOrPub');
  });

  it('infers @type Restaurant when categories include restaurant/food', async () => {
    const input = makeInput({
      categories: ['Restaurant', 'Indian Food'],
    });
    const result = await generator.generate(input);
    expect(result.json_ld[0]['@type']).toBe('Restaurant');
  });

  it('defaults to LocalBusiness when no categories', async () => {
    const input = makeInput({ categories: null });
    const result = await generator.generate(input);
    expect(result.json_ld[0]['@type']).toBe('LocalBusiness');
  });

  it('builds PostalAddress from groundTruth', async () => {
    const input = makeInput();
    const result = await generator.generate(input);
    const address = result.json_ld[0].address as Record<string, unknown>;
    expect(address['@type']).toBe('PostalAddress');
    expect(address.streetAddress).toBe('11950 Jones Bridge Road Ste 103');
    expect(address.addressLocality).toBe('Alpharetta');
    expect(address.addressRegion).toBe('GA');
    expect(address.postalCode).toBe('30005');
    expect(address.addressCountry).toBe('US');
  });

  it('sets telephone from groundTruth.phone', async () => {
    const input = makeInput();
    const result = await generator.generate(input);
    expect(result.json_ld[0].telephone).toBe('(470) 546-4866');
  });

  it('builds openingHoursSpecification when hours_data present', async () => {
    const input = makeInput();
    const result = await generator.generate(input);
    const hours = result.json_ld[0].openingHoursSpecification;
    expect(hours).toBeDefined();
    expect(Array.isArray(hours)).toBe(true);
  });

  it('omits openingHoursSpecification when no hours_data', async () => {
    const input = makeInput({
      groundTruth: { ...MOCK_SCHEMA_GROUND_TRUTH, hours_data: undefined },
    });
    const result = await generator.generate(input);
    expect(result.json_ld[0].openingHoursSpecification).toBeUndefined();
  });

  it('includes geo when latitude/longitude provided', async () => {
    const input = makeInput({ latitude: 34.0795, longitude: -84.2733 });
    const result = await generator.generate(input);
    const geo = result.json_ld[0].geo as Record<string, unknown>;
    expect(geo['@type']).toBe('GeoCoordinates');
    expect(geo.latitude).toBe(34.0795);
    expect(geo.longitude).toBe(-84.2733);
  });

  it('omits geo when latitude/longitude not provided', async () => {
    const input = makeInput();
    const result = await generator.generate(input);
    expect(result.json_ld[0].geo).toBeUndefined();
  });

  it('includes sameAs array for platform links', async () => {
    const input = makeInput({
      sameAsUrls: [
        'https://www.google.com/maps/place/?q=place_id:abc123',
        'https://www.yelp.com/biz/charcoal-n-chill',
      ],
    });
    const result = await generator.generate(input);
    expect(result.json_ld[0].sameAs).toEqual([
      'https://www.google.com/maps/place/?q=place_id:abc123',
      'https://www.yelp.com/biz/charcoal-n-chill',
    ]);
  });

  it('always includes BreadcrumbList as second JSON-LD object', async () => {
    const input = makeInput();
    const result = await generator.generate(input);
    expect(result.json_ld).toHaveLength(2);
    expect(result.json_ld[1]['@type']).toBe('BreadcrumbList');
    expect(result.schema_types).toContain('BreadcrumbList');
  });

  it('matches golden tenant expected schema structure', async () => {
    const input = makeInput({
      categories: ['Hookah Lounge', 'Bar'],
    });
    const result = await generator.generate(input);
    const schema = result.json_ld[0] as Record<string, unknown>;
    expect(schema['@context']).toBe(MOCK_EXPECTED_HOMEPAGE_SCHEMA['@context']);
    expect(schema['@type']).toBe(MOCK_EXPECTED_HOMEPAGE_SCHEMA['@type']);
    expect(schema.name).toBe(MOCK_EXPECTED_HOMEPAGE_SCHEMA.name);
    expect(schema.url).toBe(MOCK_EXPECTED_HOMEPAGE_SCHEMA.url);
    expect(schema.telephone).toBe(MOCK_EXPECTED_HOMEPAGE_SCHEMA.telephone);
    const addr = schema.address as Record<string, unknown>;
    expect(addr.streetAddress).toBe(MOCK_EXPECTED_HOMEPAGE_SCHEMA.address.streetAddress);
  });
});

// ---------------------------------------------------------------------------
// FAQPageGenerator — 7 tests
// ---------------------------------------------------------------------------

describe('FAQPageGenerator', () => {
  const generator = new FAQPageGenerator();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates FAQPage schema from extracted FAQs', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_FAQ });
    const result = await generator.generate(input);
    expect(result.json_ld[0]['@type']).toBe('FAQPage');
    const mainEntity = result.json_ld[0].mainEntity as Array<Record<string, unknown>>;
    expect(mainEntity).toHaveLength(2);
    expect(mainEntity[0]['@type']).toBe('Question');
    expect(mainEntity[0].name).toBe('What are your hookah flavors?');
  });

  it('falls back to LLM-generated FAQs when extraction yields none', async () => {
    mockHasApiKey.mockReturnValue(true);
    mockGetModel.mockReturnValue('gpt-4o-mini');
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify([
        { question: 'Q1?', answer: 'A1' },
        { question: 'Q2?', answer: 'A2' },
      ]),
    });

    const emptyFaqPage = makePage({
      url: 'https://charcoalnchill.com/faq',
      page_type: 'faq',
      detected_faqs: [],
    });
    const input = makeInput({ page: emptyFaqPage });
    const result = await generator.generate(input);

    expect(result.json_ld[0]['@type']).toBe('FAQPage');
    const mainEntity = result.json_ld[0].mainEntity as Array<Record<string, unknown>>;
    expect(mainEntity.length).toBeGreaterThan(0);
  });

  it('sets pending_review confidence (0.7) for AI-generated FAQs', async () => {
    mockHasApiKey.mockReturnValue(true);
    mockGetModel.mockReturnValue('gpt-4o-mini');
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify([{ question: 'Q?', answer: 'A' }]),
    });

    const emptyFaqPage = makePage({
      url: 'https://charcoalnchill.com/faq',
      page_type: 'faq',
      detected_faqs: [],
    });
    const input = makeInput({ page: emptyFaqPage });
    const result = await generator.generate(input);
    expect(result.confidence).toBe(0.7);
    expect(result.missing_fields).toContain('faqs_auto_generated');
  });

  it('auto-publishes with 0.9 confidence when FAQs are extracted', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_FAQ });
    const result = await generator.generate(input);
    expect(result.confidence).toBe(0.9);
    expect(result.missing_fields).not.toContain('faqs_auto_generated');
  });

  it('generates correct mainEntity structure per Schema.org spec', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_FAQ });
    const result = await generator.generate(input);
    const mainEntity = result.json_ld[0].mainEntity as Array<Record<string, unknown>>;
    for (const faq of mainEntity) {
      expect(faq['@type']).toBe('Question');
      expect(faq.name).toBeDefined();
      const answer = faq.acceptedAnswer as Record<string, unknown>;
      expect(answer['@type']).toBe('Answer');
      expect(answer.text).toBeDefined();
    }
  });

  it('tracks missing_fields for auto-generated FAQs', async () => {
    mockHasApiKey.mockReturnValue(false); // No API key → static fallback
    const emptyFaqPage = makePage({
      url: 'https://charcoalnchill.com/faq',
      page_type: 'faq',
      detected_faqs: [],
    });
    const input = makeInput({ page: emptyFaqPage });
    const result = await generator.generate(input);
    expect(result.missing_fields).toContain('faqs_auto_generated');
  });

  it('matches golden tenant FAQ structure', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_FAQ });
    const result = await generator.generate(input);
    expect(result.page_type).toBe('faq');
    expect(result.schema_types).toContain('FAQPage');
    expect(result.schema_types).toContain('BreadcrumbList');
    expect(result.json_ld).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// EventGenerator — 6 tests
// ---------------------------------------------------------------------------

describe('EventGenerator', () => {
  const generator = new EventGenerator();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates Event schema for each detected event', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_EVENTS });
    const result = await generator.generate(input);
    // 2 events + 1 breadcrumb
    expect(result.json_ld).toHaveLength(3);
    expect(result.json_ld[0]['@type']).toBe('Event');
    expect(result.json_ld[1]['@type']).toBe('Event');
    expect(result.json_ld[2]['@type']).toBe('BreadcrumbList');
  });

  it('populates location and organizer from groundTruth', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_EVENTS });
    const result = await generator.generate(input);
    const event = result.json_ld[0] as Record<string, unknown>;
    const location = event.location as Record<string, unknown>;
    expect(location['@type']).toBe('Place');
    expect(location.name).toBe('Charcoal N Chill');
    const organizer = event.organizer as Record<string, unknown>;
    expect(organizer['@type']).toBe('Organization');
    expect(organizer.name).toBe('Charcoal N Chill');
  });

  it('uses startDate when available on the event', async () => {
    const eventPage = makePage({
      page_type: 'event',
      url: 'https://charcoalnchill.com/events',
      detected_events: [
        { name: 'NYE Party', startDate: '2026-12-31T21:00:00' },
      ],
    });
    const input = makeInput({ page: eventPage });
    const result = await generator.generate(input);
    expect(result.json_ld[0].startDate).toBe('2026-12-31T21:00:00');
  });

  it('uses EventSchedule for recurring events without startDate', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_EVENTS });
    const result = await generator.generate(input);
    // Golden tenant events have no startDate
    const event = result.json_ld[0] as Record<string, unknown>;
    const schedule = event.eventSchedule as Record<string, unknown>;
    expect(schedule['@type']).toBe('Schedule');
    expect(schedule.repeatFrequency).toBe('P1W');
    expect(event.startDate).toBeUndefined();
  });

  it('wraps multiple events in @graph-like array with breadcrumb', async () => {
    const input = makeInput({ page: MOCK_CRAWLED_EVENTS });
    const result = await generator.generate(input);
    expect(result.schema_types).toContain('Event');
    expect(result.schema_types).toContain('BreadcrumbList');
    expect(result.json_ld.length).toBeGreaterThan(1);
  });

  it('returns only breadcrumb when no events detected', async () => {
    const noEventsPage = makePage({
      page_type: 'event',
      url: 'https://charcoalnchill.com/events',
      detected_events: [],
    });
    const input = makeInput({ page: noEventsPage });
    const result = await generator.generate(input);
    expect(result.json_ld).toHaveLength(1);
    expect(result.json_ld[0]['@type']).toBe('BreadcrumbList');
    expect(result.confidence).toBe(0.3);
    expect(result.missing_fields).toContain('no_events_detected');
  });
});

// ---------------------------------------------------------------------------
// BlogPostingGenerator — 6 tests
// ---------------------------------------------------------------------------

describe('BlogPostingGenerator', () => {
  const generator = new BlogPostingGenerator();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates BlogPosting with headline from h1', async () => {
    const blogPage = makePage({
      page_type: 'blog_post',
      url: 'https://charcoalnchill.com/blog/best-hookah-flavors',
      h1: 'Top 10 Hookah Flavors for 2026',
      title: 'Blog — Top 10 Hookah Flavors',
      meta_description: 'Discover the most popular hookah flavors this year.',
    });
    const input = makeInput({ page: blogPage });
    const result = await generator.generate(input);
    expect(result.json_ld[0]['@type']).toBe('BlogPosting');
    expect(result.json_ld[0].headline).toBe('Top 10 Hookah Flavors for 2026');
  });

  it('uses meta_description for description field', async () => {
    const blogPage = makePage({
      page_type: 'blog_post',
      url: 'https://charcoalnchill.com/blog/best-hookah-flavors',
      meta_description: 'Discover the most popular hookah flavors.',
    });
    const input = makeInput({ page: blogPage });
    const result = await generator.generate(input);
    expect(result.json_ld[0].description).toBe('Discover the most popular hookah flavors.');
    expect(result.missing_fields).not.toContain('description');
  });

  it('extracts datePublished from body excerpt with ISO date', async () => {
    const blogPage = makePage({
      page_type: 'blog_post',
      url: 'https://charcoalnchill.com/blog/grand-opening',
      body_excerpt: 'Published on 2026-01-15. We are excited to announce...',
    });
    const input = makeInput({ page: blogPage });
    const result = await generator.generate(input);
    expect(result.json_ld[0].datePublished).toBe('2026-01-15');
  });

  it('omits datePublished when no date found — never fabricates', async () => {
    const blogPage = makePage({
      page_type: 'blog_post',
      url: 'https://charcoalnchill.com/blog/tips',
      body_excerpt: 'Here are some great tips for enjoying hookah.',
    });
    const input = makeInput({ page: blogPage });
    const result = await generator.generate(input);
    expect(result.json_ld[0].datePublished).toBeUndefined();
    expect(result.missing_fields).toContain('datePublished');
  });

  it('sets author and publisher as Organization (not Person)', async () => {
    const blogPage = makePage({
      page_type: 'blog_post',
      url: 'https://charcoalnchill.com/blog/new-menu',
    });
    const input = makeInput({ page: blogPage });
    const result = await generator.generate(input);
    const author = result.json_ld[0].author as Record<string, unknown>;
    const publisher = result.json_ld[0].publisher as Record<string, unknown>;
    expect(author['@type']).toBe('Organization');
    expect(author.name).toBe('Charcoal N Chill');
    expect(publisher['@type']).toBe('Organization');
    expect(publisher.name).toBe('Charcoal N Chill');
  });

  it('includes mainEntityOfPage with WebPage reference', async () => {
    const blogPage = makePage({
      page_type: 'blog_post',
      url: 'https://charcoalnchill.com/blog/special',
    });
    const input = makeInput({ page: blogPage });
    const result = await generator.generate(input);
    const mainEntity = result.json_ld[0].mainEntityOfPage as Record<string, unknown>;
    expect(mainEntity['@type']).toBe('WebPage');
    expect(mainEntity['@id']).toBe('https://charcoalnchill.com/blog/special');
  });
});

// ---------------------------------------------------------------------------
// ServiceGenerator — 5 tests
// ---------------------------------------------------------------------------

describe('ServiceGenerator', () => {
  const generator = new ServiceGenerator();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates Service schema with @type Service', async () => {
    const servicePage = makePage({
      page_type: 'service',
      url: 'https://charcoalnchill.com/private-events',
      h1: 'Private Event Hosting',
      meta_description: 'Book your private event at Charcoal N Chill.',
    });
    const input = makeInput({ page: servicePage });
    const result = await generator.generate(input);
    expect(result.json_ld[0]['@type']).toBe('Service');
  });

  it('sets name from h1 heading', async () => {
    const servicePage = makePage({
      page_type: 'service',
      url: 'https://charcoalnchill.com/catering',
      h1: 'Catering Services',
    });
    const input = makeInput({ page: servicePage });
    const result = await generator.generate(input);
    expect(result.json_ld[0].name).toBe('Catering Services');
    expect(result.json_ld[0].serviceType).toBe('Catering Services');
  });

  it('includes provider as Organization with address', async () => {
    const servicePage = makePage({
      page_type: 'service',
      url: 'https://charcoalnchill.com/vip',
      h1: 'VIP Packages',
    });
    const input = makeInput({ page: servicePage });
    const result = await generator.generate(input);
    const provider = result.json_ld[0].provider as Record<string, unknown>;
    expect(provider['@type']).toBe('Organization');
    expect(provider.name).toBe('Charcoal N Chill');
    const providerAddress = provider.address as Record<string, unknown>;
    expect(providerAddress['@type']).toBe('PostalAddress');
    expect(providerAddress.addressLocality).toBe('Alpharetta');
  });

  it('sets areaServed with City type', async () => {
    const servicePage = makePage({
      page_type: 'service',
      url: 'https://charcoalnchill.com/hookah-service',
      h1: 'Hookah Service',
    });
    const input = makeInput({ page: servicePage });
    const result = await generator.generate(input);
    const areaServed = result.json_ld[0].areaServed as Record<string, unknown>;
    expect(areaServed['@type']).toBe('City');
    expect(areaServed.name).toBe('Alpharetta, GA');
  });

  it('derives serviceType from h1 and tracks missing when absent', async () => {
    const servicePage = makePage({
      page_type: 'service',
      url: 'https://charcoalnchill.com/services',
      h1: null,
      title: 'Our Services',
    });
    const input = makeInput({ page: servicePage });
    const result = await generator.generate(input);
    expect(result.json_ld[0].serviceType).toBeUndefined();
    expect(result.missing_fields).toContain('serviceType');
  });
});

// ---------------------------------------------------------------------------
// validateSchemaBeforePublish — 5 tests
// ---------------------------------------------------------------------------

describe('validateSchemaBeforePublish', () => {
  it('validates a complete, well-formed schema', () => {
    const jsonLd = [
      { '@type': 'LocalBusiness', name: 'Test', url: 'https://example.com' },
      { '@type': 'BreadcrumbList', itemListElement: [] },
    ];
    const result = validateSchemaBeforePublish(jsonLd);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects schema missing @type', () => {
    const jsonLd = [{ name: 'No Type' }];
    const result = validateSchemaBeforePublish(jsonLd);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing @type on schema object');
  });

  it('rejects FAQPage with empty mainEntity', () => {
    const jsonLd = [{ '@type': 'FAQPage', mainEntity: [] }];
    const result = validateSchemaBeforePublish(jsonLd);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('FAQPage has empty mainEntity array');
  });

  it('rejects Event without name', () => {
    const jsonLd = [{ '@type': 'Event', startDate: '2026-01-01' }];
    const result = validateSchemaBeforePublish(jsonLd);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Event schema missing name');
  });

  it('rejects BlogPosting without headline', () => {
    const jsonLd = [{ '@type': 'BlogPosting', url: 'https://example.com/blog' }];
    const result = validateSchemaBeforePublish(jsonLd);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('BlogPosting schema missing headline');
  });
});

// ---------------------------------------------------------------------------
// generateEmbedSnippet — 4 tests
// ---------------------------------------------------------------------------

describe('generateEmbedSnippet', () => {
  it('starts with an HTML comment containing page type', () => {
    const jsonLd = [{ '@type': 'LocalBusiness', name: 'Test' }];
    const snippet = generateEmbedSnippet(jsonLd, 'homepage');
    expect(snippet).toMatch(/^<!-- LocalVector Schema — homepage/);
    expect(snippet).toContain('-->');
  });

  it('wraps each JSON-LD object in a script tag', () => {
    const jsonLd = [
      { '@type': 'LocalBusiness', name: 'Test' },
      { '@type': 'BreadcrumbList', itemListElement: [] },
    ];
    const snippet = generateEmbedSnippet(jsonLd, 'homepage');
    const scriptMatches = snippet.match(/<script type="application\/ld\+json">/g);
    expect(scriptMatches).toHaveLength(2);
    const closeMatches = snippet.match(/<\/script>/g);
    expect(closeMatches).toHaveLength(2);
  });

  it('produces valid HTML structure', () => {
    const jsonLd = [{ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q?' }] }];
    const snippet = generateEmbedSnippet(jsonLd, 'faq');
    // Must have matching open/close script tags
    expect(snippet).toContain('<script type="application/ld+json">');
    expect(snippet).toContain('</script>');
    // Comment at top
    expect(snippet.startsWith('<!--')).toBe(true);
  });

  it('pretty-prints JSON inside script tags', () => {
    const jsonLd = [{ '@type': 'Event', name: 'Test Event', startDate: '2026-01-01' }];
    const snippet = generateEmbedSnippet(jsonLd, 'event');
    // JSON.stringify with indent 2 produces newlines
    expect(snippet).toContain('"@type": "Event"');
    expect(snippet).toContain('"name": "Test Event"');
    // Multi-line (indented)
    const lines = snippet.split('\n');
    expect(lines.length).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// Generator Registry — 2 tests (bonus coverage)
// ---------------------------------------------------------------------------

describe('getGeneratorForPageType', () => {
  it('returns null for menu pages (Magic Engine)', () => {
    expect(getGeneratorForPageType('menu')).toBeNull();
  });

  it('returns LocalBusinessGenerator for "other" pages as fallback', () => {
    const generator = getGeneratorForPageType('other');
    expect(generator).toBeInstanceOf(LocalBusinessGenerator);
  });
});
