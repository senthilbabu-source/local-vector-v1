import { redirect } from 'next/navigation';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchProofTimeline } from '@/lib/data/proof-timeline';
import { TrendingUp, ArrowUpRight, ArrowDownRight, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import type { TimelineEvent } from '@/lib/services/proof-timeline.service';

// ── Impact color helpers (literal Tailwind classes — AI_RULES §12) ──────

function impactTextColor(impact: TimelineEvent['impact']): string {
  if (impact === 'positive') return 'text-green-400';
  if (impact === 'negative') return 'text-red-400';
  if (impact === 'milestone') return 'text-indigo-400';
  return 'text-slate-400';
}

function impactBorderColor(impact: TimelineEvent['impact']): string {
  if (impact === 'positive') return 'border-green-400/30';
  if (impact === 'negative') return 'border-red-400/30';
  if (impact === 'milestone') return 'border-indigo-400/30';
  return 'border-white/5';
}

// ── Date formatting helper ──────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function groupEventsByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const dateKey = event.date.split('T')[0];
    const existing = groups.get(dateKey!) ?? [];
    existing.push(event);
    groups.set(dateKey!, existing);
  }
  return groups;
}

// ── Page Component ──────────────────────────────────────────────────────

export default async function ProofTimelinePage() {
  const ctx = await getSafeAuthContext();
  if (!ctx) redirect('/login');
  if (!ctx.orgId) redirect('/login');

  const supabase = await createClient();

  // Get primary location
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-white tracking-tight">
          Before / After — Your AI Visibility Journey
        </h1>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No primary location found. Complete onboarding to get started.
          </p>
        </div>
      </div>
    );
  }

  const timeline = await fetchProofTimeline(supabase, ctx.orgId, location.id);
  const { events, summary } = timeline;

  // Reverse chronological for display
  const reversedEvents = [...events].reverse();
  const grouped = groupEventsByDate(reversedEvents);

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-signal-green" />
          Before / After — Your AI Visibility Journey
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          See how your actions correlate with measurable visibility improvements.
        </p>
      </div>

      {/* ── Summary Strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* SOV Delta */}
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">SOV Change</p>
          {summary.sovDelta !== null ? (
            <div className="mt-1 flex items-center gap-1">
              {summary.sovDelta >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-400" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-400" />
              )}
              <span
                className={`text-lg font-bold ${summary.sovDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {summary.sovDelta >= 0 ? '+' : ''}
                {summary.sovDelta.toFixed(0)}%
              </span>
            </div>
          ) : (
            <p className="mt-1 text-lg font-bold text-slate-500">—</p>
          )}
        </div>

        {/* Actions Completed */}
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">Actions Done</p>
          <div className="mt-1 flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-lg font-bold text-white">
              {summary.actionsCompleted}
            </span>
          </div>
        </div>

        {/* Issues Fixed */}
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">Issues Fixed</p>
          <div className="mt-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4 text-alert-amber" />
            <span className="text-lg font-bold text-white">
              {summary.hallucinationsResolved}
            </span>
          </div>
        </div>

        {/* Timeline Window */}
        <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
          <p className="text-xs font-medium text-slate-400">Timeline</p>
          <div className="mt-1 flex items-center gap-1">
            <Clock className="h-4 w-4 text-electric-indigo" />
            <span className="text-sm font-semibold text-white">90 days</span>
          </div>
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────── */}
      {events.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            Your timeline will fill up as LocalVector monitors your AI visibility.
            Check back after your first weekly SOV snapshot.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([dateKey, dateEvents]) => (
              <div key={dateKey} className="relative">
                {/* Date header */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-midnight-slate border border-white/10">
                    <span className="text-[10px] font-bold text-white leading-none">
                      {formatDateLabel(dateKey)}
                    </span>
                  </div>
                </div>

                {/* Events for this date */}
                <div className="ml-12 space-y-2">
                  {dateEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`rounded-lg border ${impactBorderColor(event.impact)} bg-surface-dark px-4 py-3`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5" role="img" aria-label={event.type}>
                          {event.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold ${impactTextColor(event.impact)}`}>
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {event.description}
                          </p>
                          {event.metrics?.sovPercent !== undefined && (
                            <p className="mt-1 text-xs text-slate-500">
                              SOV: {event.metrics.sovPercent.toFixed(0)}%
                              {event.metrics.pageAuditScore !== undefined &&
                                ` · Audit: ${event.metrics.pageAuditScore}/100`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
