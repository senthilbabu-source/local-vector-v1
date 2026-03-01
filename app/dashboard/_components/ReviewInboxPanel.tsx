'use client';

// ---------------------------------------------------------------------------
// ReviewInboxPanel — Sprint 107: Review Intelligence Engine dashboard panel
//
// Displays all reviews across platforms with sentiment badges, response status,
// and one-click draft generation/approval. Plan gate: Growth+ only.
// ---------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { Star, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';
import ReviewResponseModal from './ReviewResponseModal';
import type { ReviewStats, SentimentLabel } from '@/lib/review-engine/types';

interface ReviewRow {
  id: string;
  platform: string;
  reviewer_name: string;
  rating: number;
  text: string;
  published_at: string;
  sentiment_label: string;
  response_draft: string | null;
  response_status: string;
  platform_url?: string | null;
}

interface StatusResponse {
  stats: ReviewStats | null;
  reviews: ReviewRow[];
  review_health_score: number | null;
  reviews_last_synced_at: string | null;
  pagination: { total: number; page: number; limit: number; pages: number };
}

const SENTIMENT_COLORS: Record<SentimentLabel, { bg: string; text: string; label: string }> = {
  positive: { bg: 'bg-signal-green/10', text: 'text-signal-green', label: 'Pos' },
  neutral:  { bg: 'bg-yellow-400/10', text: 'text-yellow-400', label: 'Neutral' },
  negative: { bg: 'bg-red-400/10', text: 'text-red-400', label: 'Neg' },
};

