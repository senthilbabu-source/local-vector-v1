'use client';

// ---------------------------------------------------------------------------
// app/dashboard/intent-discovery/IntentDiscoveryClient.tsx — Sprint 135
// ---------------------------------------------------------------------------

interface IntentGapRow {
  id: string;
  prompt: string;
  theme: string;
  competitors_cited: string[];
  opportunity_score: number;
  brief_created: boolean;
}

interface IntentDiscoveryClientProps {
  gaps: IntentGapRow[];
  coveredCount: number;
  latestRunDate: string | null;
  diminishingReturns: boolean;
}

const THEME_COLORS: Record<string, string> = {
  hours: 'bg-blue-500/20 text-blue-400',
  events: 'bg-purple-500/20 text-purple-400',
  offerings: 'bg-green-500/20 text-green-400',
  comparison: 'bg-red-500/20 text-red-400',
  occasion: 'bg-pink-500/20 text-pink-400',
  location: 'bg-amber-500/20 text-amber-400',
  other: 'bg-slate-500/20 text-slate-400',
};

export default function IntentDiscoveryClient({
  gaps,
  coveredCount,
  latestRunDate,
  diminishingReturns,
}: IntentDiscoveryClientProps) {
  return (
    <div data-testid="intent-discovery-page" className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Questions You're Missing
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Discover what customers are asking AI that you don't have an answer for.
          {latestRunDate && (
            <span className="ml-2 text-slate-400">
              Last run: {new Date(latestRunDate).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4">
        <div className="rounded-2xl border border-white/5 bg-surface-dark px-5 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-red-400">{gaps.length}</div>
          <div className="text-xs text-slate-400">Gaps Found</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-dark px-5 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {coveredCount}
          </div>
          <div className="text-xs text-slate-400">Covered</div>
        </div>
      </div>

      {/* Diminishing returns banner */}
      {diminishingReturns && gaps.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-400">
            Only {gaps.length} new gaps found. Consider reducing to monthly
            discovery runs.
          </p>
        </div>
      )}

      {/* No data state */}
      {gaps.length === 0 && coveredCount === 0 && (
        <div className="rounded-2xl border border-white/5 bg-surface-dark p-8 text-center">
          <p className="text-sm text-slate-400">
            No intent discoveries yet. Discovery runs weekly on Thursdays.
          </p>
        </div>
      )}

      {/* Gap cards */}
      <div className="space-y-3">
        {gaps.map((gap) => (
          <div
            key={gap.id}
            className="rounded-2xl border border-white/5 bg-surface-dark p-4 space-y-2"
            data-testid="intent-gap-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  &ldquo;{gap.prompt}&rdquo;
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${THEME_COLORS[gap.theme] ?? THEME_COLORS.other}`}
                  >
                    {gap.theme}
                  </span>
                  {gap.competitors_cited.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      Competitors: {gap.competitors_cited.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-3 flex flex-col items-end gap-1">
                <div className="text-xs text-slate-400">
                  Score:{' '}
                  <span className="font-bold text-white">
                    {gap.opportunity_score}
                  </span>
                </div>
                {/* Opportunity bar */}
                <div className="h-1.5 w-16 rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-electric-indigo"
                    style={{ width: `${gap.opportunity_score}%` }}
                  />
                </div>
              </div>
            </div>
            {!gap.brief_created && (
              <button
                type="button"
                className="text-xs text-electric-indigo hover:underline"
                data-testid="generate-brief-btn"
              >
                Generate Content Brief &rarr;
              </button>
            )}
            {gap.brief_created && (
              <span className="text-xs text-emerald-400">Brief created</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
