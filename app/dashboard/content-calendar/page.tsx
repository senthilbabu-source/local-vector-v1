import { redirect } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchContentCalendar } from '@/lib/data/content-calendar';
import type {
  ContentRecommendation,
  ContentCalendarResult,
  RecommendationType,
  ActionVerb,
} from '@/lib/services/content-calendar.service';

// ── Constants ─────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<ActionVerb, string> = {
  publish: 'bg-green-900/40 text-green-400',
  update: 'bg-amber-900/40 text-amber-400',
  create: 'bg-blue-900/40 text-blue-400',
};

const TYPE_EMOJI: Record<RecommendationType, string> = {
  occasion: '🎉',
  sov_gap: '📉',
  freshness_update: '🔄',
  competitor_gap: '⚔️',
  hallucination_fix: '🔴',
};

const BUCKET_LABELS: Record<string, string> = {
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  twoWeeks: 'In 2 Weeks',
  later: 'Later',
};

// ── Urgency bar color ─────────────────────────────────────────────────────

function urgencyBarColor(urgency: number): string {
  if (urgency >= 75) return 'bg-red-500';
  if (urgency >= 50) return 'bg-amber-500';
  return 'bg-green-500';
}

// ── Sub-Components ────────────────────────────────────────────────────────

function SignalSummaryStrip({
  summary,
}: {
  summary: ContentCalendarResult['signalSummary'];
}) {
  const signals = [
    { label: 'Occasions', count: summary.occasionCount, emoji: '🎉' },
    { label: 'SOV Gaps', count: summary.sovGapCount, emoji: '📉' },
    { label: 'Stale Pages', count: summary.freshnessCount, emoji: '🔄' },
    {
      label: 'Competitor Gaps',
      count: summary.competitorGapCount,
      emoji: '⚔️',
    },
    {
      label: 'Hallucination Fixes',
      count: summary.hallucinationFixCount,
      emoji: '🔴',
    },
  ].filter((s) => s.count > 0);

  if (signals.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-3"
      data-testid="signal-summary"
    >
      {signals.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3"
        >
          <p className="text-xs text-slate-500">{s.label}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-white">
            <span role="img" aria-label={s.label}>
              {s.emoji}
            </span>
            <span className="font-mono">{s.count}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: ContentRecommendation }) {
  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark px-5 py-4 space-y-3"
      data-testid="recommendation-card"
    >
      {/* Header: action badge + title */}
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${ACTION_COLORS[rec.action]}`}
          data-testid="action-badge"
        >
          {rec.action}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{rec.title}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            <span role="img" aria-label={rec.type}>
              {TYPE_EMOJI[rec.type]}
            </span>{' '}
            {rec.reason}
          </p>
        </div>
        {rec.daysUntilDeadline !== null && (
          <span
            className="shrink-0 rounded-md bg-alert-crimson/10 px-2 py-0.5 text-xs font-semibold text-alert-crimson"
            data-testid="deadline-badge"
          >
            {rec.daysUntilDeadline}d left
          </span>
        )}
      </div>

      {/* Urgency bar */}
      <div className="space-y-1" data-testid="urgency-bar">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            Urgency
          </span>
          <span className="font-mono text-xs text-slate-400">
            {rec.urgency}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/5">
          <div
            className={`h-1.5 rounded-full ${urgencyBarColor(rec.urgency)} transition-all`}
            style={{ width: `${rec.urgency}%` }}
          />
        </div>
      </div>

      {/* CTAs */}
      {rec.ctas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rec.ctas.map((cta) => (
            <a
              key={cta.href}
              href={cta.href}
              className="rounded-lg bg-electric-indigo/15 px-3 py-1.5 text-xs font-semibold text-electric-indigo hover:bg-electric-indigo/25 transition"
            >
              {cta.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeBucketSection({
  label,
  recommendations,
}: {
  label: string;
  recommendations: ContentRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3" data-testid={`bucket-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </h2>
      {recommendations.map((rec) => (
        <RecommendationCard key={rec.key} rec={rec} />
      ))}
    </div>
  );
}

// ── Page Component ────────────────────────────────────────────────────────

export default async function ContentCalendarPage() {
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
          Content Calendar
        </h1>
        <div className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center">
          <p className="text-sm text-slate-400">
            No primary location found. Complete onboarding to get started.
          </p>
        </div>
      </div>
    );
  }

  const result = await fetchContentCalendar(supabase, ctx.orgId, location.id);

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-signal-green" />
          Content Calendar
        </h1>
        <p className="mt-0.5 text-sm text-slate-400">
          AI-recommended publishing schedule based on your data signals.
        </p>
      </div>

      {/* ── Signal Summary ──────────────────────────────────── */}
      <SignalSummaryStrip summary={result.signalSummary} />

      {/* ── Time Buckets ────────────────────────────────────── */}
      {result.totalCount === 0 ? (
        <div
          className="rounded-xl border border-white/5 bg-surface-dark px-5 py-8 text-center"
          data-testid="empty-state"
        >
          <p className="text-sm text-slate-400">
            No content recommendations right now. LocalVector will generate
            recommendations when it detects upcoming occasions, SOV gaps, stale
            pages, competitor opportunities, or hallucinations that need
            correction. Run your first SOV queries and page audits to unlock
            data-driven recommendations.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <TimeBucketSection
            label={BUCKET_LABELS.thisWeek!}
            recommendations={result.thisWeek}
          />
          <TimeBucketSection
            label={BUCKET_LABELS.nextWeek!}
            recommendations={result.nextWeek}
          />
          <TimeBucketSection
            label={BUCKET_LABELS.twoWeeks!}
            recommendations={result.twoWeeks}
          />
          <TimeBucketSection
            label={BUCKET_LABELS.later!}
            recommendations={result.later}
          />
        </div>
      )}
    </div>
  );
}
