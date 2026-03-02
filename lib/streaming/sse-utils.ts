// ---------------------------------------------------------------------------
// lib/streaming/sse-utils.ts — Sprint 120: Server-Side SSE Helpers
//
// Utilities for creating SSE responses in Next.js App Router.
// Uses ReadableStream + TextEncoder (NOT Pages Router res.write pattern).
// ---------------------------------------------------------------------------

import type { SSEChunk } from './types';

/**
 * Standard headers for all SSE responses.
 */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Format an SSEChunk as an SSE message string.
 * Returns: `data: ${JSON.stringify(chunk)}\n\n`
 */
export function formatSSEChunk(chunk: SSEChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Create a streaming SSE Response from an async generator of SSEChunks.
 *
 * Wraps the generator in a ReadableStream, handles AbortError silently
 * (client disconnect is expected), and sends a done event on completion.
 */
export function createSSEResponse(
  generator: AsyncGenerator<SSEChunk>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(formatSSEChunk(chunk)));
        }
        // Send final done event
        controller.enqueue(encoder.encode(formatSSEChunk({ type: 'done' })));
      } catch (err) {
        // Client disconnect — close silently
        if (err instanceof Error && err.name === 'AbortError') {
          controller.close();
          return;
        }
        // Unexpected error — send error event then close
        controller.enqueue(
          encoder.encode(
            formatSSEChunk({
              type: 'error',
              error: 'stream_error',
              message:
                err instanceof Error ? err.message : 'Unknown error',
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
