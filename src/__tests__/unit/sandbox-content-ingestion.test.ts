import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGenerateText, mockGetModel, mockHasApiKey, mockCaptureException } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockGetModel: vi.fn().mockReturnValue('mock-model'),
  mockHasApiKey: vi.fn().mockReturnValue(true),
  mockCaptureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));
vi.mock('ai', () => ({ generateText: mockGenerateText }));
vi.mock('@/lib/ai/providers', () => ({
  getModel: mockGetModel,
  hasApiKey: mockHasApiKey,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  analyzeContentIngestion,
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  compareFactValue,
  normalizeForComparison,
  FIELD_WEIGHTS,
  CRITICAL_FIELDS,
} from '@/lib/sandbox/content-ingestion-analyzer';
import { MOCK_SANDBOX_GROUND_TRUTH } from '@/__fixtures__/golden-tenant';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('FIELD_WEIGHTS', () => {
  it('sums to 100', () => {
    const total = Object.values(FIELD_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it('has name=20 as highest weight', () => {
    expect(FIELD_WEIGHTS.name).toBe(20);
  });
});

describe('CRITICAL_FIELDS', () => {
  it('contains name, phone, address, city, hours', () => {
    expect(CRITICAL_FIELDS).toContain('name');
    expect(CRITICAL_FIELDS).toContain('phone');
    expect(CRITICAL_FIELDS).toContain('address');
    expect(CRITICAL_FIELDS).toContain('city');
    expect(CRITICAL_FIELDS).toContain('hours');
  });
});

// ---------------------------------------------------------------------------
// normalizeForComparison
// ---------------------------------------------------------------------------

describe('normalizeForComparison', () => {
  it('lowercases and trims', () => {
    expect(normalizeForComparison('  HELLO  ', 'name')).toBe('hello');
  });

  it('strips non-digits for phone field', () => {
    expect(normalizeForComparison('(470) 546-4866', 'phone')).toBe('4705464866');
  });

  it('expands address abbreviations', () => {
    const result = normalizeForComparison('123 Main St.', 'address');
    expect(result).toContain('street');
  });

  it('expands Rd to road for address', () => {
    const result = normalizeForComparison('456 Oak Rd', 'address');
    expect(result).toContain('road');
  });
});

// ---------------------------------------------------------------------------
// compareFactValue
// ---------------------------------------------------------------------------

describe('compareFactValue', () => {
  it('returns "exact" for identical values', () => {
    expect(compareFactValue('Charcoal N Chill', 'Charcoal N Chill', 'name')).toBe('exact');
  });

  it('returns "exact" for case-insensitive match', () => {
    expect(compareFactValue('charcoal n chill', 'Charcoal N Chill', 'name')).toBe('exact');
  });

  it('returns "partial" when one contains the other', () => {
    expect(compareFactValue('Charcoal N Chill - Alpharetta', 'Charcoal N Chill', 'name')).toBe('partial');
  });

  it('returns "wrong" for mismatched values', () => {
    expect(compareFactValue('Cloud 9 Lounge', 'Charcoal N Chill', 'name')).toBe('wrong');
  });

  it('returns "missing" for null extracted', () => {
    expect(compareFactValue(null, 'Charcoal N Chill', 'name')).toBe('missing');
  });

  it('returns "missing" for "N/A" extracted', () => {
    expect(compareFactValue('N/A', 'Charcoal N Chill', 'name')).toBe('missing');
  });

  it('returns "missing" for "not found" extracted', () => {
    expect(compareFactValue('not found', 'Charcoal N Chill', 'name')).toBe('missing');
  });

  it('returns "partial" when GT is null but AI found something', () => {
    expect(compareFactValue('Some value', null, 'description')).toBe('partial');
  });

  it('normalizes phone numbers for comparison', () => {
    expect(compareFactValue('(470) 546-4866', '470-546-4866', 'phone')).toBe('exact');
  });

  it('normalizes addresses for comparison', () => {
    expect(compareFactValue('123 Main Street', '123 Main St', 'address')).toBe('exact');
  });
});

// ---------------------------------------------------------------------------
// buildExtractionSystemPrompt / buildExtractionUserPrompt
// ---------------------------------------------------------------------------

describe('buildExtractionSystemPrompt', () => {
  it('instructs AI to return JSON', () => {
    const prompt = buildExtractionSystemPrompt();
    expect(prompt).toContain('JSON');
  });

  it('lists all expected fields', () => {
    const prompt = buildExtractionSystemPrompt();
    expect(prompt).toContain('name');
    expect(prompt).toContain('phone');
    expect(prompt).toContain('hours');
    expect(prompt).toContain('amenities');
  });
});

describe('buildExtractionUserPrompt', () => {
  it('embeds content text', () => {
    const prompt = buildExtractionUserPrompt('My biz content');
    expect(prompt).toContain('My biz content');
  });
});

// ---------------------------------------------------------------------------
// analyzeContentIngestion
// ---------------------------------------------------------------------------

describe('analyzeContentIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasApiKey.mockReturnValue(true);
  });

  it('short-circuits for content under 20 words', async () => {
    const { result, tokensUsed } = await analyzeContentIngestion('Too short', MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.accuracy_score).toBe(0);
    expect(tokensUsed.input).toBe(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('short-circuits when no API key', async () => {
    mockHasApiKey.mockReturnValue(false);
    const content = Array(25).fill('word').join(' ');
    const { result } = await analyzeContentIngestion(content, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.accuracy_score).toBe(0);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('parses AI-extracted JSON and diffs against GT', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        name: 'Charcoal N Chill',
        phone: '(470) 546-4866',
        address: '11950 Jones Bridge Road Ste 103',
        city: 'Alpharetta',
        state: 'GA',
        zip: '30005',
        website: 'https://charcoalnchill.com',
        category: 'hookah lounge',
        hours: 'Tue-Sat 5PM-1AM',
        description: null,
      }),
      usage: { promptTokens: 200, completionTokens: 100 },
    });

    const content = Array(25).fill('word').join(' ');
    const { result, tokensUsed } = await analyzeContentIngestion(content, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.accuracy_score).toBeGreaterThan(0);
    expect(result.facts_correct).toBeGreaterThan(0);
    expect(tokensUsed.input).toBe(200);
    expect(tokensUsed.output).toBe(100);
  });

  it('returns empty result when AI returns invalid JSON', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Not valid JSON at all',
      usage: { promptTokens: 50, completionTokens: 20 },
    });

    const content = Array(25).fill('word').join(' ');
    const { result, tokensUsed } = await analyzeContentIngestion(content, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.accuracy_score).toBe(0);
    expect(tokensUsed.input).toBe(50);
  });

  it('counts critical errors for wrong critical fields', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({
        name: 'Wrong Name Entirely',
        phone: '(999) 000-1111',
        address: '999 Fake Street',
        city: 'Wrong City',
        state: 'TX',
        zip: '99999',
        website: null,
        category: null,
        hours: null,
        description: null,
      }),
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    const content = Array(25).fill('word').join(' ');
    const { result } = await analyzeContentIngestion(content, MOCK_SANDBOX_GROUND_TRUTH);
    expect(result.facts_incorrect).toBeGreaterThan(0);
    expect(result.critical_errors.length).toBeGreaterThan(0);
    expect(result.critical_errors[0].severity).toBe('critical');
  });
});
