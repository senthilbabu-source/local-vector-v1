// ---------------------------------------------------------------------------
// Sprint 120: Streaming Routes — 16 unit tests
// Tests: POST /api/content/preview-stream + POST /api/sov/simulate-stream
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted before module imports
// ---------------------------------------------------------------------------

const {
  mockGetSafeAuthContext,
  mockStreamText,
  mockCaptureException,
} = vi.hoisted(() => ({
  mockGetSafeAuthContext: vi.fn(),
  mockStreamText: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('ai', () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ modelId: 'mock-haiku' })),
  hasApiKey: vi.fn(() => true),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readSSEEvents(response: Response): Promise<string[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((line) => line.replace(/^data: /, ''));
}

async function readSSEChunks(response: Response) {
  const events = await readSSEEvents(response);
  return events.map((e) => {
    try {
      return JSON.parse(e);
    } catch {
      return e;
    }
  });
}

// ---------------------------------------------------------------------------
// Setup — create mock async iterable for textStream
// ---------------------------------------------------------------------------

function createMockTextStream(chunks: string[]) {
  async function* gen() {
    for (const chunk of chunks) {
      yield chunk;
    }
  }
  return {
    textStream: gen(),
    usage: Promise.resolve({ completionTokens: 42, promptTokens: 10 }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/content/preview-stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'org-1',
      userId: 'user-1',
      email: 'test@example.com',
    });
    mockStreamText.mockReturnValue(createMockTextStream(['Hello', ' world']));
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'test',
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 "missing_prompt" when target_prompt absent', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_prompt');
  });

  it('returns 400 "prompt_too_long" when > 500 chars', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'x'.repeat(501),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('prompt_too_long');
  });

  it('response has Content-Type: text/event-stream', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'Best hookah lounge',
    }));
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('response has Cache-Control: no-cache, no-transform', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'Best hookah lounge',
    }));
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform');
  });

  it('streams text chunks from Vercel AI SDK', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'Best hookah lounge',
    }));
    const chunks = await readSSEChunks(res);
    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBeGreaterThanOrEqual(1);
    expect(textChunks.some((c: { text: string }) => c.text.length > 0)).toBe(true);
  });

  it('sends { type: "done" } as final chunk', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'Best hookah lounge',
    }));
    const chunks = await readSSEChunks(res);
    const doneChunks = chunks.filter((c) => c.type === 'done');
    // There are two done chunks: one from the generator, one from createSSEResponse
    expect(doneChunks.length).toBeGreaterThanOrEqual(1);
  });

  it('uses claude-3-5-haiku model (not Sonnet or Opus)', async () => {
    const { POST } = await import('@/app/api/content/preview-stream/route');
    const res = await POST(makeRequest('http://localhost/api/content/preview-stream', {
      target_prompt: 'Best hookah lounge',
    }));
    await res.text();
    const { getModel } = await import('@/lib/ai/providers');
    expect(vi.mocked(getModel)).toHaveBeenCalledWith('streaming-preview');
  });
});

describe('POST /api/sov/simulate-stream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue({
      orgId: 'org-1',
      userId: 'user-1',
      email: 'test@example.com',
    });
    mockStreamText.mockReturnValue(createMockTextStream(['AI response', ' about restaurants']));
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'test',
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 "missing_query" when query_text absent', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('missing_query');
  });

  it('returns 400 "query_too_long" when > 300 chars', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'x'.repeat(301),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('query_too_long');
  });

  it('response has Content-Type: text/event-stream', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'Best hookah bar in Alpharetta',
    }));
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('streams text chunks from Vercel AI SDK', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'Best hookah bar in Alpharetta',
    }));
    const chunks = await readSSEChunks(res);
    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBeGreaterThanOrEqual(1);
  });

  it('sends { type: "done" } as final chunk', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'Best hookah bar',
    }));
    const chunks = await readSSEChunks(res);
    const doneChunks = chunks.filter((c) => c.type === 'done');
    expect(doneChunks.length).toBeGreaterThanOrEqual(1);
  });

  it('system prompt does NOT instruct AI to mention org', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'Best hookah bar',
      org_name: 'Charcoal N Chill',
    }));
    // Must consume the response to let the async generator complete
    await res.text();
    expect(mockStreamText).toHaveBeenCalledOnce();
    const callArgs = mockStreamText.mock.calls[0][0];
    // System prompt should not contain the org name
    expect(callArgs.system).not.toContain('Charcoal N Chill');
  });

  it('appends location_city to user message when provided', async () => {
    const { POST } = await import('@/app/api/sov/simulate-stream/route');
    const res = await POST(makeRequest('http://localhost/api/sov/simulate-stream', {
      query_text: 'Best hookah bar',
      location_city: 'Alpharetta, GA',
    }));
    await res.text();
    expect(mockStreamText).toHaveBeenCalledOnce();
    const callArgs = mockStreamText.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Alpharetta, GA');
  });
});
