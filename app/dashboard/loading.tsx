// ---------------------------------------------------------------------------
// app/dashboard/loading.tsx — P5-FIX-24 + S63: Dashboard loading skeleton
//
// Renders immediately during route transitions while async data loads.
// Uses DashboardSectionSkeleton (CSS-only, no JS) for consistent skeletons.
// ---------------------------------------------------------------------------

import DashboardSectionSkeleton from './_components/DashboardSectionSkeleton';

export default function DashboardLoading() {
  return (
    <div className="flex-1 space-y-6 p-6" data-testid="dashboard-loading">
      {/* Header skeleton */}
      <div className="space-y-2 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-slate-800" />
        <div className="h-4 w-72 rounded bg-slate-800/60" />
      </div>

      {/* KPI chips skeleton */}
      <DashboardSectionSkeleton variant="stat" count={5} />

      {/* Chart skeleton */}
      <DashboardSectionSkeleton variant="chart" />

      {/* Issues list skeleton */}
      <DashboardSectionSkeleton variant="list" count={3} />
    </div>
  );
}
