'use client';

// ---------------------------------------------------------------------------
// Step3Competitors — Sprint 91
//
// Free-form competitor name entry for onboarding Step 3.
// Users can add up to 5 competitor names, or skip entirely.
// Competitors are saved to the `competitors` table via seedOnboardingCompetitors().
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { seedOnboardingCompetitors } from '../actions';

interface Step3CompetitorsProps {
  onComplete: (competitors: string[]) => void;
  onBack: () => void;
}

export default function Step3Competitors({
  onComplete,
  onBack,
}: Step3CompetitorsProps) {
  const [isPending, startTransition] = useTransition();
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const trimmed = inputValue.trim();
  const canAdd = trimmed.length > 0 && competitors.length < 5;
  const isDuplicate = competitors.some(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  );

  function handleAdd() {
    if (!canAdd || isDuplicate) return;
    setCompetitors((prev) => [...prev, trimmed]);
    setInputValue('');
    setError(null);
  }

  function handleRemove(index: number) {
    setCompetitors((prev) => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      if (competitors.length > 0) {
        const result = await seedOnboardingCompetitors(competitors);
        if (!result.success) {
          setError(result.error);
          return;
        }
      }
      onComplete(competitors);
    });
  }

  function handleSkip() {
    onComplete([]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight mb-1">
          Who are your main competitors?
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          We&apos;ll track when AI models recommend them over you.
        </p>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          data-testid="step3-competitor-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a business..."
          maxLength={255}
          className="flex-1 rounded-lg border border-white/10 bg-midnight-slate px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-signal-green/50 focus:border-signal-green/50 transition"
        />
        <button
          data-testid="step3-add-btn"
          type="button"
          onClick={handleAdd}
          disabled={!canAdd || isDuplicate}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Duplicate warning */}
      {isDuplicate && trimmed.length > 0 && (
        <p className="text-xs text-alert-amber">
          This competitor is already in your list.
        </p>
      )}

      {/* Max warning */}
      {competitors.length >= 5 && (
        <p className="text-xs text-slate-400">
          Maximum 5 competitors reached.
        </p>
      )}

      {/* Competitor list */}
      {competitors.length > 0 && (
        <div data-testid="step3-competitor-list" className="space-y-2">
          <p className="text-xs font-medium text-slate-400">
            Added competitors:
          </p>
          {competitors.map((name, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg bg-midnight-slate border border-white/5 px-3 py-2.5"
            >
              <span className="text-sm text-white">{name}</span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="text-slate-500 hover:text-alert-crimson transition-colors text-lg leading-none"
                aria-label={`Remove ${name}`}
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
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex gap-3">
          <button
            data-testid="step3-back-btn"
            type="button"
            onClick={onBack}
            disabled={isPending}
            className="flex-1 rounded-lg border border-white/10 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
          >
            Back
          </button>
          <button
            data-testid="step3-next-btn"
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-deep-navy hover:brightness-110 transition disabled:opacity-60"
          >
            {isPending ? 'Saving...' : 'Next'}
          </button>
        </div>
        <button
          data-testid="step3-skip-btn"
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="text-center text-sm text-slate-400 transition-colors hover:text-white"
        >
          Skip for now — I&apos;ll add competitors later
        </button>
      </div>
    </div>
  );
}
