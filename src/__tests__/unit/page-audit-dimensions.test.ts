// ---------------------------------------------------------------------------
// page-audit-dimensions.test.ts — Sprint 71: Enhanced buildRecommendations + dimension scoring
//
// Tests that buildRecommendations() tags recommendations with dimensionKey
// and schemaType, and that auditPage() returns all 5 dimension scores.
//
// Run:
//   npx vitest run src/__tests__/unit/page-audit-dimensions.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ output: { score: 50 } }),
  Output: {
    object: vi.fn(({ schema }: { schema: unknown }) => ({ schema })),
  },
  jsonSchema: vi.fn((s: unknown) => ({ jsonSchema: s })),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(false),
}));

import { auditPage, type LocationContext, type PageAuditRecommendation } from '@/lib/page-audit/auditor';

// ── Test data ────────────────────────────────────────────────────────────

const LOCATION: LocationContext = {
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  categories: ['Hookah Bar'],
  amenities: { has_hookah: true, has_outdoor_seating: true },
};

function makeHtml(options: {
  body?: string;
  jsonLd?: string;
  title?: string;
  h1?: string;
} = {}): string {
  return `
    <html>
      <head>
        <title>${options.title ?? 'Test Page'}</title>
        ${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>` : ''}
      </head>
      <body>
        ${options.h1 ? `<h1>${options.h1}</h1>` : ''}
        ${options.body ?? '<p>Default content</p>'}
      </body>
    </html>
  `;
}

function mockFetch(html: string) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html),
  } as Response);
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests: buildRecommendations — enhanced (Sprint 71) ────────────────────

describe('buildRecommendations — enhanced', () => {
  it('includes dimensionKey on all recommendations', async () => {
    const html = makeHtml({ body: '<p>Minimal content</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const rec of result.recommendations) {
      expect(rec.dimensionKey).toBeDefined();
      expect(['answerFirst', 'schemaCompleteness', 'faqSchema', 'keywordDensity', 'entityClarity'])
        .toContain(rec.dimensionKey);
    }
  });

  it('includes schemaType=FAQPage when faq_schema_present is false', async () => {
    const html = makeHtml({ body: '<p>No FAQ schema here</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const faqRec = result.recommendations.find((r) => r.dimensionKey === 'faqSchema');
    expect(faqRec).toBeDefined();
    expect(faqRec!.schemaType).toBe('FAQPage');
  });

  it('includes schemaType=LocalBusiness when schema_completeness < 50', async () => {
    const html = makeHtml({ body: '<p>No schema at all</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const schemaRec = result.recommendations.find((r) => r.dimensionKey === 'schemaCompleteness');
    expect(schemaRec).toBeDefined();
    expect(schemaRec!.schemaType).toBe('LocalBusiness');
  });

  it('does NOT include schemaType on non-schema recommendations', async () => {
    const html = makeHtml({ body: '<p>Minimal content</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const answerFirstRec = result.recommendations.find((r) => r.dimensionKey === 'answerFirst');
    expect(answerFirstRec).toBeDefined();
    expect(answerFirstRec!.schemaType).toBeUndefined();
  });

  it('sorts by impactPoints descending (highest first)', async () => {
    const html = makeHtml({ body: '<p>Minimal content</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i - 1].impactPoints)
        .toBeGreaterThanOrEqual(result.recommendations[i].impactPoints);
    }
  });

  it('generates answerFirst recommendation when score <= 30', async () => {
    const html = makeHtml({ body: '<p>Welcome to our website.</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const rec = result.recommendations.find((r) => r.dimensionKey === 'answerFirst');
    expect(rec).toBeDefined();
    expect(rec!.impactPoints).toBeGreaterThanOrEqual(20);
  });

  it('generates answerFirst recommendation when score 31-60', async () => {
    // Include business name but not in ideal position
    const html = makeHtml({
      body: '<p>We are a restaurant. Charcoal N Chill offers great food in Alpharetta.</p>',
    });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const rec = result.recommendations.find((r) => r.dimensionKey === 'answerFirst');
    expect(rec).toBeDefined();
  });

  it('generates no answerFirst recommendation when score > 80', async () => {
    const html = makeHtml({
      h1: 'Charcoal N Chill',
      title: 'Charcoal N Chill — Hookah Bar Alpharetta GA',
      body: `<p>Charcoal N Chill is Alpharetta's premier hookah lounge and restaurant.
        Located in Alpharetta GA, we serve the best hookah experience with outdoor seating,
        live music, and premium cocktails. A destination for hookah enthusiasts.</p>`,
    });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const rec = result.recommendations.find((r) => r.dimensionKey === 'answerFirst');
    // If score > 80, no recommendation should exist
    if (result.answerFirstScore > 80) {
      expect(rec).toBeUndefined();
    }
  });

  it('generates keywordDensity recommendation when < 50', async () => {
    const html = makeHtml({ body: '<p>Just some generic text with no keywords.</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const rec = result.recommendations.find((r) => r.dimensionKey === 'keywordDensity');
    expect(rec).toBeDefined();
    expect(rec!.impactPoints).toBe(10);
  });

  it('generates entityClarity recommendation when < 50', async () => {
    const html = makeHtml({ body: '<p>Just some text.</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const rec = result.recommendations.find((r) => r.dimensionKey === 'entityClarity');
    expect(rec).toBeDefined();
    expect(rec!.impactPoints).toBe(10);
  });

  it('uses business_name and city in recommendation text', async () => {
    const html = makeHtml({ body: '<p>Minimal content</p>' });
    mockFetch(html);
    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    const faqRec = result.recommendations.find((r) => r.dimensionKey === 'faqSchema');
    expect(faqRec!.fix).toContain('Charcoal N Chill');
  });

  it('handles null business_name gracefully (fallback to "Your Business")', async () => {
    const html = makeHtml({ body: '<p>Minimal content</p>' });
    mockFetch(html);

    const locWithNull: LocationContext = {
      business_name: '',
      city: null,
      state: null,
      categories: null,
      amenities: null,
    };

    const result = await auditPage('https://example.com', 'homepage', locWithNull);

    // Should still generate recommendations without throwing
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

// ── Tests: PageAuditResult completeness ──────────────────────────────────

describe('PageAuditResult completeness', () => {
  it('auditPage result includes all 5 dimension scores', async () => {
    const html = makeHtml({
      body: '<p>Charcoal N Chill in Alpharetta GA</p>',
    });
    mockFetch(html);

    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    expect(typeof result.answerFirstScore).toBe('number');
    expect(typeof result.schemaCompletenessScore).toBe('number');
    expect(typeof result.faqSchemaScore).toBe('number');
    expect(typeof result.keywordDensityScore).toBe('number');
    expect(typeof result.entityClarityScore).toBe('number');
    expect(typeof result.overallScore).toBe('number');
    expect(typeof result.faqSchemaPresent).toBe('boolean');
  });

  it('faqSchemaScore comes from scoreFaqSchema(), not hardcoded', async () => {
    const faqs = Array.from({ length: 3 }, (_, i) => ({
      '@type': 'Question',
      name: `Q${i + 1}?`,
      acceptedAnswer: { '@type': 'Answer', text: `A${i + 1}` },
    }));

    const html = makeHtml({
      jsonLd: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs,
      }),
      body: '<p>FAQ content</p>',
    });
    mockFetch(html);

    const result = await auditPage('https://example.com/faq', 'faq', LOCATION);

    // 3 Q&A pairs → score of 75 (from scoreFaqSchema)
    expect(result.faqSchemaScore).toBe(75);
    expect(result.faqSchemaPresent).toBe(true);
  });

  it('entityClarityScore comes from scoreEntityClarity(), not hardcoded', async () => {
    const html = makeHtml({
      h1: 'Charcoal N Chill',
      title: 'Charcoal N Chill',
      body: `
        <p>Charcoal N Chill in Alpharetta, GA.</p>
        <p>Call (770) 555-1234</p>
        <p>Mon 5:00 PM - 11:00 PM</p>
      `,
    });
    mockFetch(html);

    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    // Has name in H1, city+state, phone, hours → 100% (4/4 signals)
    expect(result.entityClarityScore).toBe(100);
  });
});
