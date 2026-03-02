// ---------------------------------------------------------------------------
// Sprint 120: SSE Utilities — 12 unit tests
// Tests: parseSSELine (pure), formatSSEChunk (pure), SSE_HEADERS (constant)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parseSSELine } from '@/lib/streaming/types';
import { formatSSEChunk, SSE_HEADERS } from '@/lib/streaming/sse-utils';
import type { SSEChunk } from '@/lib/streaming/types';

describe('parseSSELine — pure', () => {
  it('returns null for empty string', () => {
    expect(parseSSELine('')).toBeNull();
  });

  it('returns null for comment line (starts with ":")', () => {
    expect(parseSSELine(': keep-alive')).toBeNull();
  });

  it('returns null for line not starting with "data: "', () => {
    expect(parseSSELine('event: message')).toBeNull();
  });

  it('returns { type: "done" } for "data: [DONE]"', () => {
    expect(parseSSELine('data: [DONE]')).toEqual({ type: 'done' });
  });

  it('parses valid SSEChunk JSON correctly', () => {
    const chunk: SSEChunk = { type: 'text', text: 'hello' };
    const result = parseSSELine(`data: ${JSON.stringify(chunk)}`);
    expect(result).toEqual(chunk);
  });

  it('returns null for malformed JSON', () => {
    expect(parseSSELine('data: {not json')).toBeNull();
  });

  it('handles "data: " prefix correctly (removes exactly 6 chars)', () => {
    const chunk: SSEChunk = { type: 'metadata', metadata: { model: 'test' } };
    const line = `data: ${JSON.stringify(chunk)}`;
    const result = parseSSELine(line);
    expect(result).toEqual(chunk);
    // Verify it correctly extracts the JSON part
    expect(result?.type).toBe('metadata');
    expect(result?.metadata?.model).toBe('test');
  });
});

describe('formatSSEChunk — pure', () => {
  it('returns string starting with "data: "', () => {
    const chunk: SSEChunk = { type: 'text', text: 'hello' };
    const result = formatSSEChunk(chunk);
    expect(result.startsWith('data: ')).toBe(true);
  });

  it('returns string ending with "\\n\\n"', () => {
    const chunk: SSEChunk = { type: 'done' };
    const result = formatSSEChunk(chunk);
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('JSON.parse of content between "data: " and "\\n\\n" equals input chunk', () => {
    const chunk: SSEChunk = {
      type: 'text',
      text: 'Charcoal N Chill is a premium hookah lounge',
    };
    const result = formatSSEChunk(chunk);
    const jsonStr = result.slice(6, -2); // remove 'data: ' and '\n\n'
    expect(JSON.parse(jsonStr)).toEqual(chunk);
  });
});

describe('SSE_HEADERS — constant', () => {
  it('contains "Content-Type": "text/event-stream"', () => {
    expect(SSE_HEADERS['Content-Type']).toBe('text/event-stream');
  });

  it('contains "Cache-Control": "no-cache, no-transform"', () => {
    expect(SSE_HEADERS['Cache-Control']).toBe('no-cache, no-transform');
  });
});
