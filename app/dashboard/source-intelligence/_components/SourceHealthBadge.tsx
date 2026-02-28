import type { SourceCategory } from '@/lib/services/source-intelligence.service';

// ---------------------------------------------------------------------------
// SourceHealthBadge — Sprint I
//
// Color-coded badge derived from source category and competitor flag.
// Used in TopSourcesTable rows to show at-a-glance source health.
// ---------------------------------------------------------------------------

export type SourceHealth =
  | 'first_party'
  | 'review_site'
  | 'directory'
  | 'competitor'
  | 'other';

const HEALTH_CONFIG: Record<
  SourceHealth,
  { label: string; className: string }
> = {
  first_party: {
    label: 'Your site',
    className:
      'bg-signal-green/10 text-signal-green ring-signal-green/20',
  },
  review_site: {
    label: 'Review site',
    className:
      'bg-electric-indigo/10 text-electric-indigo ring-electric-indigo/20',
  },
  directory: {
    label: 'Directory',
    className: 'bg-alert-amber/10 text-alert-amber ring-alert-amber/20',
  },
  competitor: {
    label: 'Competitor',
    className:
      'bg-alert-crimson/10 text-alert-crimson ring-alert-crimson/20',
  },
  other: {
    label: 'Other',
    className: 'bg-white/5 text-slate-400 ring-white/10',
  },
};

export function deriveSourceHealth(
  category: SourceCategory,
  isCompetitorAlert: boolean,
): SourceHealth {
  if (isCompetitorAlert || category === 'competitor') return 'competitor';
  if (category === 'first_party') return 'first_party';
  if (category === 'review_site') return 'review_site';
  if (category === 'directory') return 'directory';
  return 'other';
}

export function SourceHealthBadge({ health }: { health: SourceHealth }) {
  const config = HEALTH_CONFIG[health];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${config.className}`}
      data-testid={`source-health-badge-${health}`}
    >
      {config.label}
    </span>
  );
}
