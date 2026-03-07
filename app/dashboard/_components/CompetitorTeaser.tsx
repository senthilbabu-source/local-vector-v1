'use client';

import { Swords, Lock } from 'lucide-react';
import type { CompetitorMentionData } from '@/lib/services/competitor-teaser';
import { formatCompetitorInsight } from '@/lib/services/competitor-teaser';

// ---------------------------------------------------------------------------
// S37: CompetitorTeaser — top competitor mention on dashboard
// Growth+ shows insight; Trial/Starter shows upgrade CTA.
// Hidden when no data or in sample mode.
// ---------------------------------------------------------------------------

interface CompetitorTeaserProps {
  data: CompetitorMentionData | null;
  sampleMode: boolean;
  planTier: string;
}

export default function CompetitorTeaser({ data, sampleMode, planTier }: CompetitorTeaserProps) {
  if (sampleMode) return null;

  const isGrowthPlus = planTier === 'growth' || planTier === 'agency';

  // No data and no reason to show upgrade CTA
  if (!data && isGrowthPlus) return null;

  // Upgrade CTA for Trial/Starter
  if (!isGrowthPlus) {
    return (
      <section
        className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4"
        data-testid="competitor-teaser"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Lock className="h-4 w-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">See who&apos;s beating you in AI</p>
            <p className="text-xs text-slate-400">
              Upgrade to see which competitors AI mentions more than you.
            </p>
          </div>
          <a
            href="/dashboard/billing"
            className="shrink-0 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
            data-testid="competitor-teaser-upgrade"
          >
            Upgrade
          </a>
        </div>
      </section>
    );
  }

  // Growth+ with no data
  if (!data || data.theirMentions === 0) return null;

  const insight = formatCompetitorInsight(data);

  return (
    <section
      className="rounded-2xl bg-surface-dark border border-white/5 px-5 py-4"
      data-testid="competitor-teaser"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
          <Swords className="h-4 w-4 text-red-400" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{insight}</p>
        </div>
        <a
          href="/dashboard/compete"
          className="shrink-0 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
          data-testid="competitor-teaser-link"
        >
          View competitors &rarr;
        </a>
      </div>
    </section>
  );
}
