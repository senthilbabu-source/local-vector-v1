'use client';

import type { EngineFilter } from '@/lib/services/cluster-map.service';

// ---------------------------------------------------------------------------
// Engine display config — literal Tailwind classes (AI_RULES §12)
// ---------------------------------------------------------------------------

const ENGINE_LABELS: Record<EngineFilter, string> = {
  all: 'All Engines',
  perplexity: 'Perplexity',
  openai: 'ChatGPT',
  google: 'Gemini',
  copilot: 'Copilot',
};

interface EngineToggleProps {
  availableEngines: EngineFilter[];
  activeFilter: EngineFilter;
  onFilterChange: (filter: EngineFilter) => void;
  isLoading?: boolean;
}

export default function EngineToggle({
  availableEngines,
  activeFilter,
  onFilterChange,
  isLoading = false,
}: EngineToggleProps) {
  const allEngines: EngineFilter[] = ['all', 'perplexity', 'openai', 'google', 'copilot'];

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Engine filter">
      {allEngines.map((engine) => {
        const isAvailable = availableEngines.includes(engine);
        const isActive = engine === activeFilter;

        return (
          <button
            key={engine}
            role="radio"
            aria-checked={isActive}
            disabled={!isAvailable || isLoading}
            onClick={() => onFilterChange(engine)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              isActive
                ? 'bg-signal-green/15 text-signal-green ring-1 ring-signal-green/30'
                : isAvailable
                  ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                  : 'bg-white/[0.02] text-slate-600 cursor-not-allowed',
            ].join(' ')}
          >
            {isActive && (
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal-green" />
            )}
            {ENGINE_LABELS[engine]}
          </button>
        );
      })}
    </div>
  );
}
