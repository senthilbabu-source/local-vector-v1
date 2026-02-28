// ---------------------------------------------------------------------------
// OccasionTimeline — Sprint 61A: Upcoming Occasions section
//
// Displays upcoming occasions as a horizontal scrollable card row above the
// draft list on the content-drafts page. Each card shows the occasion name,
// countdown badge, type badge, and a "Create Draft" or "Draft exists" action.
//
// Client component for collapsible interaction.
// ---------------------------------------------------------------------------

'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Calendar, Sparkles } from 'lucide-react';
import { createManualDraft } from '../actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OccasionWithCountdown {
  id: string;
  name: string;
  occasion_type: string;
  daysUntilPeak: number;
  relevant_categories: string[];
}

interface OccasionTimelineProps {
  occasions: OccasionWithCountdown[];
  existingDraftsByOccasionId: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countdownColor(days: number): string {
  if (days <= 7) return 'bg-alert-crimson/20 text-alert-crimson';
  if (days <= 14) return 'bg-alert-amber/20 text-alert-amber';
  return 'bg-slate-400/10 text-slate-400';
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'holiday': return 'bg-electric-indigo/20 text-electric-indigo';
    case 'celebration': return 'bg-signal-green/20 text-signal-green';
    case 'seasonal': return 'bg-alert-amber/20 text-alert-amber';
    case 'recurring': return 'bg-slate-400/10 text-slate-400';
    default: return 'bg-slate-400/10 text-slate-400';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OccasionTimeline({
  occasions,
  existingDraftsByOccasionId,
}: OccasionTimelineProps) {
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  // Sprint O (L3): Track which occasion just had a draft created for success CTA
  const [justCreatedFor, setJustCreatedFor] = useState<string | null>(null);

  if (occasions.length === 0) return null;

  function handleCreateDraft(occasion: OccasionWithCountdown) {
    setCreatingFor(occasion.id);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('draft_title', `${occasion.name} — Content Draft`);
      formData.set('draft_content', `AI-generated content brief for ${occasion.name}. This occasion is ${occasion.daysUntilPeak} days away. Edit this draft with your specific business details.`);
      formData.set('content_type', 'occasion_page');
      formData.set('trigger_type', 'occasion');
      formData.set('trigger_id', occasion.id);
      await createManualDraft(formData);
      setCreatingFor(null);
      setJustCreatedFor(occasion.id);
    });
  }

  return (
    <div className="rounded-xl bg-surface-dark ring-1 ring-white/5">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-electric-indigo" />
          <h2 className="text-sm font-semibold text-white">
            Upcoming Occasions
          </h2>
          <span className="rounded-full bg-electric-indigo/20 px-2 py-0.5 text-xs font-medium text-electric-indigo">
            {occasions.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>

      {/* Card row */}
      {expanded && (
        <div className="flex gap-3 overflow-x-auto px-5 pb-4">
          {occasions.map((occasion) => {
            const hasDraft = !!existingDraftsByOccasionId[occasion.id];
            const isCreating = creatingFor === occasion.id && isPending;

            return (
              <div
                key={occasion.id}
                className="flex min-w-[240px] flex-col gap-2.5 rounded-xl bg-midnight-slate p-4 ring-1 ring-white/5"
              >
                {/* Occasion name */}
                <p className="text-sm font-semibold text-white">
                  {occasion.name}
                </p>

                {/* Badges row */}
                <div className="flex flex-wrap gap-1.5">
                  {/* Countdown */}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${countdownColor(occasion.daysUntilPeak)}`}
                  >
                    {occasion.daysUntilPeak} days
                  </span>
                  {/* Type */}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeColor(occasion.occasion_type)}`}
                  >
                    {occasion.occasion_type}
                  </span>
                </div>

                {/* Categories */}
                {occasion.relevant_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {occasion.relevant_categories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action */}
                {justCreatedFor === occasion.id ? (
                  <div
                    className="mt-auto rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 space-y-1"
                    data-testid="calendar-generation-success"
                  >
                    <p className="text-xs text-emerald-400">
                      Draft created for <span className="font-semibold">{occasion.name}</span>
                    </p>
                    <Link
                      href={`/dashboard/content-drafts?from=calendar&occasion=${encodeURIComponent(occasion.name)}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 underline"
                      data-testid="view-draft-link"
                    >
                      View draft &rarr;
                    </Link>
                  </div>
                ) : hasDraft ? (
                  <Link
                    href="/dashboard/content-drafts?status=draft"
                    className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-signal-green hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    Draft exists
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCreateDraft(occasion)}
                    disabled={isCreating}
                    className="mt-auto rounded-lg bg-electric-indigo/10 px-3 py-1.5 text-xs font-semibold text-electric-indigo ring-1 ring-inset ring-electric-indigo/20 transition hover:bg-electric-indigo/20 disabled:opacity-50"
                  >
                    {isCreating ? 'Creating…' : 'Create Draft'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
