import Link from 'next/link';
import { Globe, ArrowRight } from 'lucide-react';
import type { EntityHealthResult } from '@/lib/services/entity-health.service';

interface EntityHealthCardProps {
  entityHealth: EntityHealthResult | null;
}

function ratingColor(rating: EntityHealthResult['rating']): string {
  if (rating === 'strong') return 'text-green-400';
  if (rating === 'at_risk') return 'text-amber-400';
  if (rating === 'critical') return 'text-red-400';
  return 'text-slate-400';
}

function ratingLabel(rating: EntityHealthResult['rating']): string {
  if (rating === 'strong') return 'Strong';
  if (rating === 'at_risk') return 'At Risk';
  if (rating === 'critical') return 'Critical';
  return 'Unknown';
}

export default function EntityHealthCard({ entityHealth }: EntityHealthCardProps) {
  if (!entityHealth) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-signal-green" />
          <h3 className="text-sm font-semibold text-white">Entity Health</h3>
        </div>
        <p className="text-xs text-slate-400">
          Check your entity presence across AI knowledge platforms.
        </p>
      </div>
    );
  }

  const highPriorityCount = entityHealth.recommendations.filter(
    (r) => r.priority >= 7,
  ).length;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-4 w-4 text-signal-green" />
        <h3 className="text-sm font-semibold text-white">Entity Health</h3>
      </div>
      <p className="text-sm text-slate-300">
        <span className={ratingColor(entityHealth.rating)}>{entityHealth.score}%</span>
        {' · '}
        <span className={ratingColor(entityHealth.rating)}>{ratingLabel(entityHealth.rating)}</span>
        {' · '}
        {entityHealth.confirmedCount}/{entityHealth.totalPlatforms} platforms verified
      </p>
      {highPriorityCount > 0 && (
        <p className="mt-1 text-xs text-slate-400">
          {highPriorityCount} high-priority {highPriorityCount === 1 ? 'fix' : 'fixes'} available
        </p>
      )}
      <Link
        href="/dashboard/entity-health"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
      >
        View Entity Health <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
