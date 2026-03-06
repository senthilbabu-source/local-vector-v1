// ---------------------------------------------------------------------------
// Unit tests for lib/authority/citation-nap-checker.ts
// Sprint 211: Citation NAP consistency checker
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/__helpers__/setup';
import {
  extractNAPFromPage,
  checkCitationNAP,
} from '@/lib/authority/citation-nap-checker';
import type { CitationSource, GroundTruth } from '@/lib/authority/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGroundTruth(overrides: Partial<GroundTruth> = {}): GroundTruth {
  return {
    location_id: 'loc-001',
    org_id: 'org-001',
    name: 'Charcoal N Chill',
    address: '123 Main Street',
    city: 'Atlanta',
    state: 'GA',
    zip: '30301',
    phone: '(404) 555-1234',
    website: 'https://charcoalnchill.com',
    ...overrides,
  };
}

function makeCitation(overrides: Partial<CitationSource> = {}): CitationSource {
  return {
    url: 'https://foursquare.com/v/charcoal-n-chill/abc123',
    domain: 'foursquare.com',
    tier: 'tier2',
    source_type: 'foursquare',
    snippet: 'Great hookah spot',
    detected_at: new Date().toISOString(),
    sentiment: 'positive',
    is_sameas_candidate: true,
    ...overrides,
  };
}

function makeLocalBusinessHtml(overrides: {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  url?: string;
} = {}): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: overrides.name ?? 'Charcoal N Chill',
    telephone: overrides.phone ?? '(404) 555-1234',
    address: {
      '@type': 'PostalAddress',
      streetAddress: overrides.address ?? '123 Main Street',
      addressLocality: overrides.city ?? 'Atlanta',
      addressRegion: 'GA',
      postalCode: '30301',
    },
    url: overrides.url ?? 'https://charcoalnchill.com',
  };
  return `<html><head><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body></body></html>`;
}

// ── extractNAPFromPage ────────────────────────────────────────────────────────

describe('extractNAPFromPage', () => {
  it('extracts all NAP fields from a LocalBusiness JSON-LD block', () => {
    const html = makeLocalBusinessHtml();
    const result = extractNAPFromPage(html);

    expect(result.name).toBe('Charcoal N Chill');
    expect(result.phone).toBe('(404) 555-1234');
    expect(result.address).toBe('123 Main Street');
    expect(result.city).toBe('Atlanta');
    expect(result.state).toBe('GA');
    expect(result.zip).toBe('30301');
  });

  it('extracts from a Restaurant @type', () => {
    const html = makeLocalBusinessHtml({ name: 'Smoke House BBQ' });
    const result = extractNAPFromPage(html);
    expect(result.name).toBe('Smoke House BBQ');
  });

  it('handles @graph array wrapping LocalBusiness', () => {
    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Site' },
        {
          '@type': 'Restaurant',
          name: 'Taco Palace',
          telephone: '+1-770-555-9999',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '500 Peachtree St',
            addressLocality: 'Atlanta',
            addressRegion: 'GA',
          },
        },
      ],
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(schema)}</script></head></html>`;
    const result = extractNAPFromPage(html);

    expect(result.name).toBe('Taco Palace');
    expect(result.phone).toBe('+1-770-555-9999');
    expect(result.address).toBe('500 Peachtree St');
  });

  it('falls back to phone regex when no JSON-LD is present', () => {
    const html = '<html><body><p>Call us: (404) 555-9876</p></body></html>';
    const result = extractNAPFromPage(html);

    expect(result.phone).toBeDefined();
    // normalizePhone strips to last 10 digits
    expect(result.phone).toBe('4045559876');
    expect(result.name).toBeUndefined();
    expect(result.address).toBeUndefined();
  });

  it('returns empty object when page has no NAP data', () => {
    const html = '<html><body><p>Welcome to our restaurant!</p></body></html>';
    const result = extractNAPFromPage(html);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('skips non-LocalBusiness JSON-LD types', () => {
    const schema = { '@type': 'WebPage', name: 'Home' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(schema)}</script></head></html>`;
    const result = extractNAPFromPage(html);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('handles malformed JSON-LD gracefully and tries next block', () => {
    const validSchema = { '@type': 'Restaurant', name: 'Valid Place', telephone: '4045550000' };
    const html = [
      '<script type="application/ld+json">{ invalid json }</script>',
      `<script type="application/ld+json">${JSON.stringify(validSchema)}</script>`,
    ].join('\n');
    const result = extractNAPFromPage(html);
    expect(result.name).toBe('Valid Place');
  });

  it('extracts from FoodEstablishment @type', () => {
    const schema = {
      '@type': 'FoodEstablishment',
      name: 'Food Court Grill',
      telephone: '6785550001',
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(schema)}</script></head></html>`;
    const result = extractNAPFromPage(html);
    expect(result.name).toBe('Food Court Grill');
  });

  it('handles array @type including Restaurant', () => {
    const schema = { '@type': ['Restaurant', 'LocalBusiness'], name: 'Duo Place', telephone: '4045551111' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(schema)}</script></head></html>`;
    const result = extractNAPFromPage(html);
    expect(result.name).toBe('Duo Place');
  });
});

