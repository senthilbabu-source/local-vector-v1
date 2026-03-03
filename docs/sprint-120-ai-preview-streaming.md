# Sprint 120 — AI Preview Streaming

> **Claude Code Prompt — Bulletproof First-Pass Edition**
> Paste this entire prompt into Claude Code (Cmd+L).
> Upload alongside: `AI_RULES.md`, `CLAUDE.md`, `DEVLOG.md`, `prod_schema.sql`,
> `golden-tenant.ts`, `database.types.ts`, `lib/ai/providers.ts`,
> `app/dashboard/content/page.tsx`,
> `app/dashboard/share-of-voice/page.tsx`

---

## 🎯 Objective

Build **AI Preview Streaming** — Server-Sent Events (SSE) for streaming AI-generated content previews in the content draft editor, streaming SOV query simulation in the dashboard, and a reusable `useStreamingResponse()` hook that handles SSE lifecycle, error recovery, and cancellation.

**What this sprint answers:** "Why do I have to wait 8 seconds staring at a spinner before seeing my AI-generated content? Can I see it appear word by word like ChatGPT?"

**What Sprint 120 delivers:**
- `POST /api/content/preview-stream` — SSE endpoint that streams a content preview for a given prompt using Claude (Anthropic SDK streaming)
- `POST /api/sov/simulate-stream` — SSE endpoint that streams a simulated AI answer for a target query (shows what the AI would say if asked that query)
- `useStreamingResponse()` hook — reusable React hook managing SSE lifecycle: connect, stream, complete, error, cancel
- `StreamingTextDisplay` component — animated text display that renders the streaming response token by token
- Content draft editor updated: "Preview" button now streams the AI content preview live
- SOV dashboard updated: "Simulate Query" button streams the AI answer for the selected target query
- `lib/streaming/` — server-side SSE utilities: `createSSEStream()`, `writeSSEChunk()`, `writeSSEError()`, `writeSSEDone()`

**What this sprint does NOT build:** WebSocket-based streaming (SSE is simpler and sufficient), streaming for email generation, streaming for hallucination detection (those are batch operations), persistent storage of streamed previews (use existing draft save flow).

---

## 📋 Pre-Flight Checklist — READ THESE FILES FIRST

```
Read AI_RULES.md                                     — All rules (57 rules as of Sprint 119)
Read CLAUDE.md                                       — Full implementation inventory
Read lib/ai/providers.ts                             — CRITICAL: how Anthropic client is initialized
Read app/dashboard/content/page.tsx                  — Content draft UI to update
Read app/dashboard/content/ (entire dir)             — Content components, actions
Read app/dashboard/share-of-voice/page.tsx           — SOV page to update
Read app/dashboard/share-of-voice/ (entire dir)      — SOV components
Read supabase/prod_schema.sql
  § FIND: content_drafts — draft_title, target_prompt, draft_content, status, org_id
  § FIND: target_queries — query_text, location_id, query_category
Read lib/supabase/database.types.ts                 — All current types
Read src/__fixtures__/golden-tenant.ts               — Existing fixtures
Read package.json                                    — Confirm @anthropic-ai/sdk version
```

**Specifically understand before writing code:**

1. **Anthropic SDK streaming pattern.** Read `lib/ai/providers.ts` to understand how the Anthropic client is initialized. The streaming API uses `client.messages.stream()` which returns an async iterable. The pattern is:
   ```typescript
   const stream = await anthropic.messages.stream({ model, max_tokens, messages });
   for await (const event of stream) {
     if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
       yield event.delta.text;
     }
   }
   ```
   Read the current SDK version in `package.json` — the streaming API may differ between v0.x and v0.24+.

