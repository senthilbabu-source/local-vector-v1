'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import type { AIMenuSuggestion, MenuContext } from '@/lib/menu-intelligence/ai-menu-suggestions';

// ---------------------------------------------------------------------------
// S66: AISuggestionsButton — Triggers AI-powered menu suggestions
// ---------------------------------------------------------------------------

interface AISuggestionsButtonProps {
  context: MenuContext;
  onSuggestions?: (suggestions: AIMenuSuggestion[]) => void;
}

export default function AISuggestionsButton({
  context,
  onSuggestions,
}: AISuggestionsButtonProps) {
  const [suggestions, setSuggestions] = useState<AIMenuSuggestion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleClick() {
    setError(false);
    startTransition(async () => {
      try {
        const { generateAIMenuSuggestions } = await import(
          '@/lib/menu-intelligence/ai-menu-suggestions'
        );
        const result = await generateAIMenuSuggestions(context);
        setSuggestions(result);
        onSuggestions?.(result);
      } catch (err) {
        Sentry.captureException(err, { tags: { component: 'AISuggestionsButton', sprint: 'S66' } });
        setError(true);
      }
    });
  }

  if (suggestions.length > 0) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
        data-testid="ai-menu-suggestions"
      >
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
          AI Suggestions
        </h4>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  s.impact === 'high'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {s.impact}
              </span>
              <div>
                <p className="text-xs font-medium text-white">{s.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending || context.itemCount === 0}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-600/30 disabled:opacity-50 transition-colors"
        data-testid="ai-suggest-button"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {isPending ? 'Generating...' : 'Get AI Suggestions'}
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-400">
          Could not generate suggestions. Try again later.
        </p>
      )}
    </div>
  );
}