// ── checkCitationNAP ──────────────────────────────────────────────────────────

describe('checkCitationNAP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array when no sameas-candidate citations exist', async () => {
    const citations = [
      makeCitation({ is_sameas_candidate: false }),
      makeCitation({ is_sameas_candidate: false }),
    ];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toHaveLength(0);
  });

  it('returns critical severity on phone mismatch', async () => {
    const url = 'https://foursquare.com/v/charcoal-n-chill/abc123';
    server.use(
      http.get(url, () =>
        HttpResponse.text(makeLocalBusinessHtml({ phone: '(770) 999-0000' })),
      ),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
    expect(result[0].discrepant_fields.some((f) => f.field === 'phone')).toBe(true);
    expect(result[0].domain).toBe('foursquare.com');
  });

  it('returns critical severity on address mismatch', async () => {
    const url = 'https://opentable.com/r/charcoal-n-chill-atlanta';
    server.use(
      http.get(url, () =>
        HttpResponse.text(makeLocalBusinessHtml({ address: '999 Wrong Blvd' })),
      ),
    );

    const citations = [makeCitation({ url, domain: 'opentable.com' })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
    expect(result[0].discrepant_fields.some((f) => f.field === 'address')).toBe(true);
  });

  it('returns high severity on name mismatch', async () => {
    const url = 'https://foursquare.com/v/wrong-name/abc123';
    server.use(
      http.get(url, () =>
        HttpResponse.text(makeLocalBusinessHtml({ name: 'Completely Wrong Name' })),
      ),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('high');
  });

  it('returns empty when page NAP matches golden record', async () => {
    const url = 'https://foursquare.com/v/charcoal-n-chill/match';
    server.use(
      http.get(url, () =>
        HttpResponse.text(makeLocalBusinessHtml()),
      ),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(0);
  });

  it('returns empty when page has no extractable NAP', async () => {
    const url = 'https://foursquare.com/v/no-schema/abc123';
    server.use(
      http.get(url, () =>
        HttpResponse.text('<html><body>No structured data here</body></html>'),
      ),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(0);
  });

  it('skips non-200 responses (fail-open)', async () => {
    const url = 'https://foursquare.com/v/not-found/abc123';
    server.use(
      http.get(url, () => new HttpResponse(null, { status: 404 })),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(0);
  });

  it('skips a citation on fetch error without throwing (fail-open)', async () => {
    const url = 'https://foursquare.com/v/network-error/abc123';
    server.use(
      http.get(url, () => HttpResponse.error()),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(0);
  });

  it('includes fix_instructions referencing the domain and url', async () => {
    const url = 'https://foursquare.com/v/wrong-phone/abc123';
    server.use(
      http.get(url, () =>
        HttpResponse.text(makeLocalBusinessHtml({ phone: '(770) 000-1111' })),
      ),
    );

    const citations = [makeCitation({ url })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result[0].fix_instructions).toContain('foursquare.com');
    expect(result[0].fix_instructions).toContain(url);
    expect(result[0].fix_instructions).toContain('phone');
  });

  it('processes multiple citations and returns only discrepant ones', async () => {
    const urlMatch = 'https://foursquare.com/v/match/001';
    const urlMismatch = 'https://opentable.com/r/mismatch/002';

    server.use(
      http.get(urlMatch, () =>
        HttpResponse.text(makeLocalBusinessHtml()),
      ),
      http.get(urlMismatch, () =>
        HttpResponse.text(makeLocalBusinessHtml({ phone: '(770) 999-8888' })),
      ),
    );

    const citations = [
      makeCitation({ url: urlMatch, domain: 'foursquare.com' }),
      makeCitation({ url: urlMismatch, domain: 'opentable.com' }),
    ];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('opentable.com');
  });

  it('skips non-sameas citations even if they have NAP data', async () => {
    const url = 'https://yelp.com/biz/charcoal-n-chill';
    server.use(
      http.get(url, () =>
        HttpResponse.text(makeLocalBusinessHtml({ phone: '(770) 999-0000' })),
      ),
    );

    const citations = [makeCitation({ url, is_sameas_candidate: false })];
    const promise = checkCitationNAP(citations, makeGroundTruth());
    await vi.runAllTimersAsync();
    const result = await promise;

    // Non-sameas citations are never fetched regardless of content
    expect(result).toHaveLength(0);
  });
});
