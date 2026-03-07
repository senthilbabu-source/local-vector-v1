'use client';

import { useState, useTransition } from 'react';
import { MessageSquareText, Loader2, Copy, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// S45: SuggestResponseButton — AI response suggestion for negative reviews
// Uses existing response-generator.ts via server action.
// Credit-gated (1 credit per suggestion).
// ---------------------------------------------------------------------------

interface SuggestResponseButtonProps {
  reviewId: string;
  rating: number;
  reviewText: string;
  businessName: string;
}

export default function SuggestResponseButton({
  reviewId,
  rating,
  reviewText,
  businessName,
}: SuggestResponseButtonProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Only show for negative reviews (3 stars or below)
  if (rating > 3) return null;

  const handleSuggest = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/review-engine/${reviewId}/generate-draft`, {
          method: 'POST',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Failed to generate suggestion');
          return;
        }
        const data = await res.json();
        setSuggestion(data.draft ?? data.response_draft ?? 'No suggestion generated');
      } catch (_e) {
        setError('Something went wrong. Please try again.');
      }
    });
  };

  const handleCopy = async () => {
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {
      // Silent fail
    }
  };

  if (suggestion) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3" data-testid="review-suggestion">
        <p className="text-xs font-medium text-emerald-400 mb-1">Suggested Response</p>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{suggestion}</p>
        <button
          onClick={handleCopy}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          data-testid="copy-suggestion"
        >
          {copied ? (
            <><Check className="h-3 w-3" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" /> Copy response</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleSuggest}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        data-testid="suggest-response-button"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isPending ? 'Generating...' : 'Suggest Response'}
        <span className="text-[10px] text-slate-500 ml-1">(1 credit)</span>
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-400" data-testid="suggest-error">{error}</p>
      )}
    </div>
  );
}
