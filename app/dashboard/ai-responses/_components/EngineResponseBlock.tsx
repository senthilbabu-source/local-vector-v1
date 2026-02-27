'use client';

import { useState } from 'react';
import { parseDisplayText } from '@/lib/data/ai-responses';

// ---------------------------------------------------------------------------
// Rank badge helper (same logic as SovCard.tsx)
// ---------------------------------------------------------------------------

function rankBg(rank: number | null): string {
  if (rank === null) return 'bg-white/5 text-[#94A3B8] ring-white/10';
  if (rank === 1) return 'bg-signal-green/10 text-signal-green ring-signal-green/20';
  if (rank <= 3) return 'bg-alert-amber/10 text-alert-amber ring-alert-amber/20';
  return 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20';
}

function rankLabel(rank: number | null): string {
  if (rank === null) return 'Not mentioned';
  return `#${rank} Ranked`;
}

// ---------------------------------------------------------------------------
// Engine config
// ---------------------------------------------------------------------------

const ENGINE_CONFIG: Record<string, { label: string; dotClass: string }> = {
  openai: { label: 'ChatGPT', dotClass: 'bg-signal-green' },
  perplexity: { label: 'Perplexity', dotClass: 'bg-electric-indigo' },
  google: { label: 'Google AI Overview', dotClass: 'bg-alert-amber' },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRUNCATE_LENGTH = 200;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  engine: string;
  rankPosition: number | null;
  rawResponse: string | null;
  mentionedCompetitors: string[];
  citedSources?: { url: string; title: string }[] | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EngineResponseBlock({
  engine,
  rankPosition,
  rawResponse,
  mentionedCompetitors,
  citedSources,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const config = ENGINE_CONFIG[engine] ?? { label: engine, dotClass: 'bg-slate-400' };
  const displayText = parseDisplayText(rawResponse);

  const isLong = displayText !== null && displayText.length > TRUNCATE_LENGTH;
  const visibleText =
    displayText !== null && !expanded && isLong
      ? displayText.slice(0, TRUNCATE_LENGTH) + '…'
      : displayText;

  return (
    <div className="rounded-lg border border-white/5 bg-midnight-slate p-4">
      {/* Engine header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
          <span className="text-xs font-semibold text-white">{config.label}</span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${rankBg(rankPosition)}`}
        >
          {rankLabel(rankPosition)}
        </span>
      </div>

      {/* Response body */}
      {visibleText !== null ? (
        <div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {visibleText}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
            >
              {expanded ? 'Collapse' : 'Show full response'}
            </button>
          )}
        </div>
      ) : rawResponse !== null ? (
        <p className="text-sm text-slate-500 italic">
          Structured data only — re-run evaluation for full AI response
        </p>
      ) : rankPosition === null ? (
        <div>
          <p className="text-sm text-slate-500">Not mentioned by this engine</p>
          <a
            href="/dashboard/share-of-voice"
            className="mt-1 inline-block text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
          >
            Run SOV evaluation →
          </a>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500">No response recorded</p>
          <a
            href="/dashboard/share-of-voice"
            className="mt-1 inline-block text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
          >
            Run SOV evaluation →
          </a>
        </div>
      )}

      {/* Google cited sources */}
      {citedSources && citedSources.length > 0 && (
        <div className="mt-3 rounded-md border border-white/5 bg-white/[0.02] p-3">
          <p className="text-xs font-semibold text-slate-400 mb-2">Sources Google Cited</p>
          <ol className="space-y-1">
            {citedSources.map((source, i) => (
              <li key={source.url} className="text-xs text-slate-300">
                <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-electric-indigo hover:text-electric-indigo/80 transition underline underline-offset-2"
                >
                  {source.title || source.url}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Competitor pills */}
      {mentionedCompetitors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500">Competitors:</span>
          {mentionedCompetitors.map((name) => (
            <span
              key={name}
              className="rounded-full bg-alert-crimson/10 px-2 py-0.5 text-xs font-medium text-alert-crimson ring-1 ring-inset ring-alert-crimson/20"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
