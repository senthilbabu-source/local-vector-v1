// ---------------------------------------------------------------------------
// lib/services/sentiment.service.ts — AI Sentiment Extraction & Aggregation
//
// Sprint 81: Extracts sentiment from SOV raw_response using gpt-4o-mini.
// Provides pure aggregation functions for dashboard summarization.
//
// This module is a pure service — no Supabase client creation.
// AI extraction uses generateObject with SentimentExtractionSchema.
// ---------------------------------------------------------------------------

import { generateObject } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import { SentimentExtractionSchema, zodSchema, type SentimentExtraction } from '@/lib/ai/schemas';

// ---------------------------------------------------------------------------
// Sentiment extraction (AI-powered)
// ---------------------------------------------------------------------------

/**
 * Extract sentiment from an AI engine's raw response about a business.
 * Uses gpt-4o-mini for cheap, fast structured output.
 *
 * Returns null if:
 * - No API key available
 * - rawResponse is null/empty
 * - Extraction fails
 *
 * Returns quick not_mentioned result (no API call) if business name
 * is not found in the response text.
 */
export async function extractSentiment(
  rawResponse: string | null,
  businessName: string,
): Promise<SentimentExtraction | null> {
  if (!rawResponse || rawResponse.trim().length === 0) return null;
  if (!hasApiKey('openai')) return null;

  // Quick check: is the business even mentioned?
  if (!rawResponse.toLowerCase().includes(businessName.toLowerCase())) {
    return {
      score: 0,
      label: 'neutral',
      descriptors: { positive: [], negative: [], neutral: [] },
      tone: 'matter_of_fact',
      recommendation_strength: 'not_mentioned',
    };
  }

  try {
    const { object } = await generateObject({
      model: getModel('sentiment-extract'),
      schema: zodSchema(SentimentExtractionSchema),
      system: buildSentimentSystemPrompt(),
      prompt: buildSentimentPrompt(rawResponse, businessName),
    });

    return object;
  } catch (err) {
    console.error('[sentiment] Extraction failed:', err);
    return null;
  }
}

function buildSentimentSystemPrompt(): string {
  return `You are a sentiment analysis specialist for local business AI mentions. You analyze how AI engines describe businesses and extract the emotional tone, specific descriptors, and recommendation strength.

Focus on:
- Adjectives and phrases used specifically about the target business
- Whether the business is recommended enthusiastically, matter-of-factly, or cautiously
- Whether any negative language or caveats are used
- The overall emotional framing (positive, neutral, negative)

Be precise with descriptors — extract the actual words used, not paraphrases.`;
}

function buildSentimentPrompt(rawResponse: string, businessName: string): string {
  return `Analyze the sentiment toward "${businessName}" in this AI-generated response:

---
${rawResponse}
---

Extract:
1. An overall sentiment score from -1.0 (very negative) to 1.0 (very positive)
2. A sentiment label (very_positive, positive, neutral, negative, very_negative)
3. Specific descriptors used about "${businessName}" categorized as positive, negative, or neutral
4. The overall tone of presentation
5. Whether "${businessName}" is the primary recommendation, secondary, merely mentioned, or not mentioned`;
}

// ---------------------------------------------------------------------------
// Aggregation (pure functions — no I/O)
// ---------------------------------------------------------------------------

export interface SentimentSummary {
  /** Average sentiment score across all evaluations */
  averageScore: number;
  /** Most common sentiment label */
  dominantLabel: SentimentExtraction['label'];
  /** Most common tone */
  dominantTone: SentimentExtraction['tone'];
  /** All positive descriptors (deduplicated, sorted by frequency) */
  topPositive: string[];
  /** All negative descriptors (deduplicated, sorted by frequency) */
  topNegative: string[];
  /** Per-engine breakdown */
  byEngine: Record<string, {
    averageScore: number;
    label: SentimentExtraction['label'];
    tone: SentimentExtraction['tone'];
    descriptors: { positive: string[]; negative: string[] };
  }>;
  /** Evaluation count */
  evaluationCount: number;
}

/**
 * Aggregate sentiment data from multiple evaluations into a summary.
 * Pure function — no I/O.
 */
export function aggregateSentiment(
  evaluations: Array<{
    engine: string;
    sentiment_data: SentimentExtraction | null;
  }>,
): SentimentSummary {
  const withSentiment = evaluations.filter(
    (e): e is typeof e & { sentiment_data: SentimentExtraction } => e.sentiment_data !== null,
  );

  if (withSentiment.length === 0) {
    return {
      averageScore: 0,
      dominantLabel: 'neutral',
      dominantTone: 'matter_of_fact',
      topPositive: [],
      topNegative: [],
      byEngine: {},
      evaluationCount: 0,
    };
  }

  // Average score
  const averageScore = withSentiment.reduce((sum, e) => sum + e.sentiment_data.score, 0) / withSentiment.length;

  // Frequency counts for labels and tones
  const labelCounts = countFrequencies(withSentiment.map(e => e.sentiment_data.label));
  const toneCounts = countFrequencies(withSentiment.map(e => e.sentiment_data.tone));

  // Descriptor aggregation
  const allPositive: string[] = [];
  const allNegative: string[] = [];
  for (const e of withSentiment) {
    allPositive.push(...e.sentiment_data.descriptors.positive);
    allNegative.push(...e.sentiment_data.descriptors.negative);
  }

  // Per-engine breakdown
  const byEngine: SentimentSummary['byEngine'] = {};
  const engineGroups = groupBy(withSentiment, e => e.engine);
  for (const [engine, evals] of Object.entries(engineGroups)) {
    const engineAvg = evals.reduce((s, e) => s + e.sentiment_data.score, 0) / evals.length;
    const engineLabels = countFrequencies(evals.map(e => e.sentiment_data.label));
    const engineTones = countFrequencies(evals.map(e => e.sentiment_data.tone));
    const enginePositive: string[] = [];
    const engineNegative: string[] = [];
    for (const e of evals) {
      enginePositive.push(...e.sentiment_data.descriptors.positive);
      engineNegative.push(...e.sentiment_data.descriptors.negative);
    }
    byEngine[engine] = {
      averageScore: Math.round(engineAvg * 100) / 100,
      label: topKey(engineLabels) as SentimentExtraction['label'],
      tone: topKey(engineTones) as SentimentExtraction['tone'],
      descriptors: {
        positive: dedupeByFrequency(enginePositive).slice(0, 10),
        negative: dedupeByFrequency(engineNegative).slice(0, 10),
      },
    };
  }

  return {
    averageScore: Math.round(averageScore * 100) / 100,
    dominantLabel: topKey(labelCounts) as SentimentExtraction['label'],
    dominantTone: topKey(toneCounts) as SentimentExtraction['tone'],
    topPositive: dedupeByFrequency(allPositive).slice(0, 15),
    topNegative: dedupeByFrequency(allNegative).slice(0, 15),
    byEngine,
    evaluationCount: withSentiment.length,
  };
}

// ---------------------------------------------------------------------------
// Utility helpers (exported for testing)
// ---------------------------------------------------------------------------

export function countFrequencies<T extends string>(items: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

export function topKey<T extends string>(counts: Record<T, number>): T {
  return Object.entries(counts).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] as T;
}

export function dedupeByFrequency(items: string[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const lower = item.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([word]) => word);
}

export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    (groups[key] ??= []).push(item);
  }
  return groups;
}
