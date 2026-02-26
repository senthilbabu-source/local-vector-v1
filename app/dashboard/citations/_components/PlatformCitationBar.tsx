// ---------------------------------------------------------------------------
// PlatformCitationBar — Sprint 58A: Horizontal bars showing citation frequency
// ---------------------------------------------------------------------------

'use client';

import type { CitationSourceIntelligence } from '@/lib/types/citations';

interface Props {
  platforms: CitationSourceIntelligence[];
  coveredPlatforms: Set<string>;
}

export default function PlatformCitationBar({ platforms, coveredPlatforms }: Props) {
  // Sort by citation frequency descending
  const sorted = [...platforms].sort((a, b) => b.citation_frequency - a.citation_frequency);

  return (
    <div className="rounded-2xl bg-surface-dark border border-white/5 p-5">
      <h2 className="text-sm font-semibold text-white tracking-tight mb-4">
        Platforms AI Actually Cites
      </h2>
      <div className="space-y-3">
        {sorted.map((p) => {
          const pct = Math.round(p.citation_frequency * 100);
          const isCovered = coveredPlatforms.has(p.platform.toLowerCase());

          return (
            <div key={p.platform}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white capitalize">{p.platform}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-slate-300">{pct}%</span>
                  {isCovered ? (
                    <span className="text-[10px] font-medium text-signal-green">Listed ✓</span>
                  ) : (
                    <span className="text-[10px] font-medium text-alert-crimson">Not listed</span>
                  )}
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isCovered ? 'bg-signal-green' : 'bg-slate-600'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
