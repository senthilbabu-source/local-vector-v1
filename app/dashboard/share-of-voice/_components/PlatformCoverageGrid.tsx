'use client';

import {
  buildCoverageMatrix,
  getCoverageColor,
  getPlatformCoverage,
  PLATFORM_LABELS,
} from '@/lib/services/platform-coverage';

// ---------------------------------------------------------------------------
// S57: PlatformCoverageGrid — Visual grid of query × platform coverage
// ---------------------------------------------------------------------------

interface PlatformCoverageGridProps {
  evaluations: Array<{
    query_text: string;
    model_provider: string;
    is_cited: boolean;
  }>;
}

export default function PlatformCoverageGrid({
  evaluations,
}: PlatformCoverageGridProps) {
  const matrix = buildCoverageMatrix(evaluations);

  if (matrix.queries.length === 0 || matrix.platforms.length === 0) {
    return null;
  }

  // Show max 10 queries to avoid overwhelming the grid
  const displayQueries = matrix.queries.slice(0, 10);

  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-900/50 p-5"
      data-testid="platform-coverage-grid"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          Platform Coverage
        </h3>
        <span className="text-xs text-slate-400">
          {matrix.coveragePercent}% overall
        </span>
      </div>

      {/* Platform headers with per-platform coverage */}
      <div className="mb-3 flex items-center gap-3 overflow-x-auto">
        <div className="w-32 shrink-0" />
        {matrix.platforms.map((p) => (
          <div key={p} className="w-16 shrink-0 text-center">
            <p className="text-[10px] font-medium text-slate-400 truncate">
              {PLATFORM_LABELS[p] ?? p}
            </p>
            <p className="text-[10px] text-slate-500">
              {getPlatformCoverage(matrix, p)}%
            </p>
          </div>
        ))}
      </div>

      {/* Grid rows */}
      <div className="space-y-1.5" role="img" aria-label="Platform coverage heatmap">
        <span className="sr-only">
          Coverage: {matrix.coveragePercent}% across {matrix.platforms.length} platforms and {matrix.queries.length} queries
        </span>
        {displayQueries.map((query) => (
          <div key={query} className="flex items-center gap-3">
            <p className="w-32 shrink-0 truncate text-xs text-slate-400" title={query}>
              {query}
            </p>
            {matrix.platforms.map((platform) => {
              const cell = matrix.cells.find(
                (c) => c.queryText === query && c.platform === platform,
              );
              const status = cell?.status ?? 'no_data';
              return (
                <div
                  key={platform}
                  className="w-16 h-6 shrink-0 rounded"
                  style={{ backgroundColor: getCoverageColor(status) }}
                  title={`${query} on ${PLATFORM_LABELS[platform] ?? platform}: ${status === 'cited' ? 'Cited' : status === 'not_cited' ? 'Not cited' : 'No data'}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {matrix.queries.length > 10 && (
        <p className="mt-3 text-xs text-slate-500">
          Showing 10 of {matrix.queries.length} queries
        </p>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#10b981' }} />
          <span>Cited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#ef4444' }} />
          <span>Not cited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#1e293b' }} />
          <span>No data</span>
        </div>
      </div>
    </div>
  );
}
