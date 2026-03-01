// ---------------------------------------------------------------------------
// lib/review-engine/sentiment-analyzer.ts — Rule-based sentiment analysis
//
// Sprint 107: Pure function layer — no I/O, no LLM calls.
// Classifies reviews by sentiment, extracts keywords, categorizes topics.
// ---------------------------------------------------------------------------

import type { Review, ReviewSentiment, ReviewTopic, SentimentLabel } from './types';

/**
 * Known positive keywords for local restaurant/lounge businesses.
 */
export const KNOWN_POSITIVE_KEYWORDS: Record<ReviewTopic['category'], string[]> = {
  service:      ['friendly staff', 'great service', 'attentive', 'helpful', 'fast service', 'responsive', 'excellent service', 'wonderful service'],
  food:         ['delicious', 'amazing food', 'authentic', 'fresh', 'tasty', 'best food', 'flavorful', 'perfectly cooked'],
  atmosphere:   ['great vibe', 'beautiful decor', 'cozy', 'elegant', 'nice ambiance', 'loved the atmosphere', 'great atmosphere', 'amazing vibe'],
  value:        ['worth it', 'good value', 'affordable', 'reasonable prices', 'great deal'],
  hookah:       ['great hookah', 'best hookah', 'premium hookah', 'smooth hookah', 'many flavors', '50 flavors', 'hookah flavors'],
  events:       ['belly dancing', 'live entertainment', 'great show', 'fun night', 'themed night', 'afrobeats'],
  staff:        ['manager was great', 'owner was present', 'staff was welcoming', 'friendly', 'super friendly'],
  cleanliness:  ['clean', 'spotless', 'well maintained'],
  other:        [],
};

export const KNOWN_NEGATIVE_KEYWORDS: Record<ReviewTopic['category'], string[]> = {
  service:      ['slow service', 'rude staff', 'ignored', 'waited forever', 'bad service', 'unprofessional', 'really slow'],
  food:         ['bland', 'overpriced food', 'cold food', 'bad taste', 'small portions'],
  atmosphere:   ['too loud', 'overcrowded', 'smoky', 'dirty', 'bad music'],
  value:        ['overpriced', 'not worth it', 'expensive', 'too pricey'],
  hookah:       ['bad hookah', 'harsh hookah', 'no flavor', 'hookah went out'],
  events:       ['no entertainment', 'boring', 'event was cancelled'],
  staff:        ['rude', 'dismissive', 'unhelpful'],
  cleanliness:  ['dirty', 'filthy', 'unclean', 'smelled bad'],
  other:        [],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'were', 'are', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
  'they', 'them', 'their', 'what', 'which', 'who', 'when', 'where',
  'how', 'not', 'no', 'so', 'if', 'than', 'too', 'very', 'just',
  'about', 'also', 'here', 'there', 'then', 'now', 'all', 'any',
  'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
]);

/**
 * Determines the rating band from a star rating.
 */
function getRatingBand(rating: number): 'high' | 'mid' | 'low' {
  if (rating >= 4) return 'high';
  if (rating === 3) return 'mid';
  return 'low';
}

/**
 * Base sentiment score from rating (5=1.0, 4=0.6, 3=0.0, 2=-0.6, 1=-1.0).
 */
function baseSentimentScore(rating: number): number {
  const scores: Record<number, number> = { 5: 1.0, 4: 0.6, 3: 0.0, 2: -0.6, 1: -1.0 };
  return scores[rating] ?? 0;
}

/**
 * Extracts keywords from review text by matching against known keyword lists.
 * Normalizes to lowercase, removes stop words, extracts n-grams (1–3 words).
 * Returns max 5 keywords.
 */
export function extractKeywords(text: string): string[] {
  if (!text || text.length < 20) return [];

  const lowerText = text.toLowerCase();
  const found: string[] = [];

  // Check all known keyword lists for matches (longest first for better matching)
  const allKeywords: string[] = [];
  for (const category of Object.keys(KNOWN_POSITIVE_KEYWORDS) as ReviewTopic['category'][]) {
    allKeywords.push(...KNOWN_POSITIVE_KEYWORDS[category]);
    allKeywords.push(...KNOWN_NEGATIVE_KEYWORDS[category]);
  }

  // Sort by length descending to match longer phrases first
  allKeywords.sort((a, b) => b.length - a.length);

  for (const keyword of allKeywords) {
    if (lowerText.includes(keyword.toLowerCase()) && !found.includes(keyword)) {
      found.push(keyword);
    }
  }

  // Also extract standalone significant words not in stop words
  const words = lowerText
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

  // Add unique single words not already covered by phrase matches
  for (const word of words) {
    if (found.length >= 5) break;
    const alreadyCovered = found.some((f) => f.includes(word));
    if (!alreadyCovered && !found.includes(word)) {
      // Only add if it's a meaningful word found in our keyword lists
      const isKnown = allKeywords.some((k) => k.includes(word));
      if (isKnown) {
        found.push(word);
      }
    }
  }

  return found.slice(0, 5);
}

