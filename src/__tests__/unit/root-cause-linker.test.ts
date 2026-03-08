// ---------------------------------------------------------------------------
// Sprint 5: Root-Cause Linker — Unit Tests
//
// Pure function tests for identifyRootCauseSources + mock-based test for
// enrichHallucinationWithRootCause.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  identifyRootCauseSources,
  enrichHallucinationWithRootCause,
  CATEGORY_SOURCE_MAP,
} from '@/lib/services/root-cause-linker.service';

// Mock Sentry to prevent real error reporting
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Mock source-intelligence extractDomainName (used internally)
vi.mock('@/lib/services/source-intelligence.service', () => ({
  extractDomainName: vi.fn((url: string) => {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const map: Record<string, string> = {
        'yelp.com': 'Yelp',
        'tripadvisor.com': 'TripAdvisor',
        'google.com': 'Google',
        'yellowpages.com': 'Yellow Pages',
        'bingplaces.com': 'Bing Places',
        'bbb.org': 'Better Business Bureau',
        'opentable.com': 'OpenTable',
      };
      for (const [domain, name] of Object.entries(map)) {
        if (hostname.includes(domain)) return name;
      }
      return hostname;
    } catch {
      return url;
    }
  }),
}));

describe('identifyRootCauseSources', () => {
  it('1. returns empty array when hallucinationCategory is null', () => {
    const result = identifyRootCauseSources(
      null,
      [{ url: 'https://yelp.com/biz/test', title: 'Test Yelp' }],
      [],
    );
    expect(result).toEqual([]);
  });

  it('2. returns empty array when citedSources and sourceMentions are both empty', () => {
    const result = identifyRootCauseSources('hours', [], []);
    expect(result).toEqual([]);
  });

  it('3. identifies Yelp as high-confidence root cause for hours hallucination', () => {
    const result = identifyRootCauseSources(
      'hours',
      [{ url: 'https://www.yelp.com/biz/my-restaurant', title: 'My Restaurant - Yelp' }],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      url: 'https://www.yelp.com/biz/my-restaurant',
      platform: 'Yelp',
      confidence: 'high',
    });
  });

  it('4. identifies Google as high-confidence root cause for address hallucination', () => {
    const result = identifyRootCauseSources(
      'address',
      [{ url: 'https://www.google.com/maps/place/my-biz', title: 'Google Maps' }],
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      platform: 'Google',
      confidence: 'high',
    });
  });

  it('5. deduplicates when same URL appears in both citedSources and sourceMentions', () => {
    const url = 'https://www.yelp.com/biz/test';
    const result = identifyRootCauseSources(
      'hours',
      [{ url, title: 'Yelp' }],
      [{ name: 'Yelp', inferredUrl: url, type: 'review_site' }],
    );
    expect(result).toHaveLength(1);
  });

  it('6. returns max 5 results even when more matches exist', () => {
    // Create 8 different URLs that all match the 'hours' category
    const citedSources = [
      { url: 'https://yelp.com/1', title: 'Y1' },
      { url: 'https://yelp.com/2', title: 'Y2' },
      { url: 'https://yelp.com/3', title: 'Y3' },
      { url: 'https://tripadvisor.com/1', title: 'T1' },
      { url: 'https://tripadvisor.com/2', title: 'T2' },
      { url: 'https://google.com/1', title: 'G1' },
      { url: 'https://google.com/2', title: 'G2' },
      { url: 'https://google.com/3', title: 'G3' },
    ];
    const result = identifyRootCauseSources('hours', citedSources, []);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('7. sorts by confidence (high before medium)', () => {
    const result = identifyRootCauseSources(
      'phone',
      [
        { url: 'https://bingplaces.com/listing', title: 'Bing' },   // medium for phone
        { url: 'https://yelp.com/biz/test', title: 'Yelp' },        // high for phone
      ],
      [],
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.confidence).toBe('high');
    expect(result[1]!.confidence).toBe('medium');
  });

  it('8. unknown category returns empty array (no mapping)', () => {
    const result = identifyRootCauseSources(
      'nonexistent_category',
      [{ url: 'https://yelp.com/biz/test', title: 'Yelp' }],
      [],
    );
    expect(result).toEqual([]);
  });
});

describe('enrichHallucinationWithRootCause', () => {
  it('9. returns null when hallucination not found', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    } as any;

    const result = await enrichHallucinationWithRootCause(mockSupabase, 'nonexistent-id', 'org-1');
    expect(result).toBeNull();
  });
});

describe('CATEGORY_SOURCE_MAP', () => {
  it('covers all 8 expected hallucination categories', () => {
    const expectedCategories = ['hours', 'phone', 'address', 'menu', 'closed', 'name', 'website', 'services'];
    for (const cat of expectedCategories) {
      expect(CATEGORY_SOURCE_MAP[cat]).toBeDefined();
      expect(CATEGORY_SOURCE_MAP[cat]!.length).toBeGreaterThan(0);
    }
  });
});
