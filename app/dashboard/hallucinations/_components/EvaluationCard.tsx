'use client';

import { useState, useTransition } from 'react';
import { runAIEvaluation } from '../actions';
import type { EvaluationEngine } from '@/lib/schemas/evaluations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EngineEval = {
  id: string;
  engine: string;
  accuracy_score: number | null;
  hallucinations_detected: string[];
  created_at: string;
} | null;

interface Props {
  locationId: string;
  locationLabel: string;
  openaiEval: EngineEval;
  perplexityEval: EngineEval;
}

// ---------------------------------------------------------------------------
// Static config
// ---------------------------------------------------------------------------

const ENGINE_CONFIG: Record<EvaluationEngine, { label: string; badge: string; badgeClass: string }> = {
  openai: {
    label: 'OpenAI GPT-4o',
    badge: 'AI',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  perplexity: {
    label: 'Perplexity Sonar',
    badge: 'PX',
    badgeClass: 'bg-indigo-100 text-indigo-700',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-yellow-600';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-600';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'bg-slate-100 text-slate-500 ring-slate-500/20';
  if (score >= 90) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (score >= 70) return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
  if (score >= 50) return 'bg-orange-50 text-orange-700 ring-orange-600/20';
  return 'bg-red-50 text-red-700 ring-red-600/20';
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Not audited';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
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
// EngineRow sub-component
// ---------------------------------------------------------------------------

function EngineRow({
  engine,
  evalData,
  isPending,
  pendingEngine,
  onRun,
}: {
  engine: EvaluationEngine;
  evalData: EngineEval;
  isPending: boolean;
  pendingEngine: EvaluationEngine | null;
  onRun: (engine: EvaluationEngine) => void;
}) {
  const config = ENGINE_CONFIG[engine];
  const isThisEngineLoading = isPending && pendingEngine === engine;
  const score = evalData?.accuracy_score ?? null;
  const hallucinations: string[] = evalData?.hallucinations_detected ?? [];

  return (
    <div className="py-4 first:pt-0">
      {/* Engine header row */}
      <div className="flex items-center gap-3">
        {/* Engine badge */}
        <span
          className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md text-xs font-bold ${config.badgeClass}`}
          aria-hidden
        >
          {config.badge}
        </span>

        {/* Engine name + score */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{config.label}</p>
          {evalData?.created_at && (
            <p className="text-xs text-slate-400" suppressHydrationWarning>
              Last run: {formatTime(evalData.created_at)}
            </p>
          )}
        </div>

        {/* Accuracy score badge */}
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${scoreBg(score)}`}
        >
          {score !== null ? `${score}/100` : '—'}
        </span>

        {/* Score label */}
        <span className={`hidden shrink-0 text-xs font-medium sm:block ${scoreColor(score)}`}>
          {scoreLabel(score)}
        </span>

        {/* Run Audit button */}
        <button
          onClick={() => onRun(engine)}
          disabled={isPending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isThisEngineLoading ? (
            <>
              {/* Spinning loader */}
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
              Analyzing…
            </>
          ) : (
            <>
              {/* Play icon */}
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
              Run Audit
            </>
          )}
        </button>
      </div>

      {/* Hallucinations list */}
      {hallucinations.length > 0 && (
        <ul className="mt-2.5 ml-11 space-y-1.5">
          {hallucinations.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-[10px]">
                !
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}

      {evalData && hallucinations.length === 0 && (
        <p className="mt-2 ml-11 flex items-center gap-1.5 text-xs text-emerald-600">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          No hallucinations detected
        </p>
      )}

      {!evalData && !isThisEngineLoading && (
        <p className="mt-2 ml-11 text-xs text-slate-400">
          No audit run yet — click Run Audit to check this engine.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvaluationCard
// ---------------------------------------------------------------------------

export default function EvaluationCard({
  locationId,
  locationLabel,
  openaiEval,
  perplexityEval,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [pendingEngine, setPendingEngine] = useState<EvaluationEngine | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRun(engine: EvaluationEngine) {
    setError(null);
    setPendingEngine(engine);
    startTransition(async () => {
      const result = await runAIEvaluation({ location_id: locationId, engine });
      if (!result.success) setError(result.error);
      setPendingEngine(null);
    });
  }

  return (
    <div
      className={`overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5 transition-opacity ${
        isPending ? 'opacity-75' : ''
      }`}
    >
      {/* Card header */}
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-800">{locationLabel}</h2>
        <p className="text-xs text-slate-500">AI accuracy audit results</p>
      </div>

      {/* Engine rows */}
      <div className="divide-y divide-slate-100 px-5">
        <EngineRow
          engine="openai"
          evalData={openaiEval}
          isPending={isPending}
          pendingEngine={pendingEngine}
          onRun={handleRun}
        />
        <EngineRow
          engine="perplexity"
          evalData={perplexityEval}
          isPending={isPending}
          pendingEngine={pendingEngine}
          onRun={handleRun}
        />
      </div>

      {/* Inline error */}
      {error && (
        <div className="border-t border-red-100 bg-red-50 px-5 py-2.5">
          <p className="text-xs font-medium text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
