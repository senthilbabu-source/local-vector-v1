import Link from 'next/link';
import { Bot, ArrowRight } from 'lucide-react';
import type { CrawlerSummary } from '@/lib/data/crawler-analytics';

interface BotActivityCardProps {
  crawlerSummary: CrawlerSummary | null;
  hasPublishedMenu: boolean;
}

export default function BotActivityCard({ crawlerSummary, hasPublishedMenu }: BotActivityCardProps) {
  // No data yet — show appropriate message
  if (!crawlerSummary || crawlerSummary.totalVisits === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="h-4 w-4 text-electric-indigo" />
          <h3 className="text-sm font-semibold text-white">AI Bot Activity (30d)</h3>
        </div>
        <p className="text-xs text-slate-400">
          {hasPublishedMenu
            ? 'No bot visits yet — check back in a few days.'
            : 'Publish your Magic Menu to start tracking AI bots.'}
        </p>
      </div>
    );
  }

  const activeBots = crawlerSummary.bots.filter((b) => b.status !== 'blind_spot').length;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-electric-indigo" />
        <h3 className="text-sm font-semibold text-white">AI Bot Activity (30d)</h3>
      </div>
      <p className="text-sm text-slate-300">
        <span className="font-mono font-bold text-white">{crawlerSummary.totalVisits}</span> visits
        {' · '}
        <span className="text-truth-emerald">{activeBots} active</span>
        {crawlerSummary.blindSpotCount > 0 && (
          <>
            {' · '}
            <span className="text-alert-amber">{crawlerSummary.blindSpotCount} blind {crawlerSummary.blindSpotCount === 1 ? 'spot' : 'spots'}</span>
          </>
        )}
      </p>
      <Link
        href="/dashboard/crawler-analytics"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
      >
        View Bot Activity <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
