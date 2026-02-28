// ---------------------------------------------------------------------------
// Sprint F (N2): AI Answer Preview — model queries unit tests
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI SDK and providers
const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ modelId: 'mock-model' })),
  hasApiKey: vi.fn((provider: string) => {
    if (provider === 'openai') return true;
    if (provider === 'perplexity') return true;
    if (provider === 'google') return true;
    return false;
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('lib/ai-preview/model-queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateText.mockResolvedValue({ text: 'Mock AI response about the business.' });
  });

  describe('queryOpenAI', () => {
    it('returns complete status with response text on success', async () => {
      const { queryOpenAI } = await import('@/lib/ai-preview/model-queries');
      const result = await queryOpenAI('best hookah lounge', 'Business context');
      expect(result.status).toBe('complete');
      expect(result.content).toBe('Mock AI response about the business.');
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it('returns error status when API key is missing', async () => {
      const { hasApiKey } = await import('@/lib/ai/providers');
      vi.mocked(hasApiKey).mockReturnValueOnce(false);

      const { queryOpenAI } = await import('@/lib/ai-preview/model-queries');
      const result = await queryOpenAI('test query', '');
      expect(result.status).toBe('error');
      expect(result.content).toContain('not configured');
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('returns error status when generateText throws', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('API timeout'));

      const { queryOpenAI } = await import('@/lib/ai-preview/model-queries');
      const result = await queryOpenAI('test query', '');
      expect(result.status).toBe('error');
      expect(result.content).toContain('temporarily unavailable');
    });

    it('returns (No response) when text is empty', async () => {
      mockGenerateText.mockResolvedValueOnce({ text: '' });

      const { queryOpenAI } = await import('@/lib/ai-preview/model-queries');
      const result = await queryOpenAI('test query', '');
      expect(result.status).toBe('complete');
      expect(result.content).toBe('(No response)');
    });
  });

  describe('queryPerplexity', () => {
    it('returns complete status on success', async () => {
      const { queryPerplexity } = await import('@/lib/ai-preview/model-queries');
      const result = await queryPerplexity('best restaurant', '');
      expect(result.status).toBe('complete');
      expect(result.content).toBe('Mock AI response about the business.');
    });

    it('returns error when API key missing', async () => {
      const { hasApiKey } = await import('@/lib/ai/providers');
      vi.mocked(hasApiKey).mockReturnValueOnce(false);

      const { queryPerplexity } = await import('@/lib/ai-preview/model-queries');
      const result = await queryPerplexity('test', '');
      expect(result.status).toBe('error');
      expect(result.content).toContain('not configured');
    });
  });

  describe('queryGemini', () => {
    it('returns complete status on success', async () => {
      const { queryGemini } = await import('@/lib/ai-preview/model-queries');
      const result = await queryGemini('best sushi', '');
      expect(result.status).toBe('complete');
      expect(result.content).toBe('Mock AI response about the business.');
    });

    it('returns error when API key missing', async () => {
      const { hasApiKey } = await import('@/lib/ai/providers');
      vi.mocked(hasApiKey).mockReturnValueOnce(false);

      const { queryGemini } = await import('@/lib/ai-preview/model-queries');
      const result = await queryGemini('test', '');
      expect(result.status).toBe('error');
      expect(result.content).toContain('not configured');
    });
  });

  describe('model key registration', () => {
    it('registers preview-chatgpt, preview-perplexity, preview-gemini in MODELS', async () => {
      // Reset the mock to use real implementation for this test
      vi.doUnmock('@/lib/ai/providers');
      const { MODELS } = await import('@/lib/ai/providers');
      expect(MODELS['preview-chatgpt']).toBeDefined();
      expect(MODELS['preview-perplexity']).toBeDefined();
      expect(MODELS['preview-gemini']).toBeDefined();
    });
  });
});