const STATUS_LABELS: Record<string, string> = {
  pending_draft: 'No Draft',
  draft_ready: 'Draft Ready',
  pending_approval: 'Needs Approval',
  approved: 'Approved',
  published: 'Published',
  skipped: 'Skipped',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

interface ReviewInboxPanelProps {
  isGrowthPlan: boolean;
}

export default function ReviewInboxPanel({ isGrowthPlan }: ReviewInboxPanelProps) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/review-engine/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('[ReviewInboxPanel] fetch status failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isGrowthPlan) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, [isGrowthPlan, fetchStatus]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/review-engine/sync', { method: 'POST' });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('[ReviewInboxPanel] sync failed', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateDraft = async (reviewId: string) => {
    const res = await fetch(`/api/review-engine/${reviewId}/generate-draft`, { method: 'POST' });
    if (res.ok) {
      await fetchStatus();
    } else {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to generate draft');
    }
  };

  const handleApprove = async (reviewId: string, text: string) => {
    const res = await fetch(`/api/review-engine/${reviewId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_text: text }),
    });
    if (res.ok) {
      await fetchStatus();
    } else {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || 'Failed to approve');
    }
  };

  const handleSkip = async (reviewId: string) => {
    await fetch(`/api/review-engine/${reviewId}/skip`, { method: 'POST' });
    await fetchStatus();
  };

  if (!isGrowthPlan) return null;

  if (loading) {
    return (
      <div
        className="rounded-xl border border-white/5 bg-surface-dark p-5 animate-pulse"
        data-testid="review-inbox-skeleton"
      >
        <div className="h-5 w-48 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-16 bg-white/5 rounded-lg" />
          <div className="h-16 bg-white/5 rounded-lg" />
          <div className="h-16 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const reviews = data?.reviews ?? [];
  const healthScore = data?.review_health_score;
  const lastSynced = data?.reviews_last_synced_at;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-dark p-5" data-testid="review-inbox-panel">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-400" />
          <h2 className="text-base font-semibold text-white">Review Intelligence</h2>
          {stats && (
            <span className="text-sm text-slate-400">
              Avg: {stats.avg_rating.toFixed(1)}{'\u2605'} | {stats.total_reviews} total reviews
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {healthScore !== null && healthScore !== undefined && (
            <span className="text-sm font-semibold text-white" data-testid="review-health-score">
              Review Health: {healthScore}/100
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/20 transition disabled:opacity-50"
            data-testid="review-sync-button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Last synced */}
      {lastSynced && (
        <p className="text-xs text-slate-500 mb-3" data-testid="review-last-synced">
          Last synced: {formatRelativeTime(lastSynced)}
        </p>
      )}

      {/* Negative review alert */}
      {stats && stats.unanswered_negative_count > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 mb-4"
          data-testid="review-negative-alert"
        >
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">
            {stats.unanswered_negative_count} negative review{stats.unanswered_negative_count > 1 ? 's' : ''} unanswered — customers notice when you don&apos;t respond to critical feedback.
          </p>
        </div>
      )}

      {/* Empty state */}
      {reviews.length === 0 && !stats && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <MessageSquare className="h-4 w-4" />
          <p>No review data yet. Click &quot;Sync Now&quot; to fetch your reviews.</p>
        </div>
      )}

      {/* Review list */}
      {reviews.length > 0 && (
        <div className="space-y-2" data-testid="review-list">
          {reviews.map((review) => {
            const sentiment = SENTIMENT_COLORS[review.sentiment_label as SentimentLabel] ?? SENTIMENT_COLORS.neutral;
            const statusLabel = STATUS_LABELS[review.response_status] ?? review.response_status;
            const stars = Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-slate-600'}>
                {'\u2605'}
              </span>
            ));

            return (
              <div
                key={review.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
                data-testid={`review-row-${review.id}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="min-w-[100px]">
                    <p className="text-sm font-medium text-white truncate">{review.reviewer_name}</p>
                    <p className="text-xs text-slate-500 capitalize">{review.platform}</p>
                  </div>
                  <div className="text-sm">{stars}</div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sentiment.bg} ${sentiment.text}`}>
                    {sentiment.label}
                  </span>
                  <span className="text-xs text-slate-400">{statusLabel}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {review.response_status === 'pending_draft' && (
                    <button
                      onClick={() => handleGenerateDraft(review.id)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
                      data-testid={`review-generate-${review.id}`}
                    >
                      Generate Draft
                    </button>
                  )}
                  {['draft_ready', 'pending_approval'].includes(review.response_status) && (
                    <button
                      onClick={() => setSelectedReview(review)}
                      className="rounded-lg bg-signal-green/10 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/20 transition"
                      data-testid={`review-action-${review.id}`}
                    >
                      {review.response_status === 'pending_approval'
                        ? 'Review Response'
                        : review.platform === 'yelp'
                          ? 'Copy & Post'
                          : 'Post to Google'}
                    </button>
                  )}
                  {!['published', 'skipped'].includes(review.response_status) && (
                    <button
                      onClick={() => handleSkip(review.id)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition"
                      data-testid={`review-skip-${review.id}`}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Keyword sentiment summary */}
      {stats && (stats.top_positive_keywords.length > 0 || stats.top_negative_keywords.length > 0) && (
        <div className="mt-4 rounded-lg bg-white/[0.02] border border-white/5 px-4 py-3" data-testid="review-keywords-summary">
          <p className="text-xs font-medium text-slate-400 mb-2">Sentiment Keywords (last 30 days)</p>
          {stats.top_positive_keywords.length > 0 && (
            <p className="text-xs text-signal-green mb-1">
              <span className="mr-1">{'\u{1F7E2}'}</span>
              {stats.top_positive_keywords.join(' \u00B7 ')}
            </p>
          )}
          {stats.top_negative_keywords.length > 0 && (
            <p className="text-xs text-red-400">
              <span className="mr-1">{'\u{1F534}'}</span>
              {stats.top_negative_keywords.join(' \u00B7 ')}
            </p>
          )}
        </div>
      )}

      {/* Response modal */}
      {selectedReview && (
        <ReviewResponseModal
          isOpen
          onClose={() => setSelectedReview(null)}
          review={selectedReview}
          onApprove={handleApprove}
          onRegenerate={async (id) => {
            await handleGenerateDraft(id);
            await fetchStatus();
            // Update selected review with new draft
            const updated = data?.reviews.find((r) => r.id === id);
            if (updated) setSelectedReview(updated);
          }}
        />
      )}
    </div>
  );
}
