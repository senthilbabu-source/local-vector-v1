// ---------------------------------------------------------------------------
// Sprint F (N3): Correction Verifier — unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the model queries module
const mockQueryOpenAI = vi.fn();
const mockQueryPerplexity = vi.fn();
const mockQueryGemini = vi.fn();

vi.mock('@/lib/ai-preview/model-queries', () => ({
  queryOpenAI: (...args: unknown[]) => mockQueryOpenAI(...args),
  queryPerplexity: (...args: unknown[]) => mockQueryPerplexity(...args),
  queryGemini: (...args: unknown[]) => mockQueryGemini(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('lib/services/correction-verifier.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractKeyPhrases', () => {
    it('extracts phone numbers', async () => {
      const { extractKeyPhrases } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const phrases = extractKeyPhrases(
        'ChatGPT shows wrong phone number 404-555-0100 instead of 404-555-0200',
      );
      expect(phrases).toContain('404-555-0100');
      expect(phrases).toContain('404-555-0200');
    });

    it('extracts times (am/pm)', async () => {
      const { extractKeyPhrases } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const phrases = extractKeyPhrases(
        'Shows opening at 11am instead of 5pm',
      );
      expect(phrases.some((p) => p.toLowerCase().includes('11am'))).toBe(true);
      expect(phrases.some((p) => p.toLowerCase().includes('5pm'))).toBe(true);
    });

    it('extracts dollar amounts', async () => {
      const { extractKeyPhrases } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const phrases = extractKeyPhrases('Lists price as $15.99 but it is $12.99');
      expect(phrases).toContain('$15.99');
      expect(phrases).toContain('$12.99');
    });

    it('falls back to long words when no structured data found', async () => {
      const { extractKeyPhrases } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const phrases = extractKeyPhrases(
        'Incorrectly claims restaurant serves Italian cuisine',
      );
      expect(phrases.length).toBeGreaterThan(0);
    });

    it('returns empty for very short descriptions', async () => {
      const { extractKeyPhrases } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const phrases = extractKeyPhrases('wrong');
      expect(phrases.length).toBe(0);
    });

    it('limits to 4 phrases max', async () => {
      const { extractKeyPhrases } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const phrases = extractKeyPhrases(
        'Wrong numbers: 404-555-0001 404-555-0002 404-555-0003 404-555-0004 404-555-0005',
      );
      expect(phrases.length).toBeLessThanOrEqual(4);
    });
  });

  describe('checkCorrectionStatus', () => {
    it('returns stillHallucinating=false when wrong phrases not found in new response', async () => {
      mockQueryOpenAI.mockResolvedValue({
        status: 'complete',
        content: 'This restaurant is open from 5pm to 2am, serving great food.',
      });

      const { checkCorrectionStatus } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const result = await checkCorrectionStatus({
        id: 'test-id',
        correction_query: 'hours for hookah lounge',
        model_provider: 'openai-gpt4o',
        claim_text: 'Incorrectly shows the restaurant opening at 11am',
      });

      expect(result.stillHallucinating).toBe(false);
    });

    it('returns stillHallucinating=true when wrong phrases still found', async () => {
      mockQueryOpenAI.mockResolvedValue({
        status: 'complete',
        content: 'This restaurant opens at 11am and closes at 10pm.',
      });

      const { checkCorrectionStatus } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const result = await checkCorrectionStatus({
        id: 'test-id',
        correction_query: 'hours for hookah lounge',
        model_provider: 'openai-gpt4o',
        claim_text: 'Shows opening at 11am instead of 5pm',
      });

      expect(result.stillHallucinating).toBe(true);
    });

    it('routes to correct model based on model_provider', async () => {
      mockQueryPerplexity.mockResolvedValue({
        status: 'complete',
        content: 'No wrong info found.',
      });

      const { checkCorrectionStatus } = await import(
        '@/lib/services/correction-verifier.service'
      );
      await checkCorrectionStatus({
        id: 'test-id',
        correction_query: 'query',
        model_provider: 'perplexity-sonar',
        claim_text: 'Wrong phone 404-555-0100',
      });

      expect(mockQueryPerplexity).toHaveBeenCalled();
      expect(mockQueryOpenAI).not.toHaveBeenCalled();
    });

    it('routes google-gemini to queryGemini', async () => {
      mockQueryGemini.mockResolvedValue({
        status: 'complete',
        content: 'No wrong info found.',
      });

      const { checkCorrectionStatus } = await import(
        '@/lib/services/correction-verifier.service'
      );
      await checkCorrectionStatus({
        id: 'test-id',
        correction_query: 'query',
        model_provider: 'google-gemini',
        claim_text: 'Wrong phone 404-555-0100',
      });

      expect(mockQueryGemini).toHaveBeenCalled();
    });

    it('returns stillHallucinating=true when model query fails', async () => {
      mockQueryOpenAI.mockResolvedValue({
        status: 'error',
        content: 'API unavailable',
      });

      const { checkCorrectionStatus } = await import(
        '@/lib/services/correction-verifier.service'
      );
      const result = await checkCorrectionStatus({
        id: 'test-id',
        correction_query: 'query',
        model_provider: 'openai-gpt4o',
        claim_text: 'Wrong phone 404-555-0100',
      });

      // Conservative: assume still hallucinating when model fails
      expect(result.stillHallucinating).toBe(true);
    });
  });
});
