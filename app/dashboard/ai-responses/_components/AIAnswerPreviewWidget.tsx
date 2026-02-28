'use client';

// ---------------------------------------------------------------------------
// AIAnswerPreviewWidget — Sprint F (N2) + Sprint N: Token Streaming
//
// Fires a single POST to /api/ai-preview, reads the SSE stream, and updates
// model response cards as chunks arrive — true token-by-token streaming.
//
// Sprint N enhancement: switched from batch (one event per model) to
// incremental streaming (chunks accumulate in real time, with cursor).
//
// Credit cost: 1 credit per run (composite query, regardless of model count).
// Max query length: 200 characters.
// Placement: Top of /dashboard/ai-responses page, above stored responses.
// ---------------------------------------------------------------------------

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

const MODELS = ['chatgpt', 'perplexity', 'gemini'] as const;
type ModelId = (typeof MODELS)[number];

const MODEL_LABELS: Record<ModelId, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
};

const MODEL_COLORS: Record<ModelId, string> = {
  chatgpt: 'border-emerald-500/30 bg-emerald-500/5',
  perplexity: 'border-blue-500/30 bg-blue-500/5',
  gemini: 'border-violet-500/30 bg-violet-500/5',
};

interface ModelState {
  status: 'idle' | 'loading' | 'streaming' | 'complete' | 'error';
  content: string;
}

const INITIAL_STATE: Record<ModelId, ModelState> = {
  chatgpt: { status: 'idle', content: '' },
  perplexity: { status: 'idle', content: '' },
  gemini: { status: 'idle', content: '' },
};

const MAX_CHARS = 200;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIAnswerPreviewWidget() {
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState<Record<ModelId, ModelState>>(INITIAL_STATE);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const charCount = query.length;
  const queryValid = query.trim().length >= 3 && charCount <= MAX_CHARS;

  const handleRun = useCallback(async () => {
    if (!queryValid || running) return;
    setCreditError(null);
    setHasRun(true);
    setRunning(true);

    // Reset all models to loading
    setModels({
      chatgpt: { status: 'loading', content: '' },
      perplexity: { status: 'loading', content: '' },
      gemini: { status: 'loading', content: '' },
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
        signal: controller.signal,
      });

      if (res.status === 402) {
        const data = await res.json();
        setCreditError(
          `You've used ${data.creditsUsed} of ${data.creditsLimit} credits this month. Upgrade your plan for more.`,
        );
        setModels(INITIAL_STATE);
        setRunning(false);
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error(`API error: ${res.status}`);
      }

      // Read SSE stream — token-by-token chunks
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === 'done') break;
            if (event.type === 'error') {
              setModels((prev) => {
                const next = { ...prev };
                for (const m of MODELS) {
                  if (next[m].status === 'loading' || next[m].status === 'streaming') {
                    next[m] = { status: 'error', content: event.message };
                  }
                }
                return next;
              });
              break;
            }

            // Model chunk event: { model, chunk, done, error? }
            if (event.model && MODELS.includes(event.model as ModelId)) {
              const modelId = event.model as ModelId;

              if (event.error) {
                // Model-level error
                setModels((prev) => ({
                  ...prev,
                  [modelId]: { status: 'error', content: event.error },
                }));
              } else if (event.done) {
                // Model finished streaming
                setModels((prev) => ({
                  ...prev,
                  [modelId]: {
                    status: 'complete',
                    content: prev[modelId].content || '(No response)',
                  },
                }));
              } else {
                // Append text chunk
                setModels((prev) => ({
                  ...prev,
                  [modelId]: {
                    status: 'streaming',
                    content: prev[modelId].content + (event.chunk ?? ''),
                  },
                }));
              }
            }
          } catch (err) {
            Sentry.captureException(err, {
              tags: { file: 'AIAnswerPreviewWidget.tsx', component: 'SSE-parse', sprint: 'N' },
            });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // User stopped
      Sentry.captureException(err, {
        tags: { file: 'AIAnswerPreviewWidget.tsx', component: 'handleRun', sprint: 'N' },
      });
      setModels((prev) => {
        const next = { ...prev };
        for (const m of MODELS) {
          if (next[m].status === 'loading' || next[m].status === 'streaming') {
            next[m] = { status: 'error', content: 'Preview failed — please try again' };
          }
        }
        return next;
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [query, queryValid, running]);

  function handleStop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  return (
    <div
      className="rounded-xl border border-white/10 bg-surface-dark p-5"
      data-testid="ai-preview-widget"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">AI Answer Preview</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          See what AI models say about your business right now. Costs 1 credit per run.
        </p>
      </div>

      {/* Query input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="best hookah lounge in Alpharetta for a birthday party"
            maxLength={MAX_CHARS}
            disabled={running}
            className="w-full rounded-lg border border-white/10 bg-midnight-slate px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-signal-green/50 disabled:opacity-50"
            data-testid="ai-preview-query-input"
          />
          <span
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums',
              charCount > MAX_CHARS - 20 ? 'text-amber-400' : 'text-slate-600',
            )}
          >
            {charCount}/{MAX_CHARS}
          </span>
        </div>
        <button
          type="button"
          onClick={running ? handleStop : handleRun}
          disabled={!queryValid && !running}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition',
            running
              ? 'bg-alert-crimson/20 text-alert-crimson hover:bg-alert-crimson/30'
              : 'bg-signal-green text-deep-navy hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          data-testid="ai-preview-run-btn"
        >
          {running ? (
            <>
              <Square className="h-3.5 w-3.5" />
              Stop
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Run Preview
            </>
          )}
        </button>
      </div>

      {/* Credit error */}
      {creditError && (
        <div
          className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300"
          data-testid="ai-preview-credit-error"
        >
          <span className="font-medium">Credit limit reached.</span> {creditError}{' '}
          <Link href="/dashboard/billing" className="underline hover:text-amber-200">
            View plans →
          </Link>
        </div>
      )}

      {/* Model response cards */}
      {hasRun && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="ai-preview-results">
          {MODELS.map((modelId) => (
            <ModelResponseCard
              key={modelId}
              modelId={modelId}
              label={MODEL_LABELS[modelId]}
              colorClass={MODEL_COLORS[modelId]}
              state={models[modelId]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModelResponseCard — single model result with streaming cursor
// ---------------------------------------------------------------------------

function ModelResponseCard({
  modelId,
  label,
  colorClass,
  state,
}: {
  modelId: ModelId;
  label: string;
  colorClass: string;
  state: ModelState;
}) {
  const isStreaming = state.status === 'streaming';

  return (
    <div
      className={cn('rounded-lg border p-4', colorClass)}
      data-testid={`ai-preview-card-${modelId}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {(state.status === 'loading' || isStreaming) && (
          <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-hidden="true" />
        )}
      </div>
      {state.status === 'idle' && <p className="text-sm text-slate-500">&mdash;</p>}
      {state.status === 'loading' && (
        <div className="space-y-1.5" aria-label={`${label} loading`}>
          <div className="h-2.5 w-full animate-pulse rounded bg-white/5" />
          <div className="h-2.5 w-4/5 animate-pulse rounded bg-white/5" />
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-white/5" />
        </div>
      )}
      {(isStreaming || state.status === 'complete') && (
        <p className="text-xs leading-relaxed text-slate-300" data-testid={`ai-preview-response-${modelId}`}>
          {state.content}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-slate-400" aria-hidden="true" />
          )}
        </p>
      )}
      {state.status === 'error' && (
        <p className="text-xs text-alert-crimson/80">{state.content}</p>
      )}
    </div>
  );
}
