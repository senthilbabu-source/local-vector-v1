'use client';

// ---------------------------------------------------------------------------
// QueryDrawer — Side panel for diagnosing a failing (0%) voice query
//
// Sprint §210: Live Scan Experience + Query Diagnostic
// Opens when a 0% citation-rate row is clicked. Shows:
//   - The query text
//   - Plain-English explanation of why it fails (by category)
//   - Pre-written suggested answer from voice-gap-detector
//   - "Use this answer" button — copies Q&A in llms.txt-compatible format
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { X, AlertTriangle, Copy, Check } from 'lucide-react';

// ── Sub-types ────────────────────────────────────────────────────────────────

interface VoiceQueryRow {
  id: string;
  query_text: string;
  query_category: string;
  citation_rate: number | null;
}

interface VoiceGapItem {
  category: string;
  queries: string[];
  weeks_at_zero: number;
  suggested_query_answer: string;
}

export interface QueryDrawerProps {
  /** The failing query to diagnose, or null when closed */
  query: VoiceQueryRow | null;
  voiceGaps: VoiceGapItem[];
  onClose: () => void;
}

// ── Why-it-fails explanations (one per query category) ────────────────────

const FAIL_REASONS: Record<string, string> = {
  discovery:
    "Your business isn't appearing when AI is asked to find places like yours nearby. AI needs locally-specific content that directly answers discovery queries — business type, neighborhood, and standout amenities.",
  action:
    "AI assistants can't find your contact or reservation details when someone asks how to visit or book. This means missed walk-ins and direct bookings that go to competitors instead.",
  comparison:
    "AI isn't confidently recommending you over competitors. It needs concrete differentiators — signature dishes, awards, or unique experiences — to cite you in comparison queries.",
  information:
    "AI doesn't have your current hours, address, or basic facts to share with voice searchers. This is the most direct gap to fix: a single structured answer can unlock multiple AI citations.",
};

// ── Component ─────────────────────────────────────────────────────────────

export function QueryDrawer({ query, voiceGaps, onClose }: QueryDrawerProps) {
  const [copied, setCopied] = useState(false);

  // Reset copy state when query changes
  useEffect(() => {
    setCopied(false);
  }, [query]);

  // Close on Escape key
  useEffect(() => {
    if (!query) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [query, onClose]);

  if (!query) return null;

  // Match this query's category to a voice gap for the suggested answer
  const matchingGap = voiceGaps.find((g) => g.category === query.query_category) ?? null;

  const failReason =
    FAIL_REASONS[query.query_category] ?? 'This query is getting zero AI citations.';

  // llms.txt-compatible Q&A format
  const llmsTxtAnswer = matchingGap
    ? `Q: ${query.query_text}\nA: ${matchingGap.suggested_query_answer}`
    : null;

  const handleCopy = async () => {
    if (!llmsTxtAnswer) return;
    await navigator.clipboard.writeText(llmsTxtAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        data-testid="query-drawer-backdrop"
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Query Analysis"
        className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-white/10 bg-surface-dark shadow-2xl"
        data-testid="query-drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Query Analysis</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:text-white"
            aria-label="Close"
            data-testid="query-drawer-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">

          {/* Query text */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Query
            </p>
            <p
              className="text-base font-medium leading-snug text-white"
              data-testid="query-drawer-text"
            >
              &ldquo;{query.query_text}&rdquo;
            </p>
            <p className="mt-1 text-xs capitalize text-slate-500">
              {query.query_category} &middot; 0% AI citation rate
            </p>
          </div>

          {/* Why it fails */}
          <div
            className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4"
            data-testid="query-drawer-fail-reason"
          >
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
              <p className="text-xs font-semibold text-amber-400">Why this is failing</p>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{failReason}</p>
          </div>

          {/* Suggested answer */}
          <div data-testid="query-drawer-suggestion">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Suggested Answer
            </p>
            {matchingGap ? (
              <>
                <p className="rounded-lg bg-white/[0.04] p-4 text-sm italic leading-relaxed text-slate-200">
                  &ldquo;{matchingGap.suggested_query_answer}&rdquo;
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Add this answer to your FAQ page or GBP post to start earning AI citations.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                Run a Voice Check to generate a personalized suggested answer for this category.
              </p>
            )}
          </div>
        </div>

        {/* Footer CTA — only shown when there is an answer to copy */}
        {llmsTxtAnswer && (
          <div className="border-t border-white/5 p-5">
            <button
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-electric-indigo px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-electric-indigo/90"
              data-testid="query-drawer-copy"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied to clipboard
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Use this answer
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Copies in Q&amp;A format — paste into your FAQ page or GBP post
            </p>
          </div>
        )}
      </div>
    </>
  );
}
