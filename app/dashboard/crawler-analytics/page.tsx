import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchCrawlerAnalytics } from '@/lib/data/crawler-analytics';
import type { BotActivity, BlindSpot } from '@/lib/data/crawler-analytics';
import { Bot, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default async function CrawlerAnalyticsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');

  const supabase = await createClient();
  const summary = await fetchCrawlerAnalytics(supabase, ctx.orgId ?? '');

  const activeBots = summary.bots.filter((b) => b.status === 'active').length;

  // Null state — no visits at all
  if (summary.totalVisits === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">AI Bot Activity</h1>
          <p className="mt-0.5 text-sm text-slate-400">Last 30 days</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-electric-indigo/10">
            <Bot className="h-6 w-6 text-electric-indigo" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">No bot visits recorded yet</h2>
          <p className="mt-2 max-w-md mx-auto text-sm text-slate-400">
            AI crawlers will be automatically detected when they visit your published Magic Menu page.
          </p>
          <div className="mt-4 space-y-1 text-sm text-slate-500">
            <p>Make sure your Magic Menu is published to start tracking.</p>
            <p>Check back in a few days — AI bots crawl new pages weekly.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">AI Bot Activity</h1>
        <p className="mt-0.5 text-sm text-slate-400">Last 30 days</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">Total visits</p>
          <p className="mt-1 text-2xl font-bold font-mono text-white">{summary.totalVisits}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">Active bots</p>
          <p className="mt-1 text-2xl font-bold font-mono text-truth-emerald">
            {activeBots + summary.bots.filter((b) => b.status === 'low').length}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">Blind spots</p>
          <p className={`mt-1 text-2xl font-bold font-mono ${summary.blindSpotCount > 0 ? 'text-alert-amber' : 'text-truth-emerald'}`}>
            {summary.blindSpotCount}
          </p>
        </div>
      </div>

      {/* Bot activity list */}
      <div className="rounded-xl border border-white/5 bg-surface-dark">
        <div className="border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Bot Activity</h2>
        </div>
        <div className="divide-y divide-white/5">
          {summary.bots.map((bot) => (
            <BotRow key={bot.botType} bot={bot} />
          ))}
        </div>
      </div>

      {/* Blind spots */}
      {summary.blindSpotCount > 0 && (
        <div className="rounded-xl border border-alert-amber/20 bg-alert-amber/5">
          <div className="px-4 py-3 border-b border-alert-amber/10">
            <h2 className="text-sm font-semibold text-alert-amber flex items-center gap-2">
              <EyeOff className="h-4 w-4" />
              {summary.blindSpotCount} Blind {summary.blindSpotCount === 1 ? 'Spot' : 'Spots'} Detected
            </h2>
          </div>
          <div className="divide-y divide-alert-amber/10">
            {summary.blindSpots.map((spot) => (
              <BlindSpotRow key={spot.botType} spot={spot} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BotRow({ bot }: { bot: BotActivity }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <StatusIcon status={bot.status} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{bot.label}</p>
          <p className="text-xs text-slate-500">{bot.engine}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <p className="text-sm font-mono text-slate-300">
          {bot.visitCount} {bot.visitCount === 1 ? 'visit' : 'visits'}
        </p>
        <StatusBadge status={bot.status} engine={bot.engine} />
      </div>
    </div>
  );
}

function BlindSpotRow({ spot }: { spot: BlindSpot }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <EyeOff className="h-3.5 w-3.5 text-alert-crimson shrink-0" />
        <p className="text-sm font-medium text-white">
          {spot.label} <span className="text-slate-500">— {spot.engine} can&apos;t see your content</span>
        </p>
      </div>
      <p className="mt-1 ml-5.5 text-xs text-slate-400 flex items-start gap-1">
        <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-signal-green" />
        {spot.fixRecommendation}
      </p>
    </div>
  );
}

function StatusIcon({ status }: { status: BotActivity['status'] }) {
  if (status === 'active') {
    return <Eye className="h-4 w-4 text-truth-emerald shrink-0" />;
  }
  if (status === 'low') {
    return <Eye className="h-4 w-4 text-alert-amber shrink-0" />;
  }
  return <EyeOff className="h-4 w-4 text-alert-crimson shrink-0" />;
}

function StatusBadge({ status, engine }: { status: BotActivity['status']; engine: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center rounded-md bg-truth-emerald/10 px-2 py-0.5 text-xs font-medium text-truth-emerald">
        {engine} knows you
      </span>
    );
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center rounded-md bg-alert-amber/10 px-2 py-0.5 text-xs font-medium text-alert-amber">
        Low activity
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-alert-crimson/10 px-2 py-0.5 text-xs font-medium text-alert-crimson">
      Blind spot
    </span>
  );
}
