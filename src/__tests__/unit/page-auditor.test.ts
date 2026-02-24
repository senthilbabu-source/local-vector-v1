// ---------------------------------------------------------------------------
// page-auditor.test.ts — Unit tests for lib/page-audit/auditor
//
// Strategy:
//   • auditPage() is tested with fetch mocked (no real HTTP)
//   • AI SDK (generateText) is mocked — heuristic scoring path tested
//   • Scoring dimension functions tested via auditPage integration
//
// Run:
//   npx vitest run src/__tests__/unit/page-auditor.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock the AI SDK ──────────────────────────────────────────────────────
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ output: { score: 50 } }),
  Output: {
    object: vi.fn(({ schema }: { schema: unknown }) => ({ schema })),
  },
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: vi.fn().mockReturnValue(false), // Default: heuristic scoring
}));

import { auditPage, type LocationContext } from '@/lib/page-audit/auditor';

// ── Test data ────────────────────────────────────────────────────────────

const LOCATION: LocationContext = {
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  categories: ['Hookah Bar'],
  amenities: { has_hookah: true, has_outdoor_seating: true, serves_alcohol: true },
};

function makeHtml(options: {
  body?: string;
  jsonLd?: string;
  title?: string;
  h1?: string;
  metaDesc?: string;
} = {}): string {
  return `
    <html>
      <head>
        <title>${options.title ?? 'Test Page'}</title>
        <meta name="description" content="${options.metaDesc ?? ''}">
        ${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>` : ''}
      </head>
      <body>
        ${options.h1 ? `<h1>${options.h1}</h1>` : ''}
        ${options.body ?? '<p>Default content</p>'}
      </body>
    </html>
  `;
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Mock global fetch for page fetching
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('auditPage', () => {
  it('throws when page fetch returns non-200', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(
      auditPage('https://example.com', 'homepage', LOCATION),
    ).rejects.toThrow('Page fetch failed: 404');
  });

  it('returns all scoring dimensions for a well-optimized page', async () => {
    const html = makeHtml({
      title: 'Charcoal N Chill — Hookah Bar Alpharetta GA',
      h1: 'Charcoal N Chill',
      body: `
        <p>Charcoal N Chill is Alpharetta's premier hookah lounge and Indo-American
        fusion restaurant in Alpharetta, GA. Call us at (770) 555-1234.</p>
        <p>Open Monday-Saturday 5:00 PM - 2:00 AM. Outdoor seating available.
        Full bar with premium alcohol selection.</p>
      `,
      jsonLd: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        'name': 'Charcoal N Chill',
        'address': { '@type': 'PostalAddress', 'addressLocality': 'Alpharetta' },
        'telephone': '(770) 555-1234',
        'openingHours': 'Mo-Sa 17:00-02:00',
      }),
      metaDesc: 'Premium hookah and dining in Alpharetta GA',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await auditPage('https://charcoalnchill.com', 'homepage', LOCATION);

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.answerFirstScore).toBeGreaterThan(0);
    expect(result.schemaCompletenessScore).toBeGreaterThan(0);
    expect(result.keywordDensityScore).toBeGreaterThan(0);
    expect(result.entityClarityScore).toBeGreaterThan(0);
  });

  it('gives low scores for a page with no schema and thin content', async () => {
    const html = makeHtml({
      body: '<p>Welcome to our website.</p>',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    expect(result.schemaCompletenessScore).toBe(0);
    expect(result.faqSchemaPresent).toBe(false);
    expect(result.faqSchemaScore).toBe(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('scores FAQPage schema with 5+ Q&A pairs at 100', async () => {
    const faqs = Array.from({ length: 5 }, (_, i) => ({
      '@type': 'Question',
      name: `Question ${i + 1}?`,
      acceptedAnswer: { '@type': 'Answer', text: `Answer ${i + 1}` },
    }));

    const html = makeHtml({
      jsonLd: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs,
      }),
      body: '<p>FAQ content</p>',
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await auditPage('https://example.com/faq', 'faq', LOCATION);

    expect(result.faqSchemaPresent).toBe(true);
    expect(result.faqSchemaScore).toBe(100);
  });

  it('detects phone number for entity clarity', async () => {
    const html = makeHtml({
      h1: 'Charcoal N Chill',
      title: 'Charcoal N Chill',
      body: `
        <p>Charcoal N Chill in Alpharetta, GA.</p>
        <p>Call (770) 555-1234</p>
        <p>Monday 5:00 PM - 11:00 PM</p>
      `,
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    // Should get good entity clarity: name in H1, city+state, phone, hours
    expect(result.entityClarityScore).toBeGreaterThanOrEqual(75);
  });

  it('generates recommendations sorted by impact', async () => {
    const html = makeHtml({ body: '<p>Minimal content</p>' });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    // Should have multiple recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Should be sorted by impactPoints descending
    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i - 1].impactPoints)
        .toBeGreaterThanOrEqual(result.recommendations[i].impactPoints);
    }
  });

  it('weighted score formula matches Doc 17 §2.1', async () => {
    const html = makeHtml({
      body: '<p>Charcoal N Chill in Alpharetta GA is a hookah bar.</p>',
      jsonLd: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: 'Charcoal N Chill',
        address: {},
        telephone: '',
        openingHours: '',
      }),
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response);

    const result = await auditPage('https://example.com', 'homepage', LOCATION);

    // Verify overall is the weighted formula
    const expected = Math.round(
      (result.answerFirstScore * 0.35) +
      (result.schemaCompletenessScore * 0.25) +
      (result.faqSchemaScore * 0.20) +
      (result.keywordDensityScore * 0.10) +
      (result.entityClarityScore * 0.10),
    );

    expect(result.overallScore).toBe(expected);
  });
});
