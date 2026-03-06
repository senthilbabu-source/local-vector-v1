// ---------------------------------------------------------------------------
// PostImpactPanel — S17: Content → SOV Feedback Loop
//
// Wave 2, AI_RULES §217.
//
// Shows the before/after citation rate for a published draft that was
// created from a SOV gap (trigger_type='prompt_missing').
//
// Renders only when post_publish_rank is available (set by the SOV cron).
// Shows a neutral "waiting" state when pre is set but post is not yet available.
// ---------------------------------------------------------------------------

import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { rankToPercent, buildImpactLabel } from '@/lib/services/publish-rank.service';

interface PostImpactPanelProps {
  triggerType: string;
  prePublishRank: number | null;
  postPublishRank: number | null;
  /** The query text that links this draft to a target_query */
  targetPrompt: string | null;
}

export default function PostImpactPanel({
  triggerType,
  prePublishRank,
  postPublishRank,
  targetPrompt,
}: PostImpactPanelProps) {
  // Only show for SOV-linked drafts
  if (triggerType !== 'prompt_missing') return null;

  const prePct  = rankToPercent(prePublishRank);
  const postPct = rankToPercent(postPublishRank);

  // Not yet published / no rank data captured
  if (prePct === null && postPct === null) return null;

  const impact = buildImpactLabel(prePct, postPct);

  return (
    <div
      className="rounded-xl border border-white/10 bg-surface-dark p-5 space-y-3"
      data-testid="post-impact-panel"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-electric-indigo" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400"
           style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
          Post Publish Impact
        </p>
      </div>

      {targetPrompt && (
        <p className="text-sm text-slate-400">
          Tracking AI citation rate for: <span className="text-white font-medium">&ldquo;{targetPrompt}&rdquo;</span>
        </p>
      )}

      {/* Waiting for post-publish scan */}
      {postPct === null && prePct !== null && (
        <div className="flex items-center gap-2 rounded-lg border border-alert-amber/20 bg-alert-amber/5 px-4 py-3">
          <Clock className="h-4 w-4 text-alert-amber shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-alert-amber">Waiting for next AI scan</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Citation rate was {prePct}% before publishing. We&apos;ll compare after the next weekly scan.
            </p>
          </div>
        </div>
      )}

      {/* Before/After comparison */}
      {impact && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Before Publishing</p>
              <p className="text-2xl font-bold text-white">{prePct}%</p>
              <p className="text-[10px] text-slate-500 mt-0.5">cited by AI</p>
            </div>
            <div className={[
              'rounded-lg border px-4 py-3 text-center',
              impact.improved ? 'border-signal-green/20 bg-signal-green/5' : 'border-white/5 bg-white/[0.03]',
            ].join(' ')}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">After Publishing</p>
              <p className={['text-2xl font-bold', impact.improved ? 'text-signal-green' : 'text-white'].join(' ')}>
                {postPct}%
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">cited by AI</p>
            </div>
          </div>

          <div className={[
            'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm',
            impact.improved
              ? 'bg-signal-green/10 border border-signal-green/20 text-signal-green'
              : 'bg-white/[0.03] border border-white/5 text-slate-400',
          ].join(' ')}>
            {impact.improved ? (
              <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (prePct ?? 0) > (postPct ?? 0) ? (
              <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Minus className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{impact.label}</span>
          </div>
        </>
      )}
    </div>
  );
}
