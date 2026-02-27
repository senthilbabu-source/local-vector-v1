// ---------------------------------------------------------------------------
// source-intelligence-service.test.ts — Unit tests for source intelligence
//
// Sprint 82: 35 tests — extractSourceMentions, analyzeSourceIntelligence,
// helper functions, and mock integration.
//
// Run:
//   npx vitest run src/__tests__/unit/source-intelligence-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractSourceMentions,
  analyzeSourceIntelligence,
  normalizeSourceKey,
  extractDomainName,
  categorizeUrl,
  mapMentionTypeToCategory,
  generateAlerts,
  type SourceIntelligenceInput,
  type NormalizedSource,
} from '@/lib/services/source-intelligence.service';
import type { SourceMentionExtraction } from '@/lib/ai/schemas';
import {
  MOCK_SOURCE_MENTION_EXTRACTION,
  MOCK_SOURCE_INTELLIGENCE_INPUT,
} from '@/src/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGenerateObject, mockGetModel, mockHasApiKey } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
  mockGetModel: vi.fn().mockReturnValue('mock-model'),
  mockHasApiKey: vi.fn().mockImplementation((provider: string) => provider === 'openai'),
}));

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: mockGetModel,
  hasApiKey: mockHasApiKey,
}));

vi.mock('@/lib/ai/schemas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/schemas')>();
  return {
    ...actual,
    zodSchema: vi.fn((schema: unknown) => schema),
  };
});

// ---------------------------------------------------------------------------
// extractSourceMentions
// ---------------------------------------------------------------------------

