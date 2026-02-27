'use client';

import { useState, useTransition } from 'react';
import { addTargetQuery, runSovEvaluation, deleteTargetQuery } from '../actions';
import { canRunSovEvaluation } from '@/lib/plan-enforcer';
import type { SovEngine } from '@/lib/schemas/sov';
import GenerateBriefButton from './GenerateBriefButton';

// ---------------------------------------------------------------------------
// Types (exported so the page Server Component can construct them)
// ---------------------------------------------------------------------------

export type SovEvalRow = {
  id: string;
  engine: string;
  rank_position: number | null;
  mentioned_competitors: string[];
  created_at: string;
} | null;

export type QueryWithEvals = {
  id: string;
  query_text: string;
  openaiEval: SovEvalRow;
  perplexityEval: SovEvalRow;
};

interface Props {
  locationId: string;
  locationLabel: string;
  queries: QueryWithEvals[];
  plan: string;
  /** Sprint 86: Query IDs that already have a content brief draft */
  briefDraftQueryIds?: string[];
}

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const ENGINE_CONFIG: Record<SovEngine, { label: string; badge: string; badgeClass: string }> = {
  openai: {
    label: 'OpenAI',
    badge: 'AI',
    badgeClass: 'bg-signal-green/15 text-signal-green',
  },
  perplexity: {
    label: 'Perplexity',
    badge: 'PX',
    badgeClass: 'bg-electric-indigo/15 text-electric-indigo',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rankBg(rank: number | null): string {
  if (rank === null) return 'bg-white/5 text-[#94A3B8] ring-white/10';
  if (rank === 1) return 'bg-signal-green/10 text-signal-green ring-signal-green/20';
  if (rank <= 3) return 'bg-alert-amber/10 text-alert-amber ring-alert-amber/20';
  return 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20';
}

function rankLabel(rank: number | null): string {
  if (rank === null) return 'Not mentioned';
  return `#${rank}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// EngineCell sub-component
// ---------------------------------------------------------------------------

function EngineCell({
  engine,
  evalData,
  queryId,
  isRunPending,
  pendingKey,
  onRun,
  canRun,
}: {
  engine: SovEngine;
  evalData: SovEvalRow;
  queryId: string;
  isRunPending: boolean;
  pendingKey: string | null;
  onRun: (queryId: string, engine: SovEngine) => void;
  canRun: boolean;
}) {
  const config = ENGINE_CONFIG[engine];
  const key = `${queryId}:${engine}`;
  const isLoading = isRunPending && pendingKey === key;
  const rank = evalData?.rank_position ?? null;

  return (
    <div className="flex items-center gap-2">
      {/* Engine badge */}
      <span
        className={`flex h-6 w-6 shrink-0 select-none items-center justify-center rounded text-[10px] font-bold ${config.badgeClass}`}
        title={config.label}
        aria-label={config.label}
      >
        {config.badge}
      </span>

      {/* Rank badge */}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${rankBg(rank)}`}
      >
        {rankLabel(rank)}
      </span>

      {/* Run button */}
      <button
        onClick={() => onRun(queryId, engine)}
        disabled={isRunPending || !canRun}
        title={canRun ? `Run ${config.label} evaluation` : 'Upgrade to Growth to run evaluations'}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/10 bg-surface-dark px-2 py-1 text-xs font-medium text-[#94A3B8] transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-signal-green focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <svg
              className="h-3 w-3 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Running…
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
              />
            </svg>
            Run
          </>
        )}
      </button>

      {/* Last run timestamp */}
      {evalData?.created_at && (
        <span className="hidden shrink-0 text-xs text-slate-400 sm:block" suppressHydrationWarning>
          {formatTime(evalData.created_at)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueryRow sub-component
// ---------------------------------------------------------------------------

function QueryRow({
  query,
  isRunPending,
  pendingKey,
  onRun,
  canRun,
  onDelete,
  isDeletePending,
  hasBriefDraft,
}: {
  query: QueryWithEvals;
  isRunPending: boolean;
  pendingKey: string | null;
  onRun: (queryId: string, engine: SovEngine) => void;
  canRun: boolean;
  onDelete: (queryId: string) => void;
  isDeletePending: boolean;
  hasBriefDraft: boolean;
}) {
  // Aggregate competitors across both engines (deduplicated)
  const allCompetitors = Array.from(
    new Set([
      ...(query.openaiEval?.mentioned_competitors ?? []),
      ...(query.perplexityEval?.mentioned_competitors ?? []),
    ])
  );

  // Sprint 86: Show brief button when at least one engine returned null rank
  const hasEvals = query.openaiEval || query.perplexityEval;
  const isGap = hasEvals && (
    query.openaiEval?.rank_position === null ||
    query.perplexityEval?.rank_position === null
  );

  return (
    <div className="py-4 first:pt-0">
      {/* Query text + delete button */}
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-snug">
          &ldquo;{query.query_text}&rdquo;
        </p>
        <button
          type="button"
          onClick={() => onDelete(query.id)}
          disabled={isDeletePending}
          title="Delete query"
          className="shrink-0 rounded p-1 text-slate-600 transition hover:bg-white/5 hover:text-alert-crimson disabled:opacity-50"
          data-testid="delete-query-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Engine cells */}
      <div className="space-y-2 pl-1">
        <EngineCell
          engine="openai"
          evalData={query.openaiEval}
          queryId={query.id}
          isRunPending={isRunPending}
          pendingKey={pendingKey}
          onRun={onRun}
          canRun={canRun}
        />
        <EngineCell
          engine="perplexity"
          evalData={query.perplexityEval}
          queryId={query.id}
          isRunPending={isRunPending}
          pendingKey={pendingKey}
          onRun={onRun}
          canRun={canRun}
        />
      </div>

      {/* Sprint 86: Generate Brief button for gap queries */}
      {isGap && (
        <div className="mt-2.5 pl-1">
          <GenerateBriefButton
            queryId={query.id}
            queryText={query.query_text}
            hasDraft={hasBriefDraft}
          />
        </div>
      )}

      {/* Competitor mentions */}
      {allCompetitors.length > 0 && (
        <div className="mt-2.5 pl-1">
          <p className="mb-1 text-xs font-medium text-[#94A3B8]">Competitors mentioned:</p>
          <div className="flex flex-wrap gap-1.5">
            {allCompetitors.map((name) => (
              <span
                key={name}
                className="rounded-full bg-alert-crimson/10 px-2.5 py-0.5 text-xs font-medium text-alert-crimson ring-1 ring-inset ring-alert-crimson/20"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No evals yet */}
      {!query.openaiEval && !query.perplexityEval && (
        <p className="mt-2 pl-1 text-xs text-slate-400">
          No evaluations yet — click Run to check this query.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SovCard
// ---------------------------------------------------------------------------

export default function SovCard({ locationId, locationLabel, queries, plan, briefDraftQueryIds = [] }: Props) {
  const briefDraftSet = new Set(briefDraftQueryIds);
  const canRun = canRunSovEvaluation(plan as 'trial' | 'starter' | 'growth' | 'agency');

  // ── Run evaluation state ──────────────────────────────────────────────────
  const [isRunPending, startRunTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  function handleRun(queryId: string, engine: SovEngine) {
    const key = `${queryId}:${engine}`;
    setRunError(null);
    setPendingKey(key);
    startRunTransition(async () => {
      const result = await runSovEvaluation({ query_id: queryId, engine });
      if (!result.success) setRunError(result.error);
      setPendingKey(null);
    });
  }

  // ── Delete query state ────────────────────────────────────────────────────
  const [isDeletePending, startDeleteTransition] = useTransition();

  function handleDelete(queryId: string) {
    if (!window.confirm('Delete this query? This cannot be undone.')) return;
    startDeleteTransition(async () => {
      const fd = new FormData();
      fd.set('query_id', queryId);
      const result = await deleteTargetQuery(fd);
      if (!result.success) setRunError(result.error);
    });
  }

  // ── Add query state ───────────────────────────────────────────────────────
  const [isAddPending, startAddTransition] = useTransition();
  const [queryText, setQueryText] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  function handleAddQuery(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = queryText.trim();
    if (trimmed.length < 3) {
      setAddError('Query must be at least 3 characters');
      return;
    }
    setAddError(null);
    startAddTransition(async () => {
      const result = await addTargetQuery({ location_id: locationId, query_text: trimmed });
      if (result.success) {
        setQueryText('');
      } else {
        setAddError(result.error);
      }
    });
  }

  return (
    <div
      className={`overflow-hidden rounded-xl bg-surface-dark border border-white/5 transition-opacity ${
        isRunPending ? 'opacity-75' : ''
      }`}
    >
      {/* Card header */}
      <div className="border-b border-white/5 bg-midnight-slate px-5 py-3">
        <h2 className="text-sm font-semibold text-white">{locationLabel}</h2>
        <p className="text-xs text-[#94A3B8]">AI share of voice by query</p>
      </div>

      {/* Query rows */}
      {queries.length > 0 ? (
        <div className="divide-y divide-white/5 px-5">
          {queries.map((query) => (
            <QueryRow
              key={query.id}
              query={query}
              isRunPending={isRunPending}
              pendingKey={pendingKey}
              onRun={handleRun}
              canRun={canRun}
              onDelete={handleDelete}
              isDeletePending={isDeletePending}
              hasBriefDraft={briefDraftSet.has(query.id)}
            />
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-xs text-slate-400">
          No queries yet — add one below to start tracking AI visibility.
        </p>
      )}

      {/* Run error */}
      {runError && (
        <div className="border-t border-alert-crimson/20 bg-alert-crimson/10 px-5 py-2.5">
          <p className="text-xs font-medium text-alert-crimson">{runError}</p>
        </div>
      )}

      {/* Add query form */}
      <div className="border-t border-white/5 px-5 py-4">
        <form onSubmit={handleAddQuery} className="flex items-center gap-2">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder='e.g. "Best BBQ in Alpharetta GA"'
            disabled={isAddPending}
            maxLength={500}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-dark px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:border-signal-green/50 focus:outline-none focus:ring-2 focus:ring-signal-green/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAddPending || queryText.trim().length < 3}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-signal-green px-3 py-1.5 text-xs font-medium text-deep-navy transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-signal-green focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAddPending ? (
              <>
                <svg
                  className="h-3 w-3 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Adding…
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Query
              </>
            )}
          </button>
        </form>
        {addError && <p className="mt-1.5 text-xs text-alert-crimson">{addError}</p>}
      </div>
    </div>
  );
}
