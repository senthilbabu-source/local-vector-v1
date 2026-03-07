'use client';

import { Clock, CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';
import type { BeforeAfterStory, TimelineStep } from '@/lib/services/before-after';
import { formatDaysToFix } from '@/lib/services/before-after';

// ---------------------------------------------------------------------------
// S42: BeforeAfterTimeline — chronological story of fixed hallucinations
// Shown in Resolved swimlane on AI Mistakes page.
// ---------------------------------------------------------------------------

interface BeforeAfterTimelineProps {
  stories: BeforeAfterStory[];
}

const STEP_ICONS: Record<TimelineStep['type'], typeof Clock> = {
  detection: AlertTriangle,
  action: Clock,
  resolution: CheckCircle2,
};

const STEP_COLORS: Record<TimelineStep['type'], string> = {
  detection: 'text-red-400',
  action: 'text-amber-400',
  resolution: 'text-emerald-400',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function BeforeAfterTimeline({ stories }: BeforeAfterTimelineProps) {
  if (stories.length === 0) return null;

  return (
    <section data-testid="before-after-timeline" className="space-y-4">
      <h3 className="text-sm font-semibold text-white">Before & After</h3>
      <div className="space-y-4">
        {stories.map((story) => (
          <div
            key={story.hallucinationId}
            className="rounded-xl border border-white/5 bg-surface-dark px-4 py-3"
            data-testid="before-after-story"
          >
            {/* Steps */}
            <div className="space-y-2">
              {story.steps.map((step, i) => {
                const Icon = STEP_ICONS[step.type];
                const color = STEP_COLORS[step.type];
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`mt-0.5 shrink-0 ${color}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400">
                          {formatDate(step.date)}
                        </span>
                        <span className="text-xs font-semibold text-white">{step.event}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 truncate">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-2">
              <span className="text-xs text-slate-400">
                Fixed in {formatDaysToFix(story.daysToFix)}
              </span>
              {story.totalRecovered > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <DollarSign className="h-3 w-3" aria-hidden="true" />
                  ~${story.totalRecovered.toLocaleString()}/mo recovered
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
