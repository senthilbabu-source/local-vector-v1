'use client';

import { useState, useMemo } from 'react';
import type { AIResponseEntry } from '@/lib/data/ai-responses';
import ResponseCard from './ResponseCard';

// ---------------------------------------------------------------------------
// Category tabs
// ---------------------------------------------------------------------------

const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'near_me', label: 'Near Me' },
  { key: 'occasion', label: 'Occasion' },
  { key: 'custom', label: 'Custom' },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  entries: AIResponseEntry[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResponseLibrary({ entries }: Props) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return entries;
    return entries.filter((e) => e.queryCategory === activeTab);
  }, [entries, activeTab]);

  return (
    <div className="space-y-4">
      {/* Filter tabs + count */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                isActive
                  ? 'bg-electric-indigo/15 text-electric-indigo'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}

        <span className="ml-auto text-xs text-slate-500">
          {filtered.length} {filtered.length === 1 ? 'query' : 'queries'} with AI responses
        </span>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-dark px-6 py-12 text-center border border-white/5">
          <p className="text-sm font-medium text-[#94A3B8]">No responses in this category</p>
          <p className="mt-1 text-xs text-slate-400">
            Try selecting a different filter above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => (
            <ResponseCard key={entry.queryId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
