// ---------------------------------------------------------------------------
// lib/review-engine/index.ts — Barrel export
//
// Sprint 107: Review Intelligence Engine
// ---------------------------------------------------------------------------

// Types
export type {
  Review,
  SentimentLabel,
  ReviewTopic,
  ReviewSentiment,
  BrandVoiceProfile,
  ReviewResponseDraft,
  ReviewRecord,
  ReviewStats,
  ReviewSyncResult,
} from './types';

// Sentiment analysis
export {
  analyzeSentiment,
  batchAnalyzeSentiment,
  extractKeywords,
  classifyTopic,
  KNOWN_POSITIVE_KEYWORDS,
  KNOWN_NEGATIVE_KEYWORDS,
} from './sentiment-analyzer';

// Fetchers
export { fetchGBPReviews, mapGBPStarRating } from './fetchers/gbp-review-fetcher';
export { fetchYelpReviews } from './fetchers/yelp-review-fetcher';

// Brand voice
export {
  deriveOrUpdateBrandVoice,
  getDefaultBrandVoice,
  inferHighlightKeywords,
} from './brand-voice-profiler';

// Response generation
export {
  generateResponseDraft,
  buildResponseSystemPrompt,
  buildResponseUserMessage,
  validateResponseDraft,
  RESPONSE_GENERATION_LIMITS,
} from './response-generator';

// Sync orchestrator
export {
  runReviewSync,
  runReviewSyncForAllLocations,
} from './review-sync-service';

// GBP reply publishing
export {
  pushGBPReply,
  updateGBPReply,
} from './gbp-reply-pusher';