describe('extractSourceMentions', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
    mockGetModel.mockReturnValue('mock-model');
    mockHasApiKey.mockImplementation((provider: string) => provider === 'openai');
  });

  it('1. returns null for null rawResponse', async () => {
    const result = await extractSourceMentions(null, 'Test Business');
    expect(result).toBeNull();
  });

  it('2. returns null for empty rawResponse', async () => {
    const result = await extractSourceMentions('', 'Test Business');
    expect(result).toBeNull();
  });

  it('3. returns null when hasApiKey returns false', async () => {
    mockHasApiKey.mockReturnValue(false);
    const result = await extractSourceMentions('Some response', 'Test Business');
    expect(result).toBeNull();
  });

  it('4. calls generateObject with source-extract model key', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_SOURCE_MENTION_EXTRACTION });

    await extractSourceMentions('Some response about Charcoal N Chill', 'Charcoal N Chill');
    expect(mockGetModel).toHaveBeenCalledWith('source-extract');
  });

  it('5. returns SourceMentionExtraction on happy path', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_SOURCE_MENTION_EXTRACTION });

    const result = await extractSourceMentions('Some response about Charcoal N Chill', 'Charcoal N Chill');
    expect(result).toEqual(MOCK_SOURCE_MENTION_EXTRACTION);
    expect(result?.sources).toHaveLength(3);
    expect(result?.sourcingQuality).toBe('well_sourced');
  });

  it('6. returns null when generateObject throws', async () => {
    mockGenerateObject.mockRejectedValue(new Error('API error'));

    const result = await extractSourceMentions('Some response', 'Test Business');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// analyzeSourceIntelligence — Source normalization
// ---------------------------------------------------------------------------

describe('analyzeSourceIntelligence', () => {
  describe('Source normalization', () => {
    it('7. deduplicates sources by normalized URL', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: null,
        evaluations: [
          {
            engine: 'google',
            citedSources: [
              { url: 'https://www.yelp.com/biz/test', title: 'Yelp' },
              { url: 'https://yelp.com/biz/test/', title: 'Yelp Listing' },
            ],
            extractedMentions: null,
            queryText: 'test query',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].citationCount).toBe(2);
    });

    it('8. merges engines for same source across evaluations', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: null,
        evaluations: [
          {
            engine: 'google',
            citedSources: [{ url: 'https://yelp.com/biz/test', title: 'Yelp' }],
            extractedMentions: null,
            queryText: 'q1',
          },
          {
            engine: 'perplexity',
            citedSources: [{ url: 'https://yelp.com/biz/test', title: 'Yelp' }],
            extractedMentions: null,
            queryText: 'q2',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.sources[0].engines).toContain('google');
      expect(result.sources[0].engines).toContain('perplexity');
    });

    it('9. handles both structured citations and extracted mentions', () => {
      const result = analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
      // Should have sources from both paths
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.evaluationCount).toBe(3);
    });

    it('10. normalizes URLs (removes www, trailing slash)', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: null,
        evaluations: [
          {
            engine: 'google',
            citedSources: [
              { url: 'https://www.example.com/page/', title: 'Example' },
            ],
            extractedMentions: null,
            queryText: 'q1',
          },
          {
            engine: 'openai',
            citedSources: [
              { url: 'https://example.com/page', title: 'Example' },
            ],
            extractedMentions: null,
            queryText: 'q2',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].citationCount).toBe(2);
    });
  });

  describe('Source categorization', () => {
    it('11. categorizes business website as first_party', () => {
      expect(categorizeUrl('https://charcoalnchill.com/menu', 'Charcoal N Chill', 'https://charcoalnchill.com')).toBe('first_party');
    });

    it('12. categorizes yelp.com as review_site', () => {
      expect(categorizeUrl('https://www.yelp.com/biz/test', 'Test', null)).toBe('review_site');
    });

    it('13. categorizes google.com/maps as directory', () => {
      expect(categorizeUrl('https://www.google.com/maps/place/test', 'Test', null)).toBe('directory');
    });

    it('14. categorizes facebook.com as social', () => {
      expect(categorizeUrl('https://facebook.com/testbiz', 'Test', null)).toBe('social');
    });

    it('15. categorizes competitor mentions as competitor', () => {
      expect(mapMentionTypeToCategory('blog', true)).toBe('competitor');
    });

    it('16. defaults unknown URLs to other', () => {
      expect(categorizeUrl('https://random-website.com/page', 'Test', null)).toBe('other');
    });
  });

  describe('Ranking', () => {
    it('17. sorts sources by citationCount descending', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: null,
        evaluations: [
          {
            engine: 'google',
            citedSources: [
              { url: 'https://tripadvisor.com/test', title: 'TA' },
              { url: 'https://yelp.com/test', title: 'Yelp' },
              { url: 'https://yelp.com/test', title: 'Yelp' },
            ],
            extractedMentions: null,
            queryText: 'q',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.sources[0].name).toBe('Yelp');
      expect(result.sources[0].citationCount).toBe(2);
      expect(result.sources[1].citationCount).toBe(1);
    });

    it('18. computes correct citationCount across evaluations', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: null,
        evaluations: [
          {
            engine: 'google',
            citedSources: [{ url: 'https://yelp.com/test', title: 'Yelp' }],
            extractedMentions: null,
            queryText: 'q1',
          },
          {
            engine: 'perplexity',
            citedSources: [{ url: 'https://yelp.com/test', title: 'Yelp' }],
            extractedMentions: null,
            queryText: 'q2',
          },
          {
            engine: 'openai',
            citedSources: [{ url: 'https://yelp.com/test', title: 'Yelp' }],
            extractedMentions: null,
            queryText: 'q3',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.sources[0].citationCount).toBe(3);
    });
  });

  describe('Category breakdown', () => {
    it('19. computes percentage per category', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: 'https://test.com',
        evaluations: [
          {
            engine: 'google',
            citedSources: [
              { url: 'https://yelp.com/test', title: 'Yelp' },
              { url: 'https://yelp.com/test', title: 'Yelp' },
              { url: 'https://test.com', title: 'Test' },
            ],
            extractedMentions: null,
            queryText: 'q',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      const reviewCategory = result.categoryBreakdown.find(c => c.category === 'review_site');
      expect(reviewCategory?.percentage).toBe(67); // 2/3
    });

    it('20. sorts categories by count descending', () => {
      const result = analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
      for (let i = 1; i < result.categoryBreakdown.length; i++) {
        expect(result.categoryBreakdown[i - 1].count).toBeGreaterThanOrEqual(result.categoryBreakdown[i].count);
      }
    });
  });

  describe('First-party rate', () => {
    it('21. computes first_party rate as percentage of total citations', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: 'https://test.com',
        evaluations: [
          {
            engine: 'google',
            citedSources: [
              { url: 'https://test.com', title: 'Test' },
              { url: 'https://yelp.com/test', title: 'Yelp' },
              { url: 'https://yelp.com/test2', title: 'Yelp 2' },
              { url: 'https://test.com/about', title: 'Test About' },
            ],
            extractedMentions: null,
            queryText: 'q',
          },
        ],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.firstPartyRate).toBe(50); // 2/4
    });

    it('22. returns 0 when no sources exist', () => {
      const input: SourceIntelligenceInput = {
        businessName: 'Test',
        websiteUrl: null,
        evaluations: [],
      };

      const result = analyzeSourceIntelligence(input);
      expect(result.firstPartyRate).toBe(0);
    });
  });

  describe('Per-engine breakdown', () => {
    it('23. groups sources by engine', () => {
      const result = analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
      expect(result.byEngine).toHaveProperty('google');
      expect(result.byEngine).toHaveProperty('perplexity');
      expect(result.byEngine).toHaveProperty('openai');
    });

    it('24. includes source in all engines that cited it', () => {
      const result = analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
      // Yelp is cited by google, perplexity, and openai
      const yelpSource = result.sources.find(s => s.name.includes('Yelp') || s.name.includes('Charcoal N Chill - Yelp'));
      if (yelpSource) {
        expect(yelpSource.engines.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// generateAlerts
// ---------------------------------------------------------------------------

describe('generateAlerts', () => {
  it('25. generates competitor_content alert when isCompetitorAlert is true', () => {
    const sources: NormalizedSource[] = [
      {
        name: 'Competitor Blog',
        url: null,
        category: 'competitor',
        engines: ['openai'],
        citationCount: 2,
        contexts: ['comparison'],
        isCompetitorAlert: true,
      },
    ];

    const alerts = generateAlerts(sources, 50, {
      businessName: 'Test',
      websiteUrl: null,
      evaluations: [],
    });

    expect(alerts.some(a => a.type === 'competitor_content')).toBe(true);
    expect(alerts.find(a => a.type === 'competitor_content')?.severity).toBe('high');
  });

  it('26. generates missing_first_party alert when firstPartyRate < 10%', () => {
    const sources: NormalizedSource[] = [
      {
        name: 'Yelp',
        url: 'https://yelp.com/test',
        category: 'review_site',
        engines: ['google'],
        citationCount: 5,
        contexts: [],
        isCompetitorAlert: false,
      },
    ];

    const alerts = generateAlerts(sources, 5, {
      businessName: 'Test',
      websiteUrl: null,
      evaluations: [],
    });

    expect(alerts.some(a => a.type === 'missing_first_party')).toBe(true);
    expect(alerts.find(a => a.type === 'missing_first_party')?.severity).toBe('medium');
  });

  it('27. generates negative_source alert when single source > 50% of citations', () => {
    const sources: NormalizedSource[] = [
      {
        name: 'Yelp',
        url: 'https://yelp.com/test',
        category: 'review_site',
        engines: ['google'],
        citationCount: 8,
        contexts: [],
        isCompetitorAlert: false,
      },
      {
        name: 'TripAdvisor',
        url: 'https://tripadvisor.com/test',
        category: 'review_site',
        engines: ['perplexity'],
        citationCount: 2,
        contexts: [],
        isCompetitorAlert: false,
      },
    ];

    const alerts = generateAlerts(sources, 0, {
      businessName: 'Test',
      websiteUrl: null,
      evaluations: [],
    });

    expect(alerts.some(a => a.type === 'negative_source')).toBe(true);
    expect(alerts.find(a => a.type === 'negative_source')?.title).toContain('Yelp');
  });

  it('28. no alerts when everything is healthy', () => {
    const sources: NormalizedSource[] = [
      {
        name: 'test.com',
        url: 'https://test.com',
        category: 'first_party',
        engines: ['google', 'openai'],
        citationCount: 3,
        contexts: [],
        isCompetitorAlert: false,
      },
      {
        name: 'Yelp',
        url: 'https://yelp.com',
        category: 'review_site',
        engines: ['perplexity'],
        citationCount: 3,
        contexts: [],
        isCompetitorAlert: false,
      },
    ];

    const alerts = generateAlerts(sources, 50, {
      businessName: 'Test',
      websiteUrl: 'https://test.com',
      evaluations: [],
    });

    expect(alerts).toHaveLength(0);
  });

  it('29. sorts alerts by severity (high first)', () => {
    const sources: NormalizedSource[] = [
      {
        name: 'Competitor',
        url: null,
        category: 'competitor',
        engines: ['openai'],
        citationCount: 1,
        contexts: [],
        isCompetitorAlert: true,
      },
      {
        name: 'Yelp',
        url: 'https://yelp.com',
        category: 'review_site',
        engines: ['google'],
        citationCount: 10,
        contexts: [],
        isCompetitorAlert: false,
      },
    ];

    const alerts = generateAlerts(sources, 5, {
      businessName: 'Test',
      websiteUrl: null,
      evaluations: [],
    });

    expect(alerts.length).toBeGreaterThanOrEqual(2);
    expect(alerts[0].severity).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe('helper functions', () => {
  it('30. normalizeSourceKey removes www and trailing slash', () => {
    expect(normalizeSourceKey('https://www.yelp.com/biz/test/'))
      .toBe('yelp.com/biz/test');
  });

  it('31. extractDomainName maps known domains to friendly names', () => {
    expect(extractDomainName('https://www.yelp.com/biz/test')).toBe('Yelp');
    expect(extractDomainName('https://www.tripadvisor.com/test')).toBe('TripAdvisor');
    expect(extractDomainName('https://www.facebook.com/test')).toBe('Facebook');
    expect(extractDomainName('https://x.com/test')).toBe('Twitter/X');
  });

  it('32. extractDomainName returns hostname for unknown domains', () => {
    expect(extractDomainName('https://localfoodblog.com/review')).toBe('localfoodblog.com');
  });

  it('33. categorizeUrl identifies first-party by matching websiteUrl', () => {
    expect(categorizeUrl(
      'https://charcoalnchill.com/menu',
      'Charcoal N Chill',
      'https://www.charcoalnchill.com',
    )).toBe('first_party');
  });
});

// ---------------------------------------------------------------------------
// Mock integration
// ---------------------------------------------------------------------------

describe('MOCK_SOURCE_INTELLIGENCE_INPUT integration', () => {
  it('34. produces valid SourceIntelligenceResult from mock input', () => {
    const result = analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.evaluationCount).toBe(3);
    expect(result.categoryBreakdown.length).toBeGreaterThan(0);
    expect(typeof result.firstPartyRate).toBe('number');
    expect(result.byEngine).toHaveProperty('google');
    expect(result.byEngine).toHaveProperty('perplexity');
    expect(result.byEngine).toHaveProperty('openai');
  });

  it('35. mock has competitor alert for Cloud 9 Lounge Blog', () => {
    const result = analyzeSourceIntelligence(MOCK_SOURCE_INTELLIGENCE_INPUT);
    const competitorAlerts = result.alerts.filter(a => a.type === 'competitor_content');
    expect(competitorAlerts.length).toBeGreaterThan(0);
    expect(competitorAlerts[0].source?.name).toBe('Cloud 9 Lounge Blog');
  });
});
