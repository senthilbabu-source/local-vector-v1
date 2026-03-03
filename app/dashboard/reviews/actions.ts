'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { pushGBPReply } from '@/lib/review-engine/gbp-reply-pusher';
import { generateEntityOptimizedResponse } from '@/lib/reviews/review-responder';
import { extractTopMenuItems, extractKeyAmenities } from '@/lib/reviews/entity-weaver';
import { analyzeSentiment } from '@/lib/review-engine/sentiment-analyzer';
import { deriveOrUpdateBrandVoice } from '@/lib/review-engine/brand-voice-profiler';
import type { Review } from '@/lib/review-engine/types';
import type { GroundTruth } from '@/lib/nap-sync/types';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Banned phrases — Sprint 132 §164
// ---------------------------------------------------------------------------

export const BANNED_PHRASES = [
  'as a valued customer',
  "we're so sorry for any inconvenience",
  'we value your feedback',
  'we apologize for any inconvenience',
  'thank you for bringing this to our attention',
  'we strive to provide',
  'your satisfaction is our priority',
];

export function hasBannedPhrases(text: string): { found: boolean; phrase: string | null } {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return { found: true, phrase };
    }
  }
  return { found: false, phrase: null };
}

// ---------------------------------------------------------------------------
// approveReviewResponse — set response_status = 'approved'
// ---------------------------------------------------------------------------

export async function approveReviewResponse(reviewId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: review } = await supabase
    .from('reviews')
    .select('id, response_draft, response_status')
    .eq('id', reviewId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!review) return { success: false, error: 'Review not found' };
  if (!review.response_draft) return { success: false, error: 'No draft to approve' };

  const { error } = await supabase
    .from('reviews')
    .update({ response_status: 'approved' })
    .eq('id', reviewId)
    .eq('org_id', ctx.orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard/reviews');
  return { success: true };
}

// ---------------------------------------------------------------------------
// publishReviewResponse — push to GBP then set 'published'
// ---------------------------------------------------------------------------

export async function publishReviewResponse(reviewId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: review } = await supabase
    .from('reviews')
    .select('id, response_draft, response_status, platform')
    .eq('id', reviewId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!review) return { success: false, error: 'Review not found' };
  if (!review.response_draft) return { success: false, error: 'No draft to publish' };

  if (review.platform === 'google') {
    const result = await pushGBPReply(supabase, reviewId, review.response_draft);
    if (!result.ok) return { success: false, error: result.error ?? 'GBP publish failed' };
  } else {
    // Yelp does not support programmatic responses — mark as published locally
    await supabase
      .from('reviews')
      .update({
        response_status: 'published',
        response_published_at: new Date().toISOString(),
        response_published_text: review.response_draft,
      })
      .eq('id', reviewId)
      .eq('org_id', ctx.orgId);
  }

  revalidatePath('/dashboard/reviews');
  return { success: true };
}

// ---------------------------------------------------------------------------
// regenerateResponse — Sprint 132 entity-optimized regeneration
// ---------------------------------------------------------------------------

export async function regenerateResponse(reviewId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: review } = await supabase
    .from('reviews')
    .select('id, platform_review_id, platform, location_id, org_id, reviewer_name, rating, text, published_at, keywords')
    .eq('id', reviewId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (!review) return { success: false, error: 'Review not found' };

  try {
    // Fetch location data
    const { data: location } = await supabase
      .from('locations')
      .select('id, org_id, business_name, address_line1, city, state, zip, phone, website_url, categories, amenities')
      .eq('id', review.location_id)
      .maybeSingle();

    if (!location) return { success: false, error: 'Location not found' };

    const groundTruth: GroundTruth = {
      location_id: location.id,
      org_id: location.org_id,
      name: location.business_name ?? '',
      address: location.address_line1 ?? '',
      city: location.city ?? '',
      state: location.state ?? '',
      zip: location.zip ?? '',
      phone: location.phone ?? '',
      website: location.website_url ?? undefined,
    };

    // Parse categories
    let categories: string[] | null = null;
    if (location.categories) {
      if (Array.isArray(location.categories)) {
        categories = location.categories as string[];
      } else if (typeof location.categories === 'object') {
        const catObj = location.categories as Record<string, unknown>;
        if (catObj.primary) categories = [catObj.primary as string];
      }
    }

    const brandVoice = await deriveOrUpdateBrandVoice(supabase, review.location_id, ctx.orgId);

    // Fetch menu items
    const { data: menuData } = await supabase
      .from('magic_menus')
      .select('extracted_data')
      .eq('location_id', review.location_id)
      .eq('is_published', true)
      .limit(1)
      .maybeSingle();

    const signatureMenuItems = extractTopMenuItems(menuData?.extracted_data, 3);

    const reviewObj: Review = {
      id: review.platform_review_id,
      platform: review.platform as 'google' | 'yelp',
      location_id: review.location_id,
      org_id: review.org_id,
      reviewer_name: review.reviewer_name,
      rating: review.rating,
      text: review.text,
      published_at: review.published_at,
    };

    let draft = await generateEntityOptimizedResponse({
      review: reviewObj,
      groundTruth,
      brandVoice,
      locationCategories: categories,
      locationAmenities: location.amenities as Record<string, boolean | null> | null,
      signatureMenuItems,
      reviewKeywords: review.keywords ?? [],
    });

    if (!draft) return { success: false, error: 'Draft generation failed' };

    // Check banned phrases — retry once
    const check = hasBannedPhrases(draft.draft_text);
    if (check.found) {
      // Retry with banned phrase added to avoid list
      const retryBrandVoice = {
        ...brandVoice,
        avoid_phrases: [...brandVoice.avoid_phrases, check.phrase!],
      };
      const retryDraft = await generateEntityOptimizedResponse({
        review: reviewObj,
        groundTruth,
        brandVoice: retryBrandVoice,
        locationCategories: categories,
        locationAmenities: location.amenities as Record<string, boolean | null> | null,
        signatureMenuItems,
        reviewKeywords: review.keywords ?? [],
      });

      if (retryDraft && !hasBannedPhrases(retryDraft.draft_text).found) {
        draft = retryDraft;
      } else {
        // Second attempt also contains banned — save anyway, flag entityOptimized=false
        if (retryDraft) {
          draft = { ...retryDraft, entityOptimized: false };
        }
      }
    }

    const responseStatus = draft.requires_approval ? 'pending_approval' : 'draft_ready';

    await supabase
      .from('reviews')
      .update({
        response_draft: draft.draft_text,
        response_status: responseStatus,
      })
      .eq('id', reviewId)
      .eq('org_id', ctx.orgId);

    revalidatePath('/dashboard/reviews');
    return { success: true };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: 'regenerateResponse', sprint: '132' } });
    return { success: false, error: 'Regeneration failed' };
  }
}

// ---------------------------------------------------------------------------
// skipResponse — set response_status = 'skipped'
// ---------------------------------------------------------------------------

export async function skipResponse(reviewId: string): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('reviews')
    .update({ response_status: 'skipped' })
    .eq('id', reviewId)
    .eq('org_id', ctx.orgId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard/reviews');
  return { success: true };
}
