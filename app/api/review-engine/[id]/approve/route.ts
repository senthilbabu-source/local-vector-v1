// ---------------------------------------------------------------------------
// POST /api/review-engine/:id/approve — Approve and post response
//
// Sprint 107: Approves a pending_approval response draft. For Google reviews,
// posts to GBP via the Reviews API. For Yelp, marks as approved (manual copy).
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { pushGBPReply } from '@/lib/review-engine/gbp-reply-pusher';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reviewId } = await params;

    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const approvedText = body.approved_text;

    if (!approvedText || typeof approvedText !== 'string' || approvedText.trim().length < 10) {
      return NextResponse.json(
        { error: 'invalid_text', message: 'Approved text must be at least 10 characters' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Fetch review (RLS ensures org ownership)
    const { data: review } = await supabase
      .from('reviews')
      .select('id, platform, response_status')
      .eq('id', reviewId)
      .maybeSingle();

    if (!review) {
      return NextResponse.json({ error: 'not_found', message: 'Review not found' }, { status: 404 });
    }

    if (!['pending_approval', 'draft_ready'].includes(review.response_status)) {
      return NextResponse.json(
        { error: 'invalid_status', message: `Cannot approve a review with status: ${review.response_status}` },
        { status: 400 },
      );
    }

    // Character limit validation
    const maxLength = review.platform === 'google' ? 4096 : 5000;
    if (approvedText.length > maxLength) {
      return NextResponse.json(
        { error: 'text_too_long', message: `Response exceeds ${maxLength} character limit for ${review.platform}` },
        { status: 400 },
      );
    }

    if (review.platform === 'google') {
      // Post to GBP
      const serviceRole = createServiceRoleClient();
      const result = await pushGBPReply(serviceRole, reviewId, approvedText.trim());

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, published: false, manual_post_required: false },
          { status: 502 },
        );
      }

      return NextResponse.json({ ok: true, published: true, manual_post_required: false });
    } else {
      // Yelp — mark as approved, no API push
      await supabase
        .from('reviews')
        .update({
          response_status: 'approved',
          response_published_text: approvedText.trim(),
        })
        .eq('id', reviewId);

      return NextResponse.json({ ok: true, published: false, manual_post_required: true });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'review-approve', sprint: '107' } });
    return NextResponse.json(
      { error: 'approve_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
