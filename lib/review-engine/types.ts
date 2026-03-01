// ---------------------------------------------------------------------------
// lib/review-engine/types.ts — Review Intelligence Engine shared types
//
// Sprint 107: Cross-platform review monitoring, sentiment analysis, and
// AI-assisted response generation layer.
// ---------------------------------------------------------------------------

/**
 * A single review fetched from any platform.
 */
export interface Review {
  id: string;
  platform: 'google' | 'yelp';
  location_id: string;
  org_id: string;
  reviewer_name: string;
  reviewer_photo_url?: string;
  rating: number;
  text: string;
  published_at: string;
  platform_url?: string;
}

/**
 * Sentiment classification for a review.
 */
export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface ReviewTopic {
  category: 'service' | 'food' | 'atmosphere' | 'value' | 'hookah' | 'events' | 'staff' | 'cleanliness' | 'other';
  sentiment: SentimentLabel;
  mentions: string[];
}

export interface ReviewSentiment {
  label: SentimentLabel;
  score: number;
  rating_band: 'high' | 'mid' | 'low';
  keywords: string[];
  topics: ReviewTopic[];
}

/**
 * Brand voice profile — per location, manually editable.
 */
export interface BrandVoiceProfile {
  location_id: string;
  tone: 'warm' | 'professional' | 'casual' | 'playful';
  formality: 'formal' | 'semi-formal' | 'casual';
  use_emojis: boolean;
  sign_off: string;
  owner_name?: string;
  highlight_keywords: string[];
  avoid_phrases: string[];
  custom_instructions?: string;
  derived_from: 'website_copy' | 'manual' | 'hybrid';
  last_updated_at: string;
}

/**
 * A generated response draft for a review.
 */
export interface ReviewResponseDraft {
  review_id: string;
  platform: 'google' | 'yelp';
  draft_text: string;
  character_count: number;
  seo_keywords_used: string[];
  tone_match_score: number;
  generation_method: 'ai' | 'template';
  requires_approval: boolean;
  generated_at: string;
}

/**
 * Review with its sentiment analysis and response draft attached.
 * This is the full record stored in the DB.
 */
export interface ReviewRecord {
  id: string;
  platform_review_id: string;
  platform: 'google' | 'yelp';
  location_id: string;
  org_id: string;
  reviewer_name: string;
  reviewer_photo_url?: string | null;
  rating: number;
  text: string;
  published_at: string;
  platform_url?: string | null;

  // Sentiment
  sentiment_label: SentimentLabel;
  sentiment_score: number;
  keywords: string[];
  topics: ReviewTopic[];

  // Response
  response_draft?: string | null;
  response_status: 'pending_draft' | 'draft_ready' | 'pending_approval' | 'approved' | 'published' | 'skipped';
  response_published_at?: string | null;
  response_published_text?: string | null;
  response_error?: string | null;

  // Metadata
  fetched_at: string;
  last_updated_at: string;
}

/**
 * Aggregate review stats for the dashboard.
 */
export interface ReviewStats {
  total_reviews: number;
  avg_rating: number;
  platform_breakdown: Record<'google' | 'yelp', { count: number; avg_rating: number }>;
  sentiment_breakdown: Record<SentimentLabel, number>;
  response_rate: number;
  top_positive_keywords: string[];
  top_negative_keywords: string[];
  unanswered_count: number;
  unanswered_negative_count: number;
}

/**
 * Result of a full review sync run.
 */
export interface ReviewSyncResult {
  location_id: string;
  org_id: string;
  new_reviews_fetched: number;
  reviews_analyzed: number;
  drafts_generated: number;
  errors: string[];
  run_at: string;
}
