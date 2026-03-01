// ---------------------------------------------------------------------------
// POST /api/review-engine/:id/generate-draft — Generate response draft
//
// Sprint 107: Generates or regenerates a response draft for a specific review.
// Respects RESPONSE_GENERATION_LIMITS per plan tier.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { analyzeSentiment } from '@/lib/review-engine/sentiment-analyzer';
import { deriveOrUpdateBrandVoice } from '@/lib/review-engine/brand-voice-profiler';
import { generateResponseDraft, RESPONSE_GENERATION_LIMITS } from '@/lib/review-engine/response-generator';
import type { Review } from '@/lib/review-engine/types';
import type { GroundTruth } from '@/lib/nap-sync/types';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reviewId } = await params;

    const ctx = await getSafeAuthContext();
    if (!ctx || !ctx.orgId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Fetch the review (RLS ensures org ownership)
    const { data: reviewRow } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .maybeSingle();

    if (!reviewRow) {
      return NextResponse.json({ error: 'not_found', message: 'Review not found' }, { status: 404 });
    }

    // Check plan limit
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', ctx.orgId)
      .single();

    const plan = orgRow?.plan ?? 'trial';
    const limit = RESPONSE_GENERATION_LIMITS[plan] ?? 5;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: generated } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.orgId)
      .neq('response_status', 'pending_draft')
      .neq('response_status', 'skipped')
      .gte('fetched_at', startOfMonth.toISOString());

    if ((generated ?? 0) >= limit) {
      return NextResponse.json(
        { error: 'limit_exceeded', message: `Monthly draft limit reached (${limit})` },
        { status: 429 },
      );
    }

    // Build review object
    const review: Review = {
      id: reviewRow.platform_review_id,
      platform: reviewRow.platform as 'google' | 'yelp',
      location_id: reviewRow.location_id,
      org_id: reviewRow.org_id,
      reviewer_name: reviewRow.reviewer_name,
      rating: reviewRow.rating,
      text: reviewRow.text,
      published_at: reviewRow.published_at,
    };

    const sentiment = analyzeSentiment(review);

    // Get brand voice and ground truth
    const serviceRole = createServiceRoleClient();
    const brandVoice = await deriveOrUpdateBrandVoice(serviceRole, reviewRow.location_id, ctx.orgId);

    const { data: locData } = await supabase
      .from('locations')
      .select('id, org_id, business_name, address_line1, city, state, zip, phone, website_url')
      .eq('id', reviewRow.location_id)
      .maybeSingle();

    const groundTruth: GroundTruth = {
      location_id: locData?.id ?? '',
      org_id: locData?.org_id ?? ctx.orgId,
      name: locData?.business_name ?? '',
      address: locData?.address_line1 ?? '',
      city: locData?.city ?? '',
      state: locData?.state ?? '',
      zip: locData?.zip ?? '',
      phone: locData?.phone ?? '',
      website: locData?.website_url ?? undefined,
    };

    const draft = await generateResponseDraft(review, sentiment, brandVoice, groundTruth);
    const responseStatus = draft.requires_approval ? 'pending_approval' : 'draft_ready';

    // Update review with draft
    await supabase
      .from('reviews')
      .update({
        response_draft: draft.draft_text,
        response_status: responseStatus,
      })
      .eq('id', reviewId);

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    Sentry.captureException(err, { tags: { route: 'review-generate-draft', sprint: '107' } });
    return NextResponse.json(
      { error: 'generation_failed', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
