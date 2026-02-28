// ---------------------------------------------------------------------------
// Sprint N: AI Preview streaming — unit tests
//
// Verifies: streamOpenAI, streamPerplexity, streamGemini return async
// iterables that yield StreamChunk objects with chunk/done/error fields.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock streamText to return an object with a textStream async iterable
const mockStreamText = vi.fn();
vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'batch response' }),
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

const mockHasApiKey = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ modelId: 'mock-model' })),
  hasApiKey: (...args: unknown[]) => mockHasApiKey(...args),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Helper: create a fresh mock textStream async iterable per call
function createMockTextStream(chunks: string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
  };
}

describe('Sprint N — AI Preview Streaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Return a fresh async generator for each call
    mockStreamText.mockImplementation(() => createMockTextStream(['Hello', ' World', '!']));
    // Default: all API keys present
    mockHasApiKey.mockReturnValue(true);
  });

  describe('streamOpenAI', () => {
    it('yields text chunks followed by done event', async () => {
      const { streamOpenAI } = await import('@/lib/ai-preview/model-queries');
      const chunks = [];
      for await (const chunk of streamOpenAI('test query', 'context')) {
        chunks.push(chunk);
      }
      // Should have 3 text chunks + 1 done event
      expect(chunks.length).toBe(4);
      expect(chunks[0]).toEqual({ chunk: 'Hello', done: false });
      expect(chunks[1]).toEqual({ chunk: ' World', done: false });
      expect(chunks[2]).toEqual({ chunk: '!', done: false });
      expect(chunks[3]).toEqual({ chunk: '', done: true });
    });

    it('returns error when API key is missing', async () => {
      mockHasApiKey.mockReturnValue(false);

      const { streamOpenAI } = await import('@/lib/ai-preview/model-queries');
      const chunks = [];
      for await (const chunk of streamOpenAI('test query', '')) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBe(1);
      expect(chunks[0].done).toBe(true);
      expect(chunks[0].error).toContain('not configured');
    });
  });

  describe('streamPerplexity', () => {
    it('yields text chunks followed by done event', async () => {
      const { streamPerplexity } = await import('@/lib/ai-preview/model-queries');
      const chunks = [];
      for await (const chunk of streamPerplexity('test query', 'context')) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBe(4);
      expect(chunks[3]).toEqual({ chunk: '', done: true });
    });

    it('returns error when API key is missing', async () => {
      mockHasApiKey.mockReturnValue(false);

      const { streamPerplexity } = await import('@/lib/ai-preview/model-queries');
      const chunks = [];
      for await (const chunk of streamPerplexity('test query', '')) {
        chunks.push(chunk);
      }
      expect(chunks[0].error).toContain('not configured');
    });
  });

  describe('streamGemini', () => {
    it('yields text chunks followed by done event', async () => {
      const { streamGemini } = await import('@/lib/ai-preview/model-queries');
      const chunks = [];
      for await (const chunk of streamGemini('test query', 'context')) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBe(4);
      expect(chunks[0].chunk).toBe('Hello');
    });

    it('returns error when API key is missing', async () => {
      mockHasApiKey.mockReturnValue(false);

      const { streamGemini } = await import('@/lib/ai-preview/model-queries');
      const chunks = [];
      for await (const chunk of streamGemini('test query', '')) {
        chunks.push(chunk);
      }
      expect(chunks[0].error).toContain('not configured');
    });
  });
});
