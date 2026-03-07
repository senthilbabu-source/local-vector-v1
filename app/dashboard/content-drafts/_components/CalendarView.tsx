// ---------------------------------------------------------------------------
// S32: CalendarView — content calendar recommendations merged from /content-calendar
// ---------------------------------------------------------------------------

import { CalendarDays } from 'lucide-react';
import type {
  ContentCalendarResult,
  ContentRecommendation,
  RecommendationType,
  ActionVerb,
} from '@/lib/services/content-calendar.service';

const ACTION_COLORS: Record<ActionVerb, string> = {
  publish: 'bg-green-900/40 text-green-400',
  update: 'bg-amber-900/40 text-amber-400',
  create: 'bg-blue-900/40 text-blue-400',
};

const TYPE_LABELS: Record<RecommendationType, string> = {
  occasion: 'Occasion',
  sov_gap: 'Mention Gap',
  freshness_update: 'Outdated',
  competitor_gap: 'Competitor',
  hallucination_fix: 'AI Mistake',
};

const BUCKET_LABELS: Record<string, string> = {
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  twoWeeks: 'In 2 Weeks',
  later: 'Later',
};

function urgencyBarColor(urgency: number): string {
  if (urgency >= 75) return 'bg-red-500';
  if (urgency >= 50) return 'bg-amber-500';
  return 'bg-green-500';
}

interface CalendarViewProps {
  calendar: ContentCalendarResult;
}

export default function CalendarView({ calendar }: CalendarViewProps) {
  if (calendar.totalCount === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-dark px-6 py-10 text-center" data-testid="calendar-empty">
        <CalendarDays className="mx-auto h-10 w-10 text-slate-500" />
        <p className="mt-3 text-sm font-medium text-slate-400">No content recommendations right now</p>
        <p className="mt-1 text-xs text-slate-400">
          Recommendations appear when LocalVector detects content opportunities from AI mentions, competitors, or upcoming occasions.
        </p>
      </div>
    );
  }

  const buckets = [
    { key: 'thisWeek', items: calendar.thisWeek },
    { key: 'nextWeek', items: calendar.nextWeek },
    { key: 'twoWeeks', items: calendar.twoWeeks },
    { key: 'later', items: calendar.later },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="space-y-6" data-testid="calendar-view">
      {/* Signal summary strip */}
      <div className="flex flex-wrap gap-3" data-testid="signal-summary">
        {calendar.signalSummary.occasionCount > 0 && (
          <SignalChip label="Occasions" count={calendar.signalSummary.occasionCount} />
        )}
        {calendar.signalSummary.sovGapCount > 0 && (
          <SignalChip label="Mention Gaps" count={calendar.signalSummary.sovGapCount} />
        )}
        {calendar.signalSummary.freshnessCount > 0 && (
          <SignalChip label="Outdated Pages" count={calendar.signalSummary.freshnessCount} />
        )}
        {calendar.signalSummary.competitorGapCount > 0 && (
          <SignalChip label="Competitor Advantages" count={calendar.signalSummary.competitorGapCount} />
        )}
        {calendar.signalSummary.hallucinationFixCount > 0 && (
          <SignalChip label="AI Mistakes to Fix" count={calendar.signalSummary.hallucinationFixCount} />
        )}
      </div>

      {/* Time-bucketed recommendations */}
      {buckets.map(({ key, items }) => (
        <div key={key}>
          <h3 className="text-sm font-semibold text-white mb-3">{BUCKET_LABELS[key]}</h3>
          <div className="space-y-2">
            {items.map((rec) => (
              <RecommendationRow key={rec.key} rec={rec} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalChip({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold font-mono text-white">{count}</p>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: ContentRecommendation }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[rec.action]}`}>
              {rec.action}
            </span>
            <span className="text-xs text-slate-400">{TYPE_LABELS[rec.type]}</span>
          </div>
          <p className="text-sm font-medium text-white">{rec.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{rec.reason}</p>
        </div>
        <div className="shrink-0 w-16">
          <div className="h-1.5 rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${urgencyBarColor(rec.urgency)}`}
              style={{ width: `${rec.urgency}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1 text-center">{rec.urgency}%</p>
        </div>
      </div>
    </div>
  );
}
