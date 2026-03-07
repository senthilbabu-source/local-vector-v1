'use client';

// ---------------------------------------------------------------------------
// S51: DashboardSectionSkeleton — Reusable inline skeleton for dashboard sections
// Uses CSS-only animation (animate-pulse). No JS timers.
// ---------------------------------------------------------------------------

interface DashboardSectionSkeletonProps {
  /** Visual variant */
  variant: 'card' | 'stat' | 'chart' | 'list';
  /** Number of skeleton items to render */
  count?: number;
}

function StatSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 animate-pulse">
      <div className="h-3 w-20 rounded bg-slate-800" />
      <div className="h-7 w-14 rounded bg-slate-800" />
      <div className="h-2.5 w-28 rounded bg-slate-800/60" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3 animate-pulse">
      <div className="h-4 w-32 rounded bg-slate-800" />
      <div className="h-3 w-full rounded bg-slate-800/60" />
      <div className="h-3 w-3/4 rounded bg-slate-800/60" />
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 animate-pulse">
      <div className="h-5 w-40 rounded bg-slate-800" />
      <div className="h-36 rounded-lg bg-slate-800/40" />
    </div>
  );
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="h-8 w-8 rounded-full bg-slate-800 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/5 rounded bg-slate-800" />
            <div className="h-2.5 w-2/5 rounded bg-slate-800/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardSectionSkeleton({
  variant,
  count = 3,
}: DashboardSectionSkeletonProps) {
  switch (variant) {
    case 'stat':
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="skeleton-stat">
          {Array.from({ length: count }).map((_, i) => (
            <StatSkeleton key={i} />
          ))}
        </div>
      );
    case 'card':
      return (
        <div className="space-y-3" data-testid="skeleton-card">
          {Array.from({ length: count }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      );
    case 'chart':
      return <ChartSkeleton />;
    case 'list':
      return <ListSkeleton count={count} />;
    default:
      return null;
  }
}
