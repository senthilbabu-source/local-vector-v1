// ---------------------------------------------------------------------------
// content-brief-generator.test.ts — Unit tests for AI content brief generator
//
// Sprint 86: 9 tests — API key check, model call, system prompt contents.
//
// Run:
//   npx vitest run src/__tests__/unit/content-brief-generator.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBriefContent, type ContentBriefGeneratorInput } from '@/lib/services/content-brief-generator.service';
import { MOCK_CONTENT_BRIEF } from '@/src/__fixtures__/golden-tenant';

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
// Test input
// ---------------------------------------------------------------------------

const baseInput: ContentBriefGeneratorInput = {
  queryText: 'private event venue Alpharetta',
  queryCategory: 'discovery',
  businessName: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  businessContext: {
    cuisineType: 'Hookah Bar',
    amenities: ['has_outdoor_seating', 'has_hookah', 'has_private_rooms'],
    categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant'],
    hoursDescription: 'See location settings for details',
    phone: '(470) 546-4866',
    websiteUrl: 'https://charcoalnchill.com',
  },
  missingEngineCount: 3,
  totalEngineCount: 3,
  competitorsMentioned: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateBriefContent', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
    mockGetModel.mockReturnValue('mock-model');
    mockHasApiKey.mockImplementation((provider: string) => provider === 'openai');
  });

  it('returns null when no API key', async () => {
    mockHasApiKey.mockReturnValue(false);
    const result = await generateBriefContent(baseInput);
    expect(result).toBeNull();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('calls generateObject with content-brief model', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent(baseInput);
    expect(mockGetModel).toHaveBeenCalledWith('content-brief');
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject.mock.calls[0][0].model).toBe('mock-model');
  });

  it('passes business context in system prompt', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent(baseInput);
    const systemPrompt = mockGenerateObject.mock.calls[0][0].system;
    expect(systemPrompt).toContain('Hookah Bar');
    expect(systemPrompt).toContain('has_outdoor_seating');
    expect(systemPrompt).toContain('(470) 546-4866');
    expect(systemPrompt).toContain('https://charcoalnchill.com');
  });

  it('passes query text in user prompt', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent(baseInput);
    const prompt = mockGenerateObject.mock.calls[0][0].prompt;
    expect(prompt).toContain('private event venue Alpharetta');
  });

  it('includes competitor context when competitors exist', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent({
      ...baseInput,
      competitorsMentioned: ['Cloud 9 Lounge', 'Astra Hookah'],
    });
    const systemPrompt = mockGenerateObject.mock.calls[0][0].system;
    expect(systemPrompt).toContain('Cloud 9 Lounge');
    expect(systemPrompt).toContain('Astra Hookah');
    expect(systemPrompt).toContain('strong alternative');
  });

  it('includes First Mover message when no competitors', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent(baseInput);
    const systemPrompt = mockGenerateObject.mock.calls[0][0].system;
    expect(systemPrompt).toContain('First Mover opportunity');
  });

  it('returns ContentBrief object on success', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    const result = await generateBriefContent(baseInput);
    expect(result).toEqual(MOCK_CONTENT_BRIEF);
  });

  it('includes business name in system prompt', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent(baseInput);
    const systemPrompt = mockGenerateObject.mock.calls[0][0].system;
    expect(systemPrompt).toContain('Charcoal N Chill');
  });

  it('includes city and state in system prompt', async () => {
    mockGenerateObject.mockResolvedValue({ object: MOCK_CONTENT_BRIEF });
    await generateBriefContent(baseInput);
    const systemPrompt = mockGenerateObject.mock.calls[0][0].system;
    expect(systemPrompt).toContain('Alpharetta');
    expect(systemPrompt).toContain('GA');
  });
});
