// ---------------------------------------------------------------------------
// lib/streaming/index.ts — Sprint 120: Barrel Export
// ---------------------------------------------------------------------------

export type {
  SSEEventType,
  SSEChunk,
  StreamingStatus,
  StreamingState,
  UseStreamingOptions,
} from './types';

export { parseSSELine } from './types';

export { SSE_HEADERS, formatSSEChunk, createSSEResponse } from './sse-utils';
