// ---------------------------------------------------------------------------
// GET /api/review-engine/status — Review stats + paginated reviews
//
// Sprint 107: Returns ReviewStats + recent ReviewRecord[] for dashboard.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { ReviewStats, SentimentLabel } from '@/lib/review-engine/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Get active location
    const { data: location } = await supabase
      .from('locations')
      .select('id, review_health_score, reviews_last_synced_at, total_review_count, avg_rating')
      .eq('org_id', ctx.orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!location) {
      return NextResponse.json({ stats: null, reviews: [], pagination: { total: 0, page: 1, limit: 20, pages: 0 } });
    }

    // Pagination params
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const offset = (page - 1) * limit;

    // Fetch reviews (priority sorted: pending_approval first, then draft_ready, etc.)
    const { data: reviews, count: totalCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .eq('location_id', location.id)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Sort by priority: pending_approval > draft_ready > pending_draft > published > skipped
    const statusPriority: Record<string, number> = {
      pending_approval: 0,
      draft_ready: 1,
      pending_draft: 2,
      approved: 3,
      published: 4,
      skipped: 5,
    };

    const sortedReviews = (reviews ?? []).sort((a, b) => {
      const aPriority = statusPriority[a.response_status] ?? 99;
      const bPriority = statusPriority[b.response_status] ?? 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

    // Build stats
    const { data: allReviewsForStats } = await supabase
      .from('reviews')
      .select('platform, rating, sentiment_label, response_status, keywords')
      .eq('location_id', location.id);

    const stats: ReviewStats = {
      total_reviews: location.total_review_count ?? 0,
      avg_rating: location.avg_rating ? parseFloat(String(location.avg_rating)) : 0,
      platform_breakdown: {
        google: { count: 0, avg_rating: 0 },
        yelp: { count: 0, avg_rating: 0 },
      },
      sentiment_breakdown: { positive: 0, neutral: 0, negative: 0 },
      response_rate: 0,
      top_positive_keywords: [],
      top_negative_keywords: [],
      unanswered_count: 0,
      unanswered_negative_count: 0,
    };

    if (allReviewsForStats && allReviewsForStats.length > 0) {
      const googleReviews = allReviewsForStats.filter((r) => r.platform === 'google');
      const yelpReviews = allReviewsForStats.filter((r) => r.platform === 'yelp');

      stats.platform_breakdown.google = {
        count: googleReviews.length,
        avg_rating: googleReviews.length > 0
          ? Math.round(googleReviews.reduce((s, r) => s + r.rating, 0) / googleReviews.length * 10) / 10
          : 0,
      };
      stats.platform_breakdown.yelp = {
        count: yelpReviews.length,
        avg_rating: yelpReviews.length > 0
          ? Math.round(yelpReviews.reduce((s, r) => s + r.rating, 0) / yelpReviews.length * 10) / 10
          : 0,
      };

      for (const r of allReviewsForStats) {
        const label = r.sentiment_label as SentimentLabel;
        if (label in stats.sentiment_breakdown) {
          stats.sentiment_breakdown[label]++;
        }
      }

      const published = allReviewsForStats.filter((r) => r.response_status === 'published').length;
      stats.response_rate = allReviewsForStats.length > 0
        ? Math.round(published / allReviewsForStats.length * 100)
        : 0;

      stats.unanswered_count = allReviewsForStats.filter(
        (r) => !['published', 'approved', 'skipped'].includes(r.response_status),
      ).length;

      stats.unanswered_negative_count = allReviewsForStats.filter(
        (r) => r.sentiment_label === 'negative' && !['published', 'approved', 'skipped'].includes(r.response_status),
      ).length;

      // Aggregate keywords
      const posKeywords = new Map<string, number>();
      const negKeywords = new Map<string, number>();

      for (const r of allReviewsForStats) {
        const kws = (r.keywords ?? []) as string[];
        const target = r.sentiment_label === 'negative' ? negKeywords : posKeywords;
        for (const kw of kws) {
          target.set(kw, (target.get(kw) ?? 0) + 1);
        }
      }

      stats.top_positive_keywords = [...posKeywords.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([kw]) => kw);

      stats.top_negative_keywords = [...negKeywords.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([kw]) => kw);
    }

    const total = totalCount ?? 0;

    return NextResponse.json({
      stats,
      reviews: sortedReviews,
      review_health_score: location.review_health_score,
      reviews_last_synced_at: location.reviews_last_synced_at,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'review-status', sprint: '107' } });
    return NextResponse.json(
      { error: 'fetch_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
