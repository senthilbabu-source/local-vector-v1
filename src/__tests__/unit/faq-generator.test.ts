// ---------------------------------------------------------------------------
// faq-generator.test.ts — Sprint 104: AI FAQ auto-generator tests
//
// Covers AI path, static fallback, JSON-LD structure, and error handling.
//
// Run:
//   npx vitest run src/__tests__/unit/faq-generator.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock setup ───────────────────────────────────────────────────────────

const mockGenerateText = vi.hoisted(() => vi.fn());
const mockHasApiKey = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue('mock-model'),
  hasApiKey: mockHasApiKey,
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { generateAiFaqSet, buildFaqSchema } from '@/lib/page-audit/faq-generator';
import type { LocationContext } from '@/lib/page-audit/auditor';

// ── Test data ────────────────────────────────────────────────────────────

const LOCATION: LocationContext = {
  business_name: 'Charcoal N Chill',
  city: 'Alpharetta',
  state: 'GA',
  categories: ['Hookah Bar'],
  amenities: { has_hookah: true, has_outdoor_seating: true },
};

const MOCK_AI_FAQS = [
  { question: 'What is Charcoal N Chill?', answer: 'Charcoal N Chill is a hookah bar in Alpharetta, GA.' },
  { question: 'Where is Charcoal N Chill located?', answer: 'Located in Alpharetta, GA.' },
  { question: 'What are the hours?', answer: 'Check our website for current hours.' },
  { question: 'Do you take reservations?', answer: 'Yes, contact us to reserve.' },
  { question: 'What makes you unique?', answer: 'Premium hookah and live entertainment in Alpharetta.' },
];

const MOCK_AI_RESPONSE = JSON.stringify({ faqs: MOCK_AI_FAQS });

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('generateAiFaqSet', () => {
  describe('AI path (hasApiKey returns true)', () => {
    beforeEach(() => {
      mockHasApiKey.mockReturnValue(true);
      mockGenerateText.mockResolvedValue({ text: MOCK_AI_RESPONSE });
    });

    it('calls generateText with model faq-generation', async () => {
      await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mock-model',
          temperature: 0.4,
        }),
      );
    });

    it('prompt includes business name, city, category, and pageType', async () => {
      await generateAiFaqSet({ location: LOCATION, pageType: 'about' });

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.prompt).toContain('Charcoal N Chill');
      expect(callArgs.prompt).toContain('Alpharetta');
      expect(callArgs.prompt).toContain('Hookah Bar');
      expect(callArgs.prompt).toContain('about');
    });

    it('returns GeneratedSchema with schemaType FAQPage', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(result.schemaType).toBe('FAQPage');
    });

    it('jsonLdString is valid JSON parseable as FAQPage schema', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      const parsed = JSON.parse(result.jsonLdString);
      expect(parsed['@context']).toBe('https://schema.org');
      expect(parsed['@type']).toBe('FAQPage');
    });

    it('mainEntity array has exactly 5 items (from AI response)', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      const parsed = JSON.parse(result.jsonLdString);
      expect(parsed.mainEntity).toHaveLength(5);
    });

    it('each mainEntity item has @type Question and acceptedAnswer', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      const parsed = JSON.parse(result.jsonLdString);
      for (const item of parsed.mainEntity) {
        expect(item['@type']).toBe('Question');
        expect(item.acceptedAnswer).toBeDefined();
        expect(item.acceptedAnswer['@type']).toBe('Answer');
        expect(item.acceptedAnswer.text).toBeTruthy();
      }
    });

    it('description includes business name', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(result.description).toContain('Charcoal N Chill');
    });

    it('estimatedImpact mentions +20 AEO score points', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(result.estimatedImpact).toContain('+20 AEO score points');
    });

    it('strips markdown code fences from AI response before parsing', async () => {
      mockGenerateText.mockResolvedValue({
        text: '```json\n' + MOCK_AI_RESPONSE + '\n```',
      });

      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(result.schemaType).toBe('FAQPage');
      const parsed = JSON.parse(result.jsonLdString);
      expect(parsed.mainEntity).toHaveLength(5);
    });
  });

  describe('fallback path (hasApiKey returns false)', () => {
    beforeEach(() => {
      mockHasApiKey.mockReturnValue(false);
    });

    it('returns GeneratedSchema without calling generateText', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(result.schemaType).toBe('FAQPage');
    });

    it('fallback faqs has exactly 5 items', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      const parsed = JSON.parse(result.jsonLdString);
      expect(parsed.mainEntity).toHaveLength(5);
    });

    it('fallback faqs include business_name in at least one answer', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      const parsed = JSON.parse(result.jsonLdString);
      const answers = parsed.mainEntity.map(
        (item: { acceptedAnswer: { text: string } }) => item.acceptedAnswer.text,
      );
      const hasBusinessName = answers.some((a: string) => a.includes('Charcoal N Chill'));
      expect(hasBusinessName).toBe(true);
    });

    it('fallback faqs include city in at least one answer', async () => {
      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      const parsed = JSON.parse(result.jsonLdString);
      const answers = parsed.mainEntity.map(
        (item: { acceptedAnswer: { text: string } }) => item.acceptedAnswer.text,
      );
      const hasCity = answers.some((a: string) => a.includes('Alpharetta'));
      expect(hasCity).toBe(true);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockHasApiKey.mockReturnValue(true);
    });

    it('falls back to static when generateText throws', async () => {
      mockGenerateText.mockRejectedValue(new Error('API error'));

      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(result.schemaType).toBe('FAQPage');
      const parsed = JSON.parse(result.jsonLdString);
      expect(parsed.mainEntity).toHaveLength(5);
    });

    it('falls back to static when AI response is malformed JSON', async () => {
      mockGenerateText.mockResolvedValue({ text: 'not valid json at all' });

      const result = await generateAiFaqSet({ location: LOCATION, pageType: 'homepage' });

      expect(result.schemaType).toBe('FAQPage');
      const parsed = JSON.parse(result.jsonLdString);
      expect(parsed.mainEntity).toHaveLength(5);
    });
  });
});

describe('buildFaqSchema', () => {
  const faqs = [
    { question: 'Q1?', answer: 'A1' },
    { question: 'Q2?', answer: 'A2' },
    { question: 'Q3?', answer: 'A3' },
  ];

  it('produces valid FAQPage JSON-LD structure', () => {
    const jsonStr = buildFaqSchema(faqs);
    const parsed = JSON.parse(jsonStr);

    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('FAQPage');
    expect(parsed.mainEntity).toBeDefined();
  });

  it('mainEntity count matches faqs array length', () => {
    const jsonStr = buildFaqSchema(faqs);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.mainEntity).toHaveLength(3);
  });
});
