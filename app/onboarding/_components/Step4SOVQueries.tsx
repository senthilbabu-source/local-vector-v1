'use client';

// ---------------------------------------------------------------------------
// Step4SOVQueries — Sprint 91
//
// Displays auto-seeded SOV target queries and allows the user to add up to 3
// custom queries. Non-blocking: always allows advancing even if query load fails.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import {
  addCustomSOVQuery,
  deleteCustomSOVQuery,
  type TargetQueryRow,
} from '../actions';

interface Step4SOVQueriesProps {
  initialQueries: TargetQueryRow[];
  onComplete: () => void;
  onBack: () => void;
  /** Industry-specific placeholder — Sprint E */
  searchPlaceholder?: string;
}

export default function Step4SOVQueries({
  initialQueries,
  onComplete,
  onBack,
  searchPlaceholder = 'e.g. best hookah bar with live music',
}: Step4SOVQueriesProps) {
  const [isPending, startTransition] = useTransition();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Separate auto-generated from custom queries
  const [customQueries, setCustomQueries] = useState<TargetQueryRow[]>(
    initialQueries.filter((q) => q.query_category === 'custom'),
  );
  const autoQueries = initialQueries.filter(
    (q) => q.query_category !== 'custom',
  );

  const trimmed = inputValue.trim();
  const canAdd = trimmed.length >= 3 && customQueries.length < 3;

  function handleAdd() {
    if (!canAdd) return;
    setError(null);
    startTransition(async () => {
      const result = await addCustomSOVQuery(trimmed);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Add to local state with a temporary ID (server generated the real one)
      setCustomQueries((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, query_text: trimmed, query_category: 'custom' },
      ]);
      setInputValue('');
    });
  }

  function handleRemove(queryId: string) {
    setError(null);
    startTransition(async () => {
      // Only call delete for non-temp IDs
      if (!queryId.startsWith('temp-')) {
        const result = await deleteCustomSOVQuery(queryId);
        if (!result.success) {
          setError(result.error);
          return;
        }
      }
      setCustomQueries((prev) => prev.filter((q) => q.id !== queryId));
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight mb-1">
          How will AI find you?
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          These are the questions we&apos;ll track in ChatGPT, Perplexity,
          Google Gemini, and Copilot.
        </p>
      </div>

      {/* Auto-generated queries */}
      {autoQueries.length > 0 && (
        <div data-testid="step4-query-list" className="space-y-1.5">
          <p className="text-xs font-medium text-slate-400 mb-2">
            Auto-generated for you:
          </p>
          {autoQueries.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-2 rounded-lg bg-midnight-slate border border-white/5 px-3 py-2"
            >
              <span className="text-signal-green text-xs shrink-0">&#10003;</span>
              <span className="text-sm text-slate-300">
                &ldquo;{q.query_text}&rdquo;
              </span>
            </div>
          ))}
        </div>
      )}

      {autoQueries.length === 0 && (
        <div data-testid="step4-query-list" className="rounded-lg bg-midnight-slate border border-white/5 px-4 py-6 text-center">
          <p className="text-sm text-slate-400">
            Your queries will be generated after setup.
          </p>
        </div>
      )}

      {/* Custom query input */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-400">
          + Add your own query ({3 - customQueries.length} remaining)
        </p>
        <div className="flex gap-2">
          <input
            data-testid="step4-custom-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            maxLength={500}
            className="flex-1 rounded-lg border border-white/10 bg-midnight-slate px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-signal-green/50 focus:border-signal-green/50 transition"
          />
          <button
            data-testid="step4-add-query-btn"
            type="button"
            onClick={handleAdd}
            disabled={!canAdd || isPending}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>

      {/* Custom queries list */}
      {customQueries.length > 0 && (
        <div className="space-y-1.5">
          {customQueries.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between rounded-lg bg-midnight-slate border border-white/5 px-3 py-2"
            >
              <span className="text-sm text-white">
                &ldquo;{q.query_text}&rdquo;
              </span>
              <button
                type="button"
                onClick={() => handleRemove(q.id)}
                disabled={isPending}
                className="text-slate-500 hover:text-alert-crimson transition-colors text-lg leading-none"
                aria-label={`Remove query: ${q.query_text}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-alert-crimson bg-alert-crimson/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        <button
          data-testid="step4-back-btn"
          type="button"
          onClick={onBack}
          disabled={isPending}
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
        >
          Back
        </button>
        <button
          data-testid="step4-next-btn"
          type="button"
          onClick={onComplete}
          disabled={isPending}
          className="flex-1 rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition disabled:opacity-60"
        >
          Next &rarr; Launch
        </button>
      </div>
    </div>
  );
}
