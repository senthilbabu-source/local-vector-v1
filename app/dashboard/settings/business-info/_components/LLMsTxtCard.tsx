'use client';

// ---------------------------------------------------------------------------
// LLMsTxtCard — AI Visibility File Card (Sprint 97)
//
// Shows the org's llms.txt URL, last updated timestamp, and a Regenerate
// button (Growth+ only). Displayed on the Business Info settings page.
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import { regenerateLLMsTxt } from '@/app/actions/regenerate-llms-txt';

interface LLMsTxtCardProps {
  orgSlug: string;
  llmsTxtUpdatedAt: string | null;
  canRegenerate: boolean;
}

export default function LLMsTxtCard({
  orgSlug,
  llmsTxtUpdatedAt,
  canRegenerate,
}: LLMsTxtCardProps) {
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState(llmsTxtUpdatedAt);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const llmsTxtUrl = `/llms.txt?org=${orgSlug}`;

  function handleCopy() {
    const fullUrl = `${window.location.origin}${llmsTxtUrl}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateLLMsTxt();
      if (result.success) {
        setLastUpdated(new Date().toISOString());
      } else {
        setError(result.error === 'upgrade_required'
          ? 'Growth plan required'
          : 'Failed to regenerate');
      }
    });
  }

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-white">AI Visibility File</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Your llms.txt file provides verified business data to AI models.
        </p>
      </div>

      {/* URL display + copy */}
      <div className="flex items-center gap-2">
        <code
          data-testid="llms-txt-url"
          className="flex-1 truncate rounded bg-slate-900 px-2 py-1 text-xs text-slate-300 font-mono"
        >
          {llmsTxtUrl}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </div>

      {/* Last updated */}
      <p
        data-testid="llms-txt-updated-at"
        className="text-xs text-slate-400"
      >
        Last updated: {formattedDate}
      </p>

      {/* Regenerate button (Growth+ only) */}
      {canRegenerate && (
        <button
          type="button"
          data-testid="llms-txt-regenerate-btn"
          onClick={handleRegenerate}
          disabled={isPending}
          className="rounded bg-electric-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-electric-indigo/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Regenerating\u2026' : 'Regenerate Now'}
        </button>
      )}

      {error && (
        <p className="text-xs text-alert-crimson">{error}</p>
      )}
    </div>
  );
}
