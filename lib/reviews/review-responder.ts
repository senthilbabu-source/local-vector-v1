// ---------------------------------------------------------------------------
// lib/reviews/review-responder.ts — Entity-Optimized Response Orchestrator
//
// Sprint 132: Orchestrates entity selection + response generation.
// AI_RULES §164: This is the ONLY entry point for review response generation
// after Sprint 132. Never call bare generateResponseDraft() from new code.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import { selectEntityTerms, extractKeyAmenities } from './entity-weaver';
import { generateResponseDraft } from '@/lib/review-engine/response-generator';
import { analyzeSentiment } from '@/lib/review-engine/sentiment-analyzer';
import type { Review, ReviewResponseDraft, BrandVoiceProfile } from '@/lib/review-engine/types';
import type { GroundTruth } from '@/lib/nap-sync/types';

export interface EntityOptimizedResponseInput {
  review: Review;
  groundTruth: GroundTruth;
  brandVoice: BrandVoiceProfile;
  locationCategories: string[] | null;
  locationAmenities: Record<string, boolean | null> | null;
  signatureMenuItems: string[];
  reviewKeywords?: string[];  // pre-analyzed keywords from DB, avoids re-analysis
}

export async function generateEntityOptimizedResponse(
  input: EntityOptimizedResponseInput,
): Promise<ReviewResponseDraft | null> {
  const sentiment = analyzeSentiment(input.review);

  try {
    // Use provided keywords or derive from sentiment analysis
    const reviewKeywords = input.reviewKeywords ?? sentiment.keywords;

    const entitySelection = selectEntityTerms({
      businessName: input.groundTruth.name,
      city: input.groundTruth.city,
      categories: input.locationCategories,
      signatureItems: input.signatureMenuItems,
      keyAmenities: extractKeyAmenities(input.locationAmenities),
      reviewRating: input.review.rating,
      reviewKeywords,
    });

    const draft = await generateResponseDraft(
      input.review,
      sentiment,
      input.brandVoice,
      input.groundTruth,
      entitySelection.terms,
    );

    if (!draft) return null;

    return {
      ...draft,
      entityTermsUsed: entitySelection.terms,
      entityOptimized: true,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { service: 'review-responder', sprint: '132' },
    });
    // Graceful fallback: generate without entity optimization
    return generateResponseDraft(input.review, sentiment, input.brandVoice, input.groundTruth);
  }
}
