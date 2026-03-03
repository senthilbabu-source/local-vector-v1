import { redirect } from 'next/navigation';
import { Star, MessageSquareText } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { planSatisfies } from '@/lib/plan-enforcer';
import ReviewCard from './_components/ReviewCard';

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchReviews(orgId: string) {
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, platform, reviewer_name, reviewer_photo_url, rating, text, published_at, response_draft, response_status, response_published_at, keywords, location_id')
    .eq('org_id', orgId)
    .order('published_at', { ascending: false })
    .limit(100);

  return reviews ?? [];
}

async function fetchReviewStats(orgId: string) {
  const supabase = await createClient();

  const [totalResult, pendingResult, publishedResult, ratingResult] = await Promise.all([
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('org_id', orgId).in('response_status', ['pending_draft', 'draft_ready', 'pending_approval']),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('response_status', 'published'),
    supabase.from('reviews').select('rating').eq('org_id', orgId),
  ]);

  const total = totalResult.count ?? 0;
  const pending = pendingResult.count ?? 0;
  const published = publishedResult.count ?? 0;
  const ratings = ratingResult.data ?? [];
  const avgRating = ratings.length > 0
    ? Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length * 10) / 10
    : 0;

  return { total, pending, published, avgRating };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReviewsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const plan = ctx.plan ?? 'trial';
  const isGrowthPlus = planSatisfies(plan, 'growth');

  const [reviews, stats] = await Promise.all([
    fetchReviews(ctx.orgId),
    fetchReviewStats(ctx.orgId),
  ]);

  // Group reviews by status
  const needsResponse = reviews.filter(r =>
    ['pending_draft', 'draft_ready', 'pending_approval'].includes(r.response_status),
  );
  const approved = reviews.filter(r => r.response_status === 'approved');
  const published = reviews.filter(r => r.response_status === 'published');

  return (
    <div className="space-y-8" data-testid="reviews-page">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Reviews</h1>
        <p className="mt-0.5 text-sm text-[#94A3B8]">
          Manage AI-generated review responses with entity optimization
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Total Reviews</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-white">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Avg Rating</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-alert-amber">
            {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '--'}
          </p>
        </div>
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Needs Response</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-alert-crimson">
            {stats.pending}
          </p>
        </div>
        <div className="rounded-xl bg-surface-dark px-4 py-3 ring-1 ring-white/5">
          <p className="text-xs text-slate-500">Published</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-truth-emerald">
            {stats.published}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {reviews.length === 0 && (
        <div className="rounded-xl bg-surface-dark px-6 py-12 text-center border border-white/5">
          <MessageSquareText className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            No reviews synced yet. Reviews will appear after the next review sync cycle.
          </p>
        </div>
      )}

      {/* Needs Response section */}
      {needsResponse.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
            Needs Response ({needsResponse.length})
          </h2>
          <div className="space-y-4">
            {needsResponse.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                showEntityBadge={isGrowthPlus}
              />
            ))}
          </div>
        </section>
      )}

      {/* Approved section */}
      {approved.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
            Approved ({approved.length})
          </h2>
          <div className="space-y-4">
            {approved.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                showEntityBadge={isGrowthPlus}
              />
            ))}
          </div>
        </section>
      )}

      {/* Published section */}
      {published.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
            Published ({published.length})
          </h2>
          <div className="space-y-4">
            {published.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                showEntityBadge={isGrowthPlus}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
