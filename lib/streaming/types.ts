// ---------------------------------------------------------------------------
// lib/streaming/types.ts — Sprint 120: SSE Streaming Types
//
// Shared types for server-side SSE generation and client-side consumption.
// Pure functions: parseSSELine() for parsing raw SSE event lines.
// ---------------------------------------------------------------------------

/**
 * SSE event types sent from server to client.
 * Each chunk is serialized as: data: {JSON}\n\n
 */
export type SSEEventType = 'text' | 'error' | 'done' | 'metadata';

export interface SSEChunk {
  type: SSEEventType;
  /** For type='text': the token/chunk of text */
  text?: string;
  /** For type='error': error code */
  error?: string;
  /** For type='error': human-readable error message */
  message?: string;
  /** For type='metadata': optional context about the stream */
  metadata?: Record<string, unknown>;
  /** For type='done': final output token count */
  total_tokens?: number;
}

/**
 * State managed by useStreamingResponse().
 */
export type StreamingStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface StreamingState {
  status: StreamingStatus;
  /** Accumulated text so far */
  text: string;
  /** Error message if status='error' */
  error: string | null;
  /** Populated when status='complete' */
  total_tokens: number | null;
}

/**
 * Options for useStreamingResponse().
 */
export interface UseStreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

/**
 * Parse a single SSE line into an SSEChunk.
 *
 * SSE format: "data: {json}\n\n"
 * Returns null for empty lines, comments, or malformed data.
 */
export function parseSSELine(line: string): SSEChunk | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return null;
  if (!trimmed.startsWith('data: ')) return null;
  const jsonStr = trimmed.slice(6);
  if (jsonStr === '[DONE]') return { type: 'done' };
  try {
    return JSON.parse(jsonStr) as SSEChunk;
  } catch (_parseError) {
    return null;
  }
}
