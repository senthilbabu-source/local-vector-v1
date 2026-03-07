// ---------------------------------------------------------------------------
// S34: CrawlerSummaryCard — Bot activity summary merged from Crawler Analytics
// Anchored at #bots for redirect from /dashboard/crawler-analytics
// ---------------------------------------------------------------------------

import { Bot, Eye, EyeOff } from 'lucide-react';
import type { CrawlerSummary } from '@/lib/data/crawler-analytics';

interface CrawlerSummaryCardProps {
  summary: CrawlerSummary;
}

export default function CrawlerSummaryCard({ summary }: CrawlerSummaryCardProps) {
  const activeBots = summary.bots.filter((b) => b.status === 'active');
  const lowBots = summary.bots.filter((b) => b.status === 'low');
  const blindSpots = summary.bots.filter((b) => b.status === 'blind_spot');

  return (
    <section id="bots" className="mt-6 scroll-mt-20" data-testid="crawler-summary-card">
      <h2 className="text-sm font-semibold text-white tracking-tight mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-electric-indigo" />
        Bot Activity
        <span className="text-xs font-medium text-slate-400">Last 30 days</span>
      </h2>

      {summary.totalVisits === 0 ? (
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <Bot className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-2 text-sm text-slate-400">
            No bot visits recorded yet. AI crawlers will be detected when they visit your published pages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
              <p className="text-xs font-medium text-slate-400">Total visits</p>
              <p className="mt-1 text-2xl font-bold font-mono text-white">{summary.totalVisits}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
              <p className="text-xs font-medium text-slate-400">Active bots</p>
              <p className="mt-1 text-2xl font-bold font-mono text-truth-emerald">
                {activeBots.length + lowBots.length}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
              <p className="text-xs font-medium text-slate-400">Blind spots</p>
              <p className={`mt-1 text-2xl font-bold font-mono ${blindSpots.length > 0 ? 'text-alert-amber' : 'text-truth-emerald'}`}>
                {blindSpots.length}
              </p>
            </div>
          </div>

          {/* Top bots list */}
          <div className="rounded-xl border border-white/5 bg-surface-dark divide-y divide-white/5">
            {summary.bots.slice(0, 5).map((bot) => (
              <div key={bot.botType} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {bot.status === 'blind_spot' ? (
                    <EyeOff className="h-4 w-4 text-alert-amber shrink-0" />
                  ) : (
                    <Eye className="h-4 w-4 text-truth-emerald shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{bot.label}</p>
                    <p className="text-xs text-slate-400">{bot.engine}</p>
                  </div>
                </div>
                <span className="text-sm font-mono text-slate-300 shrink-0">
                  {bot.visitCount} visit{bot.visitCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>

          {/* Blind spot warnings */}
          {summary.blindSpots.length > 0 && (
            <div className="rounded-xl border border-alert-amber/10 bg-alert-amber/5 px-4 py-3">
              <p className="text-xs font-semibold text-alert-amber mb-2">
                {summary.blindSpots.length} AI bot{summary.blindSpots.length === 1 ? '' : 's'} haven't visited your site
              </p>
              <ul className="space-y-1">
                {summary.blindSpots.slice(0, 3).map((bs) => (
                  <li key={bs.botType} className="text-xs text-slate-400">
                    <span className="text-white font-medium">{bs.label}</span> — {bs.fixRecommendation}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