2. **SSE format.** Server-Sent Events use a specific text format over a plain HTTP connection with `Content-Type: text/event-stream`. Each message is:
   ```
   data: {"text": "hello"}\n\n
   ```
   The double newline `\n\n` terminates each event. The connection stays open until the server closes it or sends a `data: [DONE]` sentinel. In Next.js App Router, SSE is implemented using `ReadableStream` with `TextEncoder` — NOT using `res.write()` (that's Pages Router).

3. **Next.js App Router streaming response.** In the App Router, streaming responses use:
   ```typescript
   return new Response(
     new ReadableStream({
       async start(controller) {
         // write chunks
         controller.enqueue(encoder.encode('data: {"text": "hello"}\n\n'));
         controller.close();
       }
     }),
     {
       headers: {
         'Content-Type': 'text/event-stream',
         'Cache-Control': 'no-cache',
         'Connection': 'keep-alive',
       }
     }
   );
   ```
   This is different from Pages Router (`res.setHeader`, `res.write`, `res.end`). Use the App Router pattern exclusively.

4. **`useStreamingResponse()` and EventSource.** The browser-side hook uses the `EventSource` API for SSE. However, `EventSource` does NOT support POST requests or custom headers. For POST-based SSE (which we need for security — sending the prompt in the body), use `fetch()` with streaming response reading:
   ```typescript
   const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
   const reader = response.body!.getReader();
   const decoder = new TextDecoder();
   while (true) {
     const { done, value } = await reader.read();
     if (done) break;
     const text = decoder.decode(value);
     // parse SSE lines from text
   }
   ```
   This is the correct approach for POST SSE in the browser. Do NOT use `EventSource` for these endpoints.

5. **Cancellation via AbortController.** The hook must support cancellation (user clicks "Stop"). Wire `AbortController` into the `fetch()` call:
   ```typescript
   const abortController = new AbortController();
   const response = await fetch(url, { signal: abortController.signal, ... });
   // To cancel: abortController.abort()
   ```
   On abort: the ReadableStream on the server side will have its request cancelled. The server should handle the resulting error gracefully (log at debug level, not error level — abort is expected).

6. **Rate limiting applies.** Both streaming endpoints are `/api/` routes. Sprint 118's rate limiting middleware applies. The streaming endpoints should NOT bypass rate limiting. They are among the most expensive endpoints (real Anthropic API calls) — rate limiting them is especially important.

7. **Content preview prompt.** The content preview generates a short content piece (200-400 words) for the given `target_prompt`. Read `CLAUDE.md` and the existing content generation code to understand what prompt template is currently used for content drafts. Use the SAME prompt template — don't invent a new one. The streaming version produces the same output as the batch version, just streamed.

8. **SOV query simulation prompt.** The SOV simulation asks the AI: "If a user asked '{query_text}', what would you say as an AI assistant recommending local businesses?" Read the existing SOV simulation logic (if any) in the codebase. If no simulation exists yet, build a simple prompt: show what AI would say if asked the query, focusing on whether and how local businesses would be mentioned.

---

## 🏗️ Architecture — What to Build

### Directory Structure

```
lib/streaming/
  index.ts                          — barrel export
  sse-utils.ts                      — Server-side SSE helpers
  types.ts                          — SSEChunk, StreamingState, StreamingError types

hooks/
  useStreamingResponse.ts           — Reusable SSE client hook

app/api/
  content/
    preview-stream/
      route.ts                      — POST streaming content preview
  sov/
    simulate-stream/
      route.ts                      — POST streaming SOV query simulation

app/dashboard/
  content/
    _components/
      StreamingPreviewPanel.tsx      — Preview panel with streaming display
  share-of-voice/
    _components/
      StreamingSimulatePanel.tsx     — SOV query simulation panel

components/
  StreamingTextDisplay.tsx          — Reusable animated streaming text renderer
```

---

### Component 1: Types — `lib/streaming/types.ts`

```typescript
/**
 * SSE chunk sent from server to client.
 * Each chunk is serialized as: data: {JSON}\n\n
 */
export type SSEEventType = 'text' | 'error' | 'done' | 'metadata';

export interface SSEChunk {
  type: SSEEventType;
  // For type='text': the token/chunk of text
  text?: string;
  // For type='error': error code and message
  error?: string;
  message?: string;
  // For type='metadata': optional context about the stream
  metadata?: Record<string, unknown>;
  // For type='done': final token count
  total_tokens?: number;
}

/**
 * State managed by useStreamingResponse().
 */
export type StreamingStatus =
  | 'idle'        // not started
  | 'connecting'  // fetch initiated, waiting for first byte
  | 'streaming'   // receiving chunks
  | 'complete'    // stream finished successfully
  | 'error'       // stream ended with error
  | 'cancelled';  // user cancelled via abort()

export interface StreamingState {
  status: StreamingStatus;
  text: string;               // accumulated text so far
  error: string | null;       // error message if status='error'
  total_tokens: number | null; // populated when status='complete'
}

/**
 * Options for useStreamingResponse().
 */
export interface UseStreamingOptions {
  onChunk?: (chunk: string) => void;     // called on each text chunk
  onComplete?: (fullText: string) => void; // called when stream ends
  onError?: (error: string) => void;     // called on stream error
}

/**
 * SSE line parser — pure function.
 * Parses a raw SSE text chunk (may contain multiple lines/events)
 * into an array of SSEChunk objects.
 *
 * SSE format: "data: {json}\n\n"
 * Input may contain partial lines (buffer accordingly).
 * Returns: SSEChunk[] (empty array if no complete events yet)
 */
export function parseSSELine(line: string): SSEChunk | null {
  // Trim whitespace
  const trimmed = line.trim();
  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith(':')) return null;
  // Must start with 'data: '
  if (!trimmed.startsWith('data: ')) return null;
  const jsonStr = trimmed.slice(6); // remove 'data: '
  if (jsonStr === '[DONE]') return { type: 'done' };
  try {
    return JSON.parse(jsonStr) as SSEChunk;
  } catch {
    return null;
  }
}
```

---

### Component 2: SSE Utilities — `lib/streaming/sse-utils.ts`

```typescript
/**
 * Server-side SSE helpers for Next.js App Router.
 * All functions work with ReadableStream and TextEncoder.
 *
 * ── createSSEResponse(generator) ─────────────────────────────────────────────
 * The main entry point for SSE routes.
 * Takes an AsyncGenerator<SSEChunk> and returns a Response.
 *
 * Returns Response with:
 *   Content-Type: text/event-stream
 *   Cache-Control: no-cache, no-transform
 *   Connection: keep-alive
 *   X-Accel-Buffering: no    (disables nginx buffering for Vercel)
 *
 * Implementation:
 *   const encoder = new TextEncoder();
 *   const stream = new ReadableStream({
 *     async start(controller) {
 *       try {
 *         for await (const chunk of generator) {
 *           controller.enqueue(encoder.encode(formatSSEChunk(chunk)));
 *         }
 *         controller.enqueue(encoder.encode(formatSSEChunk({ type: 'done' })));
 *       } catch (err) {
 *         // If AbortError: close silently (client disconnected)
 *         if (err instanceof Error && err.name === 'AbortError') {
 *           controller.close();
 *           return;
 *         }
 *         controller.enqueue(encoder.encode(formatSSEChunk({
 *           type: 'error',
 *           error: 'stream_error',
 *           message: err instanceof Error ? err.message : 'Unknown error',
 *         })));
 *       } finally {
 *         controller.close();
 *       }
 *     }
 *   });
 *   return new Response(stream, { headers: SSE_HEADERS });
 *
 * ── formatSSEChunk(chunk) ─────────────────────────────────────────────────────
 * Pure function. Formats an SSEChunk as an SSE message string.
 * Returns: `data: ${JSON.stringify(chunk)}\n\n`
 *
 * ── SSE_HEADERS ───────────────────────────────────────────────────────────────
 * Constant headers object for all SSE responses.
 * {
 *   'Content-Type': 'text/event-stream',
 *   'Cache-Control': 'no-cache, no-transform',
 *   'Connection': 'keep-alive',
 *   'X-Accel-Buffering': 'no',
 * }
 */
```

---

### Component 3: Content Preview Stream — `app/api/content/preview-stream/route.ts`

```typescript
/**
 * POST /api/content/preview-stream
 * Streams a content preview for a given prompt using Claude.
 * Auth: org member required.
 * Rate limited by Sprint 118 middleware.
 *
 * Request body:
 * {
 *   target_prompt: string;     // the content topic/prompt (required, max 500 chars)
 *   draft_title?: string;      // optional context
 *   content_type?: string;     // e.g. 'blog_post', 'occasion_page', 'faq'
 *   max_words?: number;        // default 300, max 500
 * }
 *
 * Validation:
 * - target_prompt required → 400 'missing_prompt'
 * - target_prompt.length > 500 → 400 'prompt_too_long'
 * - max_words > 500 → clamp to 500 (don't error — just limit)
 *
 * Read the existing content generation prompt template from CLAUDE.md or
 * the existing content draft creation code. Use the SAME system prompt.
 * Do not invent a new content generation approach.
 *
 * AI call: anthropic.messages.stream({
 *   model: 'claude-3-5-haiku-20241022',  // Haiku for speed + cost
 *   max_tokens: 1024,
 *   system: [existing content system prompt],
 *   messages: [{
 *     role: 'user',
 *     content: `Write ${max_words} words of ${content_type} content about: ${target_prompt}`,
 *   }],
 * })
 *
 * Use claude-3-5-haiku-20241022 for streaming previews — faster and cheaper
 * than Sonnet for this use case. Read providers.ts to confirm model string format.
 *
 * Generator function:
 * async function* generateContentPreview(params): AsyncGenerator<SSEChunk> {
 *   yield { type: 'metadata', metadata: { model: 'claude-3-5-haiku...', max_words } };
 *   const stream = anthropic.messages.stream({ ... });
 *   let total_tokens = 0;
 *   for await (const event of stream) {
 *     if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
 *       yield { type: 'text', text: event.delta.text };
 *     }
 *     if (event.type === 'message_delta' && event.usage) {
 *       total_tokens = event.usage.output_tokens;
 *     }
 *   }
 *   yield { type: 'done', total_tokens };
 * }
 *
 * Return: createSSEResponse(generateContentPreview(params))
 *
 * Error codes (returned as JSON before stream starts):
 * 400: missing_prompt | prompt_too_long
 * 401: not authenticated
 */
```

---

### Component 4: SOV Simulate Stream — `app/api/sov/simulate-stream/route.ts`

```typescript
/**
 * POST /api/sov/simulate-stream
 * Streams a simulated AI answer for a target query.
 * Shows what an AI assistant would say if asked this query.
 * Auth: org member required.
 * Rate limited.
 *
 * Request body:
 * {
 *   query_text: string;        // the SOV target query (required, max 300 chars)
 *   location_city?: string;    // e.g. "Alpharetta, GA" for local context
 *   org_name?: string;         // for context (does the AI mention us?)
 * }
 *
 * Validation:
 * - query_text required → 400 'missing_query'
 * - query_text.length > 300 → 400 'query_too_long'
 *
 * System prompt (built server-side, not from client):
 * "You are a helpful AI assistant answering questions about local businesses.
 *  Answer naturally and concisely, as if you were actually responding to this
 *  query in a chat interface. If recommending businesses, be specific.
 *  Keep your answer to 2-3 short paragraphs."
 *
 * User message:
 * `${query_text}${location_city ? ` in ${location_city}` : ''}`
 *
 * Generator function:
 * async function* generateSOVSimulation(params): AsyncGenerator<SSEChunk> {
 *   yield { type: 'metadata', metadata: { query: params.query_text } };
 *   const stream = anthropic.messages.stream({
 *     model: 'claude-3-5-haiku-20241022',
 *     max_tokens: 512,
 *     system: SOV_SIMULATION_SYSTEM_PROMPT,
 *     messages: [{ role: 'user', content: userMessage }],
 *   });
 *   for await (const event of stream) {
 *     if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
 *       yield { type: 'text', text: event.delta.text };
 *     }
 *   }
 *   yield { type: 'done' };
 * }
 *
 * Return: createSSEResponse(generateSOVSimulation(params))
 *
 * NOTE: org_name is used for display context only — the prompt does NOT
 * instruct the AI to mention the org. We want to see what it naturally says.
 */
```

---

### Component 5: `useStreamingResponse` Hook — `hooks/useStreamingResponse.ts`

```typescript
/**
 * 'use client'
 * Reusable hook for consuming SSE streams from POST endpoints.
 *
 * useStreamingResponse(url: string, options?: UseStreamingOptions): {
 *   state: StreamingState;
 *   start: (payload: unknown) => Promise<void>;
 *   cancel: () => void;
 *   reset: () => void;
 * }
 *
 * start(payload):
 * 1. Set status = 'connecting', reset text + error
 * 2. Create AbortController, store ref for cancel()
 * 3. fetch(url, {
 *      method: 'POST',
 *      headers: { 'Content-Type': 'application/json' },
 *      body: JSON.stringify(payload),
 *      signal: abortController.signal,
 *    })
 * 4. If response.ok = false: parse body as JSON error, set status='error'
 * 5. Set status = 'streaming'
 * 6. Read the response body via response.body.getReader()
 * 7. Decode chunks with TextDecoder
 * 8. Buffer partial SSE lines (chunks don't always align with \n\n boundaries)
 * 9. For each complete SSE line: parseSSELine() → SSEChunk
 *    - type='text': append to state.text, call options.onChunk
 *    - type='done': set status='complete', set total_tokens, call options.onComplete
 *    - type='error': set status='error', set error message, call options.onError
 *    - type='metadata': ignore (for now)
 * 10. On AbortError: set status='cancelled'
 * 11. On other error: set status='error', set error='connection_error'
 *
 * cancel():
 * 1. Call abortController.abort()
 * 2. Set status='cancelled'
 *
 * reset():
 * 1. Cancel if active
 * 2. Set state back to initial: { status: 'idle', text: '', error: null, total_tokens: null }
 *
 * IMPORTANT: SSE line buffering.
 * The fetch reader gives chunks of arbitrary size. A single \n\n-terminated
 * SSE event may span multiple chunks, OR a chunk may contain multiple events.
 * Buffer approach:
 *   let buffer = '';
 *   // On each chunk:
 *   buffer += decoder.decode(value, { stream: true });
 *   const lines = buffer.split('\n\n');
 *   buffer = lines.pop() ?? ''; // keep incomplete last line in buffer
 *   for (const line of lines) {
 *     const chunk = parseSSELine(line);
 *     if (chunk) handleChunk(chunk);
 *   }
 *
 * IMPORTANT: React state updates during streaming.
 * Use a ref for the accumulated text and only flush to state on each chunk
 * OR use setState with a functional update. Either pattern works.
 * Do not call setState on every single token if it causes UI jank.
 * Recommended: flush text state every 50ms using a setInterval in the hook.
 */
```

---

### Component 6: `StreamingTextDisplay` — `components/StreamingTextDisplay.tsx`

```typescript
/**
 * 'use client'
 * Renders streaming text with a blinking cursor while active.
 *
 * Props: {
 *   text: string;
 *   status: StreamingStatus;
 *   className?: string;
 *   placeholder?: string;    // shown when text='' and status='idle'
 * }
 *
 * Rendering:
 * - status='idle': show placeholder (muted gray)
 * - status='connecting': show "Generating..." with animated dots
 * - status='streaming': show text + blinking cursor (|)
 *   Cursor: CSS animation, blinks at 0.7s interval
 * - status='complete': show text, no cursor
 * - status='error': show text so far (if any), then red error message
 * - status='cancelled': show text so far, gray "(Cancelled)" suffix
 *
 * Text rendering: preserve line breaks (whitespace-pre-wrap)
 * Font: monospace (content looks better in mono during streaming)
 *
 * Cursor animation (CSS via Tailwind or inline):
 *   @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
 *   animation: blink 0.7s step-end infinite
 *
 * data-testid:
 *   "streaming-text-display"
 *   "streaming-cursor"    (only when status='streaming')
 *   "streaming-placeholder" (only when status='idle')
 */
```

---

### Component 7: `StreamingPreviewPanel` — `app/dashboard/content/_components/StreamingPreviewPanel.tsx`

```typescript
/**
 * 'use client'
 * Content preview panel that streams AI-generated content.
 * Replaces or extends the existing preview button/modal in the content draft UI.
 *
 * Read app/dashboard/content/ to understand the existing preview pattern.
 * If there's already a preview button: wire it to streaming.
 * If not: add a "Preview" button to the draft editor.
 *
 * Props: {
 *   targetPrompt: string;
 *   draftTitle?: string;
 *   contentType?: string;
 * }
 *
 * Uses: useStreamingResponse('/api/content/preview-stream')
 *
 * UI:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  AI Content Preview                              [Generate] [✕]  │
 * │  ──────────────────────────────────────────────────────────────  │
 * │  {StreamingTextDisplay}                                          │
 * │  ──────────────────────────────────────────────────────────────  │
 * │  {status='streaming'}: [Stop Generation]                         │
 * │  {status='complete'}:  [Regenerate] [Use This Content]           │
 * │  {status='error'}:     [Try Again]                               │
 * │                                                                  │
 * │  {total_tokens && status='complete'}: ~{total_tokens} tokens     │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * "Use This Content" button: calls onAccept(state.text) to save the
 * streamed content into the draft editor field.
 *
 * Props:
 *   + onAccept?: (content: string) => void
 *
 * data-testid:
 *   "streaming-preview-panel"
 *   "generate-preview-btn"
 *   "stop-generation-btn"
 *   "regenerate-btn"
 *   "use-content-btn"
 */
```

---

### Component 8: `StreamingSimulatePanel` — `app/dashboard/share-of-voice/_components/StreamingSimulatePanel.tsx`

```typescript
/**
 * 'use client'
 * SOV query simulation panel — shows what AI would say if asked this query.
 *
 * Read app/dashboard/share-of-voice/ to understand the existing query detail view.
 * Add this panel to the query detail or query card UI.
 *
 * Props: {
 *   queryText: string;
 *   locationCity?: string;
 *   orgName?: string;
 * }
 *
 * Uses: useStreamingResponse('/api/sov/simulate-stream')
 *
 * UI:
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  🤖 AI Response Simulation                     [Simulate] [✕]   │
 * │  "What would AI say if asked this query?"                        │
 * │  ──────────────────────────────────────────────────────────────  │
 * │  {StreamingTextDisplay}                                          │
 * │  ──────────────────────────────────────────────────────────────  │
 * │  {status='streaming'}: [Stop]                                    │
 * │  {status='complete'}:
 *      Does this response mention {orgName}?
 *      [✅ Yes — mentioned] / [❌ Not mentioned]
 *      (scan the completed text for orgName)                         │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * "Does this mention {orgName}?" logic:
 * After streaming completes, check if state.text.toLowerCase().includes(
 *   orgName.toLowerCase()
 * )
 * Show: "✅ {orgName} was mentioned" or "❌ {orgName} was not mentioned"
 * This is a quick heuristic — not the same as the full SOV citation detection.
 *
 * data-testid:
 *   "streaming-simulate-panel"
 *   "simulate-query-btn"
 *   "stop-simulate-btn"
 *   "org-mentioned-indicator"
 *   "org-not-mentioned-indicator"
 */
```

---

### Component 9: Dashboard Integration

```typescript
/**
 * Wire the streaming panels into existing dashboard pages.
 *
 * 1. app/dashboard/content/ — content draft editor/list
 *    Read the existing component structure.
 *    Find where draft content is displayed or edited.
 *    Add <StreamingPreviewPanel> near the target_prompt field.
 *    It should open inline (not a modal) when "Preview" is clicked.
 *    Pass onAccept to save the streamed content into the form state.
 *    Minimum changes to existing code.
 *
 * 2. app/dashboard/share-of-voice/ — SOV query detail
 *    Read the existing query detail component.
 *    Find where individual target queries are displayed.
 *    Add <StreamingSimulatePanel> below the query text.
 *    Collapsed by default ("Simulate AI Response" disclosure).
 *    Expands when clicked.
 *    Minimum changes to existing code.
 */
```

---

### Component 10: Golden Tenant Fixtures

```typescript
// Sprint 120 — streaming fixtures
import type { StreamingState, SSEChunk } from '@/lib/streaming/types';

export const MOCK_STREAMING_STATE_IDLE: StreamingState = {
  status: 'idle',
  text: '',
  error: null,
  total_tokens: null,
};

export const MOCK_STREAMING_STATE_STREAMING: StreamingState = {
  status: 'streaming',
  text: 'Charcoal N Chill is a premium hookah lounge and Indo-American fusion restaurant',
  error: null,
  total_tokens: null,
};

export const MOCK_STREAMING_STATE_COMPLETE: StreamingState = {
  status: 'complete',
  text: 'Charcoal N Chill is a premium hookah lounge and Indo-American fusion restaurant in Alpharetta, Georgia. Known for their extensive hookah menu with over 50 flavors, live entertainment including belly dancing, and late-night hours until 2 AM on weekends.',
  error: null,
  total_tokens: 142,
};

export const MOCK_STREAMING_STATE_ERROR: StreamingState = {
  status: 'error',
  text: '',
  error: 'stream_error',
  total_tokens: null,
};

export const MOCK_SSE_CHUNKS: SSEChunk[] = [
  { type: 'metadata', metadata: { model: 'claude-3-5-haiku-20241022' } },
  { type: 'text', text: 'Charcoal N Chill' },
  { type: 'text', text: ' is a premium' },
  { type: 'text', text: ' hookah lounge' },
  { type: 'done', total_tokens: 42 },
];
```

---

## 🧪 Testing — Write Tests FIRST (AI_RULES §4)

### Test File 1: `src/__tests__/unit/sse-utils.test.ts` — 12 tests

```
describe('parseSSELine — pure')
  1.  returns null for empty string
  2.  returns null for comment line (starts with ':')
  3.  returns null for line not starting with 'data: '
  4.  returns { type: 'done' } for 'data: [DONE]'
  5.  parses valid SSEChunk JSON correctly
  6.  returns null for malformed JSON
  7.  handles 'data: ' prefix correctly (removes exactly 6 chars)

describe('formatSSEChunk — pure')
  8.  returns string starting with 'data: '
  9.  returns string ending with '\n\n'
  10. JSON.parse of content between 'data: ' and '\n\n' equals input chunk

describe('SSE_HEADERS — constant')
  11. contains 'Content-Type': 'text/event-stream'
  12. contains 'Cache-Control': 'no-cache, no-transform'
```

### Test File 2: `src/__tests__/unit/streaming-routes.test.ts` — 16 tests

**Anthropic SDK mocked.**

```
describe('POST /api/content/preview-stream')
  1.  returns 401 when not authenticated
  2.  returns 400 'missing_prompt' when target_prompt absent
  3.  returns 400 'prompt_too_long' when > 500 chars
  4.  response has Content-Type: text/event-stream
  5.  response has Cache-Control: no-cache, no-transform
  6.  streams text chunks from Anthropic SDK
  7.  sends { type: 'done', total_tokens } as final chunk
  8.  uses claude-3-5-haiku model (not Sonnet or Opus)

describe('POST /api/sov/simulate-stream')
  9.  returns 401 when not authenticated
  10. returns 400 'missing_query' when query_text absent
  11. returns 400 'query_too_long' when > 300 chars
  12. response has Content-Type: text/event-stream
  13. streams text chunks from Anthropic SDK
  14. sends { type: 'done' } as final chunk
  15. system prompt does NOT instruct AI to mention org (check prompt content)
  16. appends location_city to user message when provided
```

### Test File 3: `src/__tests__/unit/use-streaming-response.test.ts` — 15 tests

**fetch mocked with ReadableStream simulation.**

```
describe('useStreamingResponse — fetch mocked')
  1.  initial state: { status: 'idle', text: '', error: null }
  2.  status changes to 'connecting' immediately on start()
  3.  status changes to 'streaming' when first byte received
  4.  text accumulates correctly across multiple chunks
  5.  status becomes 'complete' on receiving { type: 'done' } chunk
  6.  total_tokens populated from done chunk
  7.  calls options.onChunk on each text chunk
  8.  calls options.onComplete with full text on done
  9.  status becomes 'error' on { type: 'error' } chunk
  10. calls options.onError with error message
  11. cancel() aborts fetch and sets status='cancelled'
  12. reset() restores initial state from any status
  13. handles partial SSE lines correctly (line buffering)
  14. handles multiple events in a single chunk
  15. handles 400 response before stream starts — sets status='error'
```

### Test File 4: `src/__tests__/unit/streaming-text-display.test.ts` — 8 tests

**React Testing Library.**

```
describe('StreamingTextDisplay — RTL')
  1.  renders placeholder when status='idle' and text=''
  2.  renders "Generating..." when status='connecting'
  3.  renders text content when provided
  4.  shows blinking cursor (data-testid='streaming-cursor') when status='streaming'
  5.  hides cursor when status='complete'
  6.  shows error styling when status='error'
  7.  shows '(Cancelled)' suffix when status='cancelled'
  8.  applies whitespace-pre-wrap for line break preservation
```

### Test File 5: `src/__tests__/e2e/streaming.spec.ts` — Playwright — 8 tests

```
1.  Content preview: clicking Generate shows streaming text appearing progressively
2.  Content preview: Stop button appears during streaming, cancels on click
3.  Content preview: Regenerate button appears after completion
4.  Content preview: Use This Content populates draft editor field
5.  SOV simulate: clicking Simulate shows streaming AI response
6.  SOV simulate: org mentioned indicator shows after completion (org in text)
7.  SOV simulate: org not-mentioned indicator shows when org absent
8.  SOV simulate: Stop button cancels streaming mid-response
```

---

### Run Commands

```bash
npx vitest run src/__tests__/unit/sse-utils.test.ts               # 12 tests
npx vitest run src/__tests__/unit/streaming-routes.test.ts         # 16 tests
npx vitest run src/__tests__/unit/use-streaming-response.test.ts   # 15 tests
npx vitest run src/__tests__/unit/streaming-text-display.test.ts   # 8 tests
npx vitest run                                                      # ALL — zero regressions
npx playwright test src/__tests__/e2e/streaming.spec.ts            # 8 Playwright tests
npx tsc --noEmit                                                    # 0 type errors
```

**Total: 51 Vitest + 8 Playwright = 59 tests**

---

## 📂 Files to Create/Modify — 22 files

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `lib/streaming/types.ts` | **CREATE** | SSEChunk, StreamingState, parseSSELine() |
| 2 | `lib/streaming/sse-utils.ts` | **CREATE** | createSSEResponse(), formatSSEChunk(), SSE_HEADERS |
| 3 | `lib/streaming/index.ts` | **CREATE** | Barrel export |
| 4 | `hooks/useStreamingResponse.ts` | **CREATE** | SSE client hook with fetch+ReadableStream |
| 5 | `components/StreamingTextDisplay.tsx` | **CREATE** | Animated streaming text renderer |
| 6 | `app/api/content/preview-stream/route.ts` | **CREATE** | POST streaming content preview |
| 7 | `app/api/sov/simulate-stream/route.ts` | **CREATE** | POST streaming SOV simulation |
| 8 | `app/dashboard/content/_components/StreamingPreviewPanel.tsx` | **CREATE** | Content preview panel |
| 9 | `app/dashboard/share-of-voice/_components/StreamingSimulatePanel.tsx` | **CREATE** | SOV simulation panel |
| 10 | `app/dashboard/content/` (existing component) | **MODIFY** | Wire in StreamingPreviewPanel |
| 11 | `app/dashboard/share-of-voice/` (existing component) | **MODIFY** | Wire in StreamingSimulatePanel |
| 12 | `src/__fixtures__/golden-tenant.ts` | **MODIFY** | 5 streaming fixtures |
| 13 | `src/__tests__/unit/sse-utils.test.ts` | **CREATE** | 12 tests |
| 14 | `src/__tests__/unit/streaming-routes.test.ts` | **CREATE** | 16 tests |
| 15 | `src/__tests__/unit/use-streaming-response.test.ts` | **CREATE** | 15 tests |
| 16 | `src/__tests__/unit/streaming-text-display.test.ts` | **CREATE** | 8 tests |
| 17 | `src/__tests__/e2e/streaming.spec.ts` | **CREATE** | 8 Playwright tests |

*(total 17 tracked files; actual edits may touch 1-2 additional existing dashboard components)*

---

## 🚫 What NOT to Do

1. **DO NOT use `EventSource` for these endpoints** — `EventSource` is GET-only with no body. Both endpoints require POST (to send the prompt securely in the request body, not in a URL parameter which would be logged). Use `fetch()` with `response.body.getReader()` in the hook.

2. **DO NOT use Pages Router streaming patterns** (`res.write`, `res.setHeader`, `res.end`) — this is App Router. Use `ReadableStream` + `new Response(stream, { headers })`.

3. **DO NOT log AbortError at the `error` level** — when a client disconnects mid-stream (user cancels, tab closes), the ReadableStream controller receives an AbortError. This is expected behavior. Log at `debug` level only, or not at all.

4. **DO NOT include the org name in the SOV simulation system prompt** — the simulation should show what the AI naturally says. We want to measure whether we appear organically, not prompt the AI to mention us.

5. **DO NOT use Sonnet or Opus for streaming previews** — use `claude-3-5-haiku-20241022` (or the Haiku model string from `providers.ts`). Haiku is 10× faster and 20× cheaper than Opus for this use case. The preview quality is sufficient.

6. **DO NOT setState on every single token without throttling** — streaming can produce 5-10 tokens per second. React re-rendering on every token causes visual jank. Flush accumulated text to state every 50ms using `setInterval`, or batch updates. Test 1-4 in `use-streaming-response` implicitly check for this.

7. **DO NOT skip SSE line buffering** — `response.body.getReader()` gives arbitrary-size chunks. A single SSE event (`data: {...}\n\n`) may span 2+ chunks. The buffer splitting logic in the hook spec is mandatory, not optional.

8. **DO NOT expose the system prompt content to the client** — the system prompt is constructed server-side. The client sends only `target_prompt`, `content_type`, `max_words`. Never allow the client to specify the system prompt.

9. **DO NOT apply streaming to the hallucination audit or weekly digest** — those are batch operations. Streaming is for interactive, user-triggered previews only.

10. **DO NOT break existing draft save/create flow** — the streaming preview is a separate "preview" action. It does NOT replace the existing content generation flow that creates/saves drafts. The "Use This Content" button populates the editor field — the user still has to click Save.

11. **DO NOT use `page.waitForTimeout()` in Playwright** — event-driven waits only.

12. **DO NOT use `as any` on Supabase clients** (AI_RULES §38.2).

---

## ✅ Definition of Done

- [ ] `lib/streaming/types.ts` — SSEEventType (4 values), SSEChunk, StreamingStatus (6 values), StreamingState, UseStreamingOptions, parseSSELine() pure function
- [ ] `lib/streaming/sse-utils.ts` — createSSEResponse() wraps AsyncGenerator<SSEChunk>, formatSSEChunk() pure, SSE_HEADERS constant with 4 headers including X-Accel-Buffering
- [ ] `useStreamingResponse` — fetch + ReadableStream (NOT EventSource), SSE line buffering, status transitions (idle→connecting→streaming→complete/error/cancelled), cancel() via AbortController, reset()
- [ ] `StreamingTextDisplay` — 6 status states, blinking cursor during streaming, whitespace-pre-wrap
- [ ] `POST /api/content/preview-stream` — auth, validation, Haiku model, metadata + text + done chunks, createSSEResponse()
- [ ] `POST /api/sov/simulate-stream` — auth, validation, Haiku model, neutral system prompt (no org bias), location_city appended to query
- [ ] `StreamingPreviewPanel` — Generate/Stop/Regenerate/Use buttons, token count display, onAccept callback
- [ ] `StreamingSimulatePanel` — Simulate/Stop buttons, post-completion org-mention indicator
- [ ] Both panels wired into existing dashboard pages (minimum code changes)
- [ ] golden-tenant.ts: 5 streaming fixtures
- [ ] **51 Vitest + 8 Playwright = 59 tests passing**
- [ ] `npx vitest run` — ALL tests, zero regressions
- [ ] `npx tsc --noEmit` — 0 type errors
- [ ] DEVLOG.md entry written
- [ ] AI_RULES Rule 58 written
- [ ] roadmap.md Sprint 120 marked ✅

---

## ⚠️ Edge Cases

1. **Vercel's 60-second function timeout** — streaming responses are long-running. Vercel's default function timeout is 10s (Hobby) or 60s (Pro). Content previews at 300 words / ~100 tokens should complete in <10s with Haiku. SOV simulations at 512 tokens should complete in <8s. Both are well within limits. Add a note to DEVLOG: "If timeouts occur in production, increase Vercel function maxDuration in vercel.json."

2. **Client disconnects mid-stream** — when the user closes the tab or navigates away during streaming, the fetch request aborts. On the server, the ReadableStream controller receives a signal. The `createSSEResponse()` implementation catches AbortError and calls `controller.close()` silently. No error logged.

3. **Multiple rapid "Generate" clicks** — the component should cancel any active stream before starting a new one. The `start()` function should check if status is 'streaming' and call `cancel()` first. This is implicit in the hook design if cancel() is called in start() before resetting state.

4. **Token counting in Anthropic streaming** — token counts appear in `message_delta` events with `usage.output_tokens`. The generator captures this and includes it in the `done` chunk. If the `message_delta` event with usage is not received (network cut), `total_tokens` will be null. The UI handles null gracefully (don't show token count).

5. **SSE chunk size and buffering** — Vercel and nginx may buffer the SSE stream until a minimum buffer size is reached. The `X-Accel-Buffering: no` header disables nginx buffering. For Vercel's edge network, chunks should flush immediately when the `controller.enqueue()` is called. If buffering occurs in testing, try flushing a larger initial comment: `: keep-alive\n\n` before the first data event.

6. **Rate limiting on expensive endpoints** — streaming routes are protected by Sprint 118 rate limiting. A single streaming request may take 5-10 seconds. During that time, the user might hit the rate limit if they click Generate rapidly. This is intentional — streaming previews should not be spammed.

---

## 🔮 AI_RULES Update (Add Rule 58)

```markdown
## 58. ⚡ SSE Streaming in `lib/streaming/` + `hooks/` (Sprint 120)

* **POST endpoints, NOT EventSource.** EventSource is GET-only. Use fetch() +
  response.body.getReader() in the hook. Never use EventSource for these routes.
* **App Router SSE pattern:** new Response(new ReadableStream({...}), { headers })
  with Content-Type: text/event-stream. Never use res.write() (Pages Router).
* **Line buffering is mandatory.** SSE events may span multiple fetch chunks.
  Buffer with split('\n\n'), keep last partial line in buffer.
* **AbortError = expected.** Log at debug (or not at all). Client disconnect
  is not an error. createSSEResponse() catches AbortError and closes silently.
* **Haiku model for streaming.** claude-3-5-haiku for previews + simulation.
  Never use Sonnet/Opus for interactive streaming — cost and latency.
* **State flush throttling.** Don't setState on every token. Flush every 50ms
  via setInterval or batch updates to avoid React re-render jank.
* **System prompts are server-only.** Client sends prompt text only.
  System prompt constructed server-side. Never accept system_prompt from client.
* **cancel() via AbortController.** Wire signal into fetch(). cancel() calls
  abortController.abort() and sets status='cancelled'.
```

---

## 🗺️ What Comes Next

**Sprint 121 — Correction Follow-up + Settings Expansion:** When a hallucination is marked as "corrected" by the org owner, automatically generate a correction brief (a content piece that establishes the correct information), track correction effectiveness by re-running the hallucinated query after 2 weeks, and expand the settings page with notification preferences, AI scan frequency controls, and API key management for white-label orgs.
