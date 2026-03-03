// ---------------------------------------------------------------------------
// app/dashboard/loading.tsx — P5-FIX-24: Dashboard loading skeleton
//
// Renders immediately during route transitions while async data loads.
// Uses CSS animations only (no JS) for minimal bundle impact.
// ---------------------------------------------------------------------------

export default function DashboardLoading() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-pulse" data-testid="dashboard-loading">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-slate-800" />
        <div className="h-4 w-72 rounded bg-slate-800/60" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-slate-800" />
            <div className="h-8 w-16 rounded bg-slate-800" />
            <div className="h-3 w-32 rounded bg-slate-800/60" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="h-5 w-40 rounded bg-slate-800" />
        <div className="h-48 rounded-lg bg-slate-800/40" />
      </div>
    </div>
  );
}
