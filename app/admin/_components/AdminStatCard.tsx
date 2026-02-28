/**
 * AdminStatCard — reusable stat display for admin pages. Sprint D (L1).
 */
export default function AdminStatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: 'warning' | 'danger';
}) {
  const valueColor =
    highlight === 'danger'
      ? 'text-red-400'
      : highlight === 'warning'
        ? 'text-amber-400'
        : 'text-white';

  return (
    <div className="rounded-lg border border-white/10 bg-surface-dark p-4" data-testid="admin-stat-card">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}
