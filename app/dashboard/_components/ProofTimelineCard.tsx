import Link from 'next/link';
import { TrendingUp, ArrowRight } from 'lucide-react';
import type { ProofTimeline } from '@/lib/services/proof-timeline.service';

interface ProofTimelineCardProps {
  timeline: ProofTimeline | null;
}

export default function ProofTimelineCard({ timeline }: ProofTimelineCardProps) {
  // No data — show starter message
  if (!timeline || timeline.events.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-signal-green" />
          <h3 className="text-sm font-semibold text-white">Your Progress (Last 90 Days)</h3>
        </div>
        <p className="text-xs text-slate-400">
          Your timeline is starting — check back next week.
        </p>
      </div>
    );
  }

  const { summary, events } = timeline;

  // Build summary line
  const parts: string[] = [];
  if (summary.sovDelta !== null) {
    parts.push(`SOV: ${summary.sovDelta >= 0 ? '+' : ''}${summary.sovDelta.toFixed(0)}%`);
  }
  if (summary.actionsCompleted > 0) {
    parts.push(`${summary.actionsCompleted} ${summary.actionsCompleted === 1 ? 'action' : 'actions'}`);
  }
  if (summary.hallucinationsResolved > 0) {
    parts.push(`${summary.hallucinationsResolved} ${summary.hallucinationsResolved === 1 ? 'issue' : 'issues'} fixed`);
  }

  // Find most impactful event (milestones first, then positive)
  const highlight =
    events.find((e) => e.impact === 'milestone') ??
    events.find((e) => e.impact === 'positive');

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-signal-green" />
        <h3 className="text-sm font-semibold text-white">Your Progress (Last 90 Days)</h3>
      </div>
      <p className="text-sm text-slate-300">
        {parts.length > 0 ? parts.join(' · ') : 'Monitoring your AI visibility...'}
      </p>
      {highlight && (
        <p className="mt-1 text-xs text-slate-400">
          {highlight.icon} {highlight.title}
        </p>
      )}
      <Link
        href="/dashboard/proof-timeline"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-electric-indigo hover:text-electric-indigo/80 transition"
      >
        View Full Timeline <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
