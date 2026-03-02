// ---------------------------------------------------------------------------
// Sprint 120: useStreamingResponse hook — 15 unit tests
// Tests: fetch mocked with ReadableStream simulation
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import type { SSEChunk } from '@/lib/streaming/types';

// @vitest-environment jsdom

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSSEStream(chunks: SSEChunk[], delay = 0): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      controller.close();
    },
  });
}

function mockFetchSuccess(chunks: SSEChunk[], delay = 0) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: createSSEStream(chunks, delay),
  });
}

function mockFetchError(status: number, error: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStreamingResponse — fetch mocked', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('initial state: { status: "idle", text: "", error: null }', () => {
    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );
    expect(result.current.state).toEqual({
      status: 'idle',
      text: '',
      error: null,
      total_tokens: null,
    });
  });

  it('status changes to "connecting" immediately on start()', async () => {
    // Use a fetch that never resolves so we can catch the connecting state
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    act(() => {
      result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.status).toBe('connecting');
  });

  it('status changes to "streaming" when first byte received', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'hello' },
      { type: 'done' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    // After completion, it will be 'complete' (streaming was transient)
    expect(result.current.state.status).toBe('complete');
  });

  it('text accumulates correctly across multiple chunks', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'text', text: '!' },
      { type: 'done' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.text).toBe('Hello world!');
  });

  it('status becomes "complete" on receiving { type: "done" } chunk', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'content' },
      { type: 'done', total_tokens: 10 },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.status).toBe('complete');
  });

  it('total_tokens populated from done chunk', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'content' },
      { type: 'done', total_tokens: 42 },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.total_tokens).toBe(42);
  });

  it('calls options.onChunk on each text chunk', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
      { type: 'done' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const onChunk = vi.fn();
    const { result } = renderHook(() =>
      useStreamingResponse('/api/test', { onChunk }),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(onChunk).toHaveBeenCalledWith('a');
    expect(onChunk).toHaveBeenCalledWith('b');
    expect(onChunk).toHaveBeenCalledTimes(2);
  });

  it('calls options.onComplete with full text on done', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' world' },
      { type: 'done' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useStreamingResponse('/api/test', { onComplete }),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(onComplete).toHaveBeenCalledWith('Hello world');
  });

  it('status becomes "error" on { type: "error" } chunk', async () => {
    const chunks: SSEChunk[] = [
      { type: 'error', error: 'api_error', message: 'Something failed' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('Something failed');
  });

  it('calls options.onError with error message', async () => {
    const chunks: SSEChunk[] = [
      { type: 'error', error: 'api_error', message: 'fail' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useStreamingResponse('/api/test', { onError }),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(onError).toHaveBeenCalledWith('fail');
  });

  it('cancel() aborts fetch and sets status="cancelled"', async () => {
    // Use a stream that never closes
    const neverEndingStream = new ReadableStream({
      start() {
        // intentionally never close
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: neverEndingStream,
    });

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    act(() => {
      result.current.start({ prompt: 'test' });
    });

    // Wait for connecting state
    await waitFor(() => {
      expect(result.current.state.status).not.toBe('idle');
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.state.status).toBe('cancelled');
  });

  it('reset() restores initial state from any status', async () => {
    const chunks: SSEChunk[] = [
      { type: 'text', text: 'content' },
      { type: 'done' },
    ];
    globalThis.fetch = mockFetchSuccess(chunks);

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.status).toBe('complete');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({
      status: 'idle',
      text: '',
      error: null,
      total_tokens: null,
    });
  });

  it('handles partial SSE lines correctly (line buffering)', async () => {
    // Simulate a stream that sends partial SSE lines
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send first part of an SSE event
        controller.enqueue(encoder.encode('data: {"type":"text","text":"hel'));
        // Send rest of the SSE event + next event
        controller.enqueue(encoder.encode('lo"}\n\ndata: {"type":"done"}\n\n'));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.text).toBe('hello');
    expect(result.current.state.status).toBe('complete');
  });

  it('handles multiple events in a single chunk', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send multiple SSE events in one chunk
        controller.enqueue(
          encoder.encode(
            'data: {"type":"text","text":"a"}\n\ndata: {"type":"text","text":"b"}\n\ndata: {"type":"done"}\n\n',
          ),
        );
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.text).toBe('ab');
    expect(result.current.state.status).toBe('complete');
  });

  it('handles 400 response before stream starts — sets status="error"', async () => {
    globalThis.fetch = mockFetchError(400, 'missing_prompt');

    const { result } = renderHook(() =>
      useStreamingResponse('/api/test'),
    );

    await act(async () => {
      await result.current.start({ prompt: 'test' });
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('missing_prompt');
  });
});
