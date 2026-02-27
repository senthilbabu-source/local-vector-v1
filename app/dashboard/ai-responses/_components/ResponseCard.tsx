'use client';

import type { AIResponseEntry } from '@/lib/data/ai-responses';
import EngineResponseBlock from './EngineResponseBlock';

// ---------------------------------------------------------------------------
// Category badge config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  discovery: { label: 'Discovery', className: 'bg-electric-indigo/10 text-electric-indigo ring-electric-indigo/20' },
  comparison: { label: 'Comparison', className: 'bg-alert-amber/10 text-alert-amber ring-alert-amber/20' },
  near_me: { label: 'Near Me', className: 'bg-signal-green/10 text-signal-green ring-signal-green/20' },
  occasion: { label: 'Occasion', className: 'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20' },
  custom: { label: 'Custom', className: 'bg-white/5 text-[#94A3B8] ring-white/10' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  entry: AIResponseEntry;
  defaultExpanded?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResponseCard({ entry }: Props) {
  const category = CATEGORY_CONFIG[entry.queryCategory] ?? CATEGORY_CONFIG.custom;
  const formattedDate = new Date(entry.latestDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl bg-surface-dark border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/5 px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              &ldquo;{entry.queryText}&rdquo;
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Last checked: {formattedDate}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${category.className}`}
          >
            {category.label}
          </span>
        </div>
      </div>

      {/* Engine responses */}
      <div className="p-4 space-y-3">
        {entry.engines.map((eng) => (
          <EngineResponseBlock
            key={eng.engine}
            engine={eng.engine}
            rankPosition={eng.rankPosition}
            rawResponse={eng.rawResponse}
            mentionedCompetitors={eng.mentionedCompetitors}
            citedSources={eng.citedSources}
            createdAt={eng.createdAt}
          />
        ))}
      </div>
    </div>
  );
}
