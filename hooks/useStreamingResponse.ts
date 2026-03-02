'use client';

// ---------------------------------------------------------------------------
// hooks/useStreamingResponse.ts — Sprint 120: SSE Client Hook
//
// Reusable hook for consuming SSE streams from POST endpoints.
// Uses fetch() + response.body.getReader() (NOT EventSource — POST required).
// Buffers partial SSE lines and flushes text state every 50ms to avoid jank.
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback, useEffect } from 'react';
import type { StreamingState, UseStreamingOptions } from '@/lib/streaming/types';
import { parseSSELine } from '@/lib/streaming/types';

const INITIAL_STATE: StreamingState = {
  status: 'idle',
  text: '',
  error: null,
  total_tokens: null,
};

const FLUSH_INTERVAL_MS = 50;

export function useStreamingResponse(
  url: string,
  options?: UseStreamingOptions,
) {
  const [state, setState] = useState<StreamingState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const textBufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup flush timer on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, []);

  const start = useCallback(
    async (payload: unknown) => {
      // Cancel any active stream first
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const abortController = new AbortController();
      abortRef.current = abortController;
      textBufferRef.current = '';

      setState({
        status: 'connecting',
        text: '',
        error: null,
        total_tokens: null,
      });

      // Start flush timer for batched state updates
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.text !== textBufferRef.current && prev.status === 'streaming') {
            return { ...prev, text: textBufferRef.current };
          }
          return prev;
        });
      }, FLUSH_INTERVAL_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });

        if (!response.ok) {
          // Try to parse error body
          let errorMessage = 'request_failed';
          try {
            const errorBody = await response.json();
            errorMessage = errorBody.error || errorBody.message || errorMessage;
          } catch {
            // body not parseable
          }
          if (flushTimerRef.current) clearInterval(flushTimerRef.current);
          setState({
            status: 'error',
            text: '',
            error: errorMessage,
            total_tokens: null,
          });
          options?.onError?.(errorMessage);
          return;
        }

        setState((prev) => ({ ...prev, status: 'streaming' }));

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            const chunk = parseSSELine(line);
            if (!chunk) continue;

            if (chunk.type === 'text' && chunk.text) {
              textBufferRef.current += chunk.text;
              options?.onChunk?.(chunk.text);
            } else if (chunk.type === 'done') {
              if (flushTimerRef.current) clearInterval(flushTimerRef.current);
              const finalText = textBufferRef.current;
              setState({
                status: 'complete',
                text: finalText,
                error: null,
                total_tokens: chunk.total_tokens ?? null,
              });
              options?.onComplete?.(finalText);
              return;
            } else if (chunk.type === 'error') {
              if (flushTimerRef.current) clearInterval(flushTimerRef.current);
              const errorMsg = chunk.message || chunk.error || 'stream_error';
              setState((prev) => ({
                ...prev,
                status: 'error',
                text: textBufferRef.current,
                error: errorMsg,
              }));
              options?.onError?.(errorMsg);
              return;
            }
          }
        }

        // Stream ended without a done event — treat as complete
        if (flushTimerRef.current) clearInterval(flushTimerRef.current);
        const finalText = textBufferRef.current;
        setState({
          status: 'complete',
          text: finalText,
          error: null,
          total_tokens: null,
        });
        options?.onComplete?.(finalText);
      } catch (err) {
        if (flushTimerRef.current) clearInterval(flushTimerRef.current);
        if (err instanceof Error && err.name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            status: 'cancelled',
            text: textBufferRef.current,
          }));
          return;
        }
        const errorMsg = 'connection_error';
        setState((prev) => ({
          ...prev,
          status: 'error',
          text: textBufferRef.current,
          error: errorMsg,
        }));
        options?.onError?.(errorMsg);
      }
    },
    [url, options],
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      text: textBufferRef.current,
    }));
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    textBufferRef.current = '';
    setState(INITIAL_STATE);
  }, []);

  return { state, start, cancel, reset };
}