/**
 * Categorizes a keyword into a ReviewTopic category.
 */
export function classifyTopic(keyword: string): ReviewTopic['category'] {
  const lower = keyword.toLowerCase();

  for (const category of Object.keys(KNOWN_POSITIVE_KEYWORDS) as ReviewTopic['category'][]) {
    if (category === 'other') continue;
    const positives = KNOWN_POSITIVE_KEYWORDS[category];
    const negatives = KNOWN_NEGATIVE_KEYWORDS[category];
    if (positives.some((k) => lower.includes(k) || k.includes(lower))) return category;
    if (negatives.some((k) => lower.includes(k) || k.includes(lower))) return category;
  }

  return 'other';
}

/**
 * Determines sentiment for a keyword based on which list it belongs to.
 */
function keywordSentiment(keyword: string): SentimentLabel {
  const lower = keyword.toLowerCase();
  for (const category of Object.keys(KNOWN_NEGATIVE_KEYWORDS) as ReviewTopic['category'][]) {
    if (KNOWN_NEGATIVE_KEYWORDS[category].some((k) => lower.includes(k) || k.includes(lower))) {
      return 'negative';
    }
  }
  for (const category of Object.keys(KNOWN_POSITIVE_KEYWORDS) as ReviewTopic['category'][]) {
    if (KNOWN_POSITIVE_KEYWORDS[category].some((k) => lower.includes(k) || k.includes(lower))) {
      return 'positive';
    }
  }
  return 'neutral';
}

/**
 * Builds topic list from extracted keywords.
 */
function buildTopics(keywords: string[]): ReviewTopic[] {
  const topicMap = new Map<ReviewTopic['category'], ReviewTopic>();

  for (const kw of keywords) {
    const category = classifyTopic(kw);
    const sentiment = keywordSentiment(kw);

    const existing = topicMap.get(category);
    if (existing) {
      existing.mentions.push(kw);
      // If any mention is negative, the topic becomes negative
      if (sentiment === 'negative') existing.sentiment = 'negative';
    } else {
      topicMap.set(category, { category, sentiment, mentions: [kw] });
    }
  }

  return Array.from(topicMap.values());
}

/**
 * Counts positive and negative keyword matches in text.
 */
function countSentimentSignals(text: string): { positive: number; negative: number } {
  const lowerText = text.toLowerCase();
  let positive = 0;
  let negative = 0;

  for (const category of Object.keys(KNOWN_POSITIVE_KEYWORDS) as ReviewTopic['category'][]) {
    for (const kw of KNOWN_POSITIVE_KEYWORDS[category]) {
      if (lowerText.includes(kw)) positive++;
    }
  }

  for (const category of Object.keys(KNOWN_NEGATIVE_KEYWORDS) as ReviewTopic['category'][]) {
    for (const kw of KNOWN_NEGATIVE_KEYWORDS[category]) {
      if (lowerText.includes(kw)) negative++;
    }
  }

  return { positive, negative };
}

/**
 * Analyzes a review and returns its sentiment classification.
 * Pure function — no side effects, no I/O.
 */
export function analyzeSentiment(review: Review): ReviewSentiment {
  const ratingBand = getRatingBand(review.rating);
  let baseScore = baseSentimentScore(review.rating);

  // Determine base sentiment from rating
  let label: SentimentLabel;
  if (ratingBand === 'high') label = 'positive';
  else if (ratingBand === 'mid') label = 'neutral';
  else label = 'negative';

  // Text modifiers
  if (review.text && review.text.length >= 10) {
    const signals = countSentimentSignals(review.text);

    // 4-star with strong negative text → neutral
    if (review.rating === 4 && signals.negative >= 2 && signals.negative > signals.positive) {
      label = 'neutral';
    }

    // 3-star with mostly positive text → positive
    if (review.rating === 3 && signals.positive >= 2 && signals.positive > signals.negative) {
      label = 'positive';
    }

    // Adjust score based on keyword presence
    const adjustment = Math.min(0.2, (signals.positive - signals.negative) * 0.1);
    baseScore = Math.max(-1, Math.min(1, baseScore + adjustment));
  }

  const keywords = extractKeywords(review.text);
  const topics = buildTopics(keywords);

  // Round to 1 decimal place
  const score = Math.round(baseScore * 10) / 10;

  return {
    label,
    score,
    rating_band: ratingBand,
    keywords,
    topics,
  };
}

/**
 * Batch-analyzes multiple reviews efficiently.
 * Returns a map of review.id to ReviewSentiment.
 */
export function batchAnalyzeSentiment(reviews: Review[]): Map<string, ReviewSentiment> {
  const results = new Map<string, ReviewSentiment>();
  for (const review of reviews) {
    results.set(review.id, analyzeSentiment(review));
  }
  return results;
}
