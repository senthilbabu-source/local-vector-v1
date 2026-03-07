'use client';

import { useState, useTransition } from 'react';
import { Star, CheckCircle, RefreshCw, SkipForward, Send } from 'lucide-react';
import {
  approveReviewResponse,
  publishReviewResponse,
  regenerateResponse,
  skipResponse,
} from '../actions';
import SuggestResponseButton from './SuggestResponseButton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewRow {
  id: string;
  platform: string;
  reviewer_name: string;
  reviewer_photo_url?: string | null;
  rating: number;
  text: string;
  published_at: string;
  response_draft?: string | null;
  response_status: string;
  response_published_at?: string | null;
  keywords?: string[] | null;
}

interface ReviewCardProps {
  review: ReviewRow;
  showEntityBadge: boolean;
}

// ---------------------------------------------------------------------------
// Status styles
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  pending_draft: 'bg-slate-500/15 text-slate-400 ring-slate-500/20',
  draft_ready: 'bg-alert-amber/15 text-alert-amber ring-alert-amber/20',
  pending_approval: 'bg-alert-amber/15 text-alert-amber ring-alert-amber/20',
  approved: 'bg-blue-500/15 text-blue-400 ring-blue-600/20',
  published: 'bg-truth-emerald/15 text-truth-emerald ring-truth-emerald/20',
  skipped: 'bg-slate-500/15 text-slate-400 ring-slate-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending_draft: 'Generating…',
  draft_ready: 'Draft Ready',
  pending_approval: 'Needs Approval',
  approved: 'Approved',
  published: 'Published',
  skipped: 'Skipped',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewCard({ review, showEntityBadge }: ReviewCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(action: (id: string) => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(review.id);
      if (!result.success && 'error' in result) {
        setError(result.error ?? 'Action failed');
      }
    });
  }

  const canApprove = ['draft_ready', 'pending_approval'].includes(review.response_status);
  const canPublish = review.response_status === 'approved';
  const canRegenerate = ['draft_ready', 'pending_approval', 'pending_draft'].includes(review.response_status);
  const canSkip = !['published', 'skipped'].includes(review.response_status);

  return (
    <div
      className="rounded-xl bg-surface-dark p-5 ring-1 ring-white/5"
      data-testid={`review-card-${review.id}`}
    >
      {/* Review header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Star rating */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
                  i < review.rating ? 'fill-alert-amber text-alert-amber' : 'text-slate-500'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-white">{review.reviewer_name}</span>
          <span className="text-xs text-slate-400">
            {new Date(review.published_at).toLocaleDateString()}
          </span>
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-400">
            {review.platform}
          </span>
        </div>

        {/* Status badge */}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[review.response_status] ?? STATUS_STYLES.pending_draft}`}
        >
          {STATUS_LABELS[review.response_status] ?? review.response_status}
        </span>
      </div>

      {/* Review text */}
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        &ldquo;{review.text}&rdquo;
      </p>

      {/* Response draft */}
      {review.response_draft && (
        <div className="mt-4 rounded-lg bg-white/[0.03] p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-400">Response Draft</span>
            {showEntityBadge && (
              <span
                className="inline-flex items-center rounded-full bg-alert-amber/15 px-2 py-0.5 text-[10px] font-semibold text-alert-amber ring-1 ring-inset ring-alert-amber/20"
                data-testid="entity-badge"
              >
                AI-Enhanced
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-slate-200">
            {review.response_draft}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-xs text-alert-crimson">{error}</p>
      )}

      {/* S45: Suggest Response for negative reviews without a draft */}
      {!review.response_draft && (
        <SuggestResponseButton
          reviewId={review.id}
          rating={review.rating}
          reviewText={review.text}
          businessName=""
        />
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canApprove && (
          <button
            onClick={() => handleAction(approveReviewResponse)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-truth-emerald/15 px-3 py-1.5 text-xs font-medium text-truth-emerald hover:bg-truth-emerald/25 transition disabled:opacity-50"
            data-testid={`approve-btn-${review.id}`}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Approve
          </button>
        )}

        {canPublish && (
          <button
            onClick={() => handleAction(publishReviewResponse)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-electric-indigo/15 px-3 py-1.5 text-xs font-medium text-electric-indigo hover:bg-electric-indigo/25 transition disabled:opacity-50"
            data-testid={`publish-btn-${review.id}`}
          >
            <Send className="h-3.5 w-3.5" />
            Publish
          </button>
        )}

        {canRegenerate && (
          <button
            onClick={() => handleAction(regenerateResponse)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        )}

        {canSkip && (
          <button
            onClick={() => handleAction(skipResponse)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10 transition disabled:opacity-50"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
