// ---------------------------------------------------------------------------
// sameas-enricher.test.ts — Sprint 108: sameAs enricher unit tests
//
// Covers generateSameAsInstructions (14), HIGH_VALUE_SAMEAS_PLATFORMS (3),
// and checkWikidataEntity (3, fetch mocked).
//
// Run:
//   npx vitest run src/__tests__/unit/sameas-enricher.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  generateSameAsInstructions,
  HIGH_VALUE_SAMEAS_PLATFORMS,
  checkWikidataEntity,
} from '@/lib/authority/sameas-enricher';

// ── Test constants ────────────────────────────────────────────────────────

const BIZ = 'Charcoal N Chill';
const CITY = 'Alpharetta';

// ── generateSameAsInstructions ────────────────────────────────────────────

describe('generateSameAsInstructions', () => {
  it('wikidata: returns medium effort and includes business name', () => {
    const result = generateSameAsInstructions('wikidata', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_label).toContain(BIZ);
    expect(result.action_instructions).toContain('wikidata.org');
  });

  it('wikipedia: returns high effort and includes city', () => {
    const result = generateSameAsInstructions('wikipedia', BIZ, CITY);
    expect(result.effort).toBe('high');
    expect(result.action_instructions).toContain(CITY);
  });

  it('yelp without existingUrl: returns medium effort and mentions biz.yelp.com', () => {
    const result = generateSameAsInstructions('yelp', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_instructions).toContain('biz.yelp.com');
  });

  it('yelp with existingUrl: returns low effort and includes the URL', () => {
    const url = 'https://www.yelp.com/biz/charcoal-n-chill-alpharetta';
    const result = generateSameAsInstructions('yelp', BIZ, CITY, url);
    expect(result.effort).toBe('low');
    expect(result.action_instructions).toContain(url);
  });

  it('tripadvisor without existingUrl: returns medium effort', () => {
    const result = generateSameAsInstructions('tripadvisor', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_instructions).toContain('tripadvisor.com');
  });

  it('tripadvisor with existingUrl: returns low effort', () => {
    const url = 'https://www.tripadvisor.com/Restaurant_Review-charcoal';
    const result = generateSameAsInstructions('tripadvisor', BIZ, CITY, url);
    expect(result.effort).toBe('low');
    expect(result.action_instructions).toContain(url);
  });

  it('google_maps: returns low effort', () => {
    const result = generateSameAsInstructions('google_maps', BIZ, CITY);
    expect(result.effort).toBe('low');
    expect(result.action_instructions).toContain(BIZ);
  });

  it('apple_maps: returns medium effort', () => {
    const result = generateSameAsInstructions('apple_maps', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_instructions).toContain('mapsconnect.apple.com');
  });

  it('facebook without existingUrl: returns medium effort', () => {
    const result = generateSameAsInstructions('facebook', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_label).toContain(BIZ);
  });

  it('facebook with existingUrl: returns low effort', () => {
    const url = 'https://www.facebook.com/charcoalnchill';
    const result = generateSameAsInstructions('facebook', BIZ, CITY, url);
    expect(result.effort).toBe('low');
    expect(result.action_instructions).toContain(url);
  });

  it('foursquare: returns medium effort', () => {
    const result = generateSameAsInstructions('foursquare', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_instructions).toContain('foursquare.com');
  });

  it('opentable: returns high effort', () => {
    const result = generateSameAsInstructions('opentable', BIZ, CITY);
    expect(result.effort).toBe('high');
    expect(result.action_instructions).toContain('opentable.com');
  });

  it('unknown platform: returns medium effort (default case)', () => {
    const result = generateSameAsInstructions('zomato', BIZ, CITY);
    expect(result.effort).toBe('medium');
    expect(result.action_label).toContain('zomato');
    expect(result.action_instructions).toContain('zomato');
  });

  it('all action_labels include business name or platform name', () => {
    const platforms = [
      'wikidata', 'wikipedia', 'yelp', 'tripadvisor', 'google_maps',
      'apple_maps', 'facebook', 'foursquare', 'opentable', 'unknown_xyz',
    ];
    for (const platform of platforms) {
      const result = generateSameAsInstructions(platform, BIZ, CITY);
      const label = result.action_label.toLowerCase();
      const containsBiz = label.includes(BIZ.toLowerCase());
      const containsPlatform = label.includes(platform.toLowerCase())
        || label.includes(platform.replace('_', ' ').toLowerCase());
      expect(
        containsBiz || containsPlatform,
        `action_label for "${platform}" should include business name or platform name, got: "${result.action_label}"`,
      ).toBe(true);
    }
  });
});

// ── HIGH_VALUE_SAMEAS_PLATFORMS ───────────────────────────────────────────

describe('HIGH_VALUE_SAMEAS_PLATFORMS', () => {
  it('has 9 platforms', () => {
    expect(HIGH_VALUE_SAMEAS_PLATFORMS).toHaveLength(9);
  });

  it('all have tier2', () => {
    for (const p of HIGH_VALUE_SAMEAS_PLATFORMS) {
      expect(p.tier).toBe('tier2');
    }
  });

  it('wikidata and wikipedia have high impact', () => {
    const wikidata = HIGH_VALUE_SAMEAS_PLATFORMS.find(p => p.platform === 'wikidata');
    const wikipedia = HIGH_VALUE_SAMEAS_PLATFORMS.find(p => p.platform === 'wikipedia');
    expect(wikidata).toBeDefined();
    expect(wikipedia).toBeDefined();
    expect(wikidata!.estimated_impact).toBe('high');
    expect(wikipedia!.estimated_impact).toBe('high');
  });
});

// ── checkWikidataEntity ──────────────────────────────────────────────────

describe('checkWikidataEntity', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns found: true when API returns a match', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          search: [
            { id: 'Q12345', label: 'Charcoal N Chill', description: 'restaurant in Alpharetta' },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await checkWikidataEntity(BIZ, CITY);

    expect(result.found).toBe(true);
    expect(result.wikidataUrl).toBe('https://www.wikidata.org/wiki/Q12345');
    expect(result.qId).toBe('Q12345');
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toContain('wbsearchentities');
  });

  it('returns found: false when API returns empty results', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ search: [] }),
        { status: 200 },
      ),
    );

    const result = await checkWikidataEntity(BIZ, CITY);

    expect(result.found).toBe(false);
    expect(result.wikidataUrl).toBeUndefined();
    expect(result.qId).toBeUndefined();
  });

  it('returns found: false on network error (fetch throws)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkWikidataEntity(BIZ, CITY);

    expect(result.found).toBe(false);
    expect(result.wikidataUrl).toBeUndefined();
    expect(result.qId).toBeUndefined();
  });
});
