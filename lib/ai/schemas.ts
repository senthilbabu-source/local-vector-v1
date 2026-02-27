// ---------------------------------------------------------------------------
// lib/ai/schemas.ts — Zod Schemas for AI Response Validation
//
// Surgery 1: These schemas are used with Vercel AI SDK's Output.object()
// to get compile-time type safety AND runtime validation on AI responses.
//
// Replaces: manual JSON.parse() + type assertions in ai-audit.service.ts,
// competitor-intercept.service.ts, and share-of-voice/actions.ts.
//
// Every schema here mirrors the exact shape expected by the corresponding
// Supabase insert — enum values match prod_schema.sql.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { jsonSchema as aiJsonSchema } from 'ai';

// ---------------------------------------------------------------------------
// Zod v4 → AI SDK adapter
// zod-to-json-schema@3 (bundled with ai@4) doesn't understand Zod v4.
// Use Zod v4's native .toJSONSchema() and wrap with the AI SDK's jsonSchema().
// All generateObject() and tool() calls must use zodSchema() instead of raw Zod.
// ---------------------------------------------------------------------------
export function zodSchema<T extends z.ZodType>(schema: T) {
    const js = (schema as any).toJSONSchema() as Record<string, unknown>;
    delete js.$schema;
    return aiJsonSchema<z.output<T>>(js);
}

// ── Fear Engine — Hallucination Audit ────────────────────────────────────────

export const HallucinationItemSchema = z.object({
  model_provider: z.enum([
    'openai-gpt4o',
    'perplexity-sonar',
    'google-gemini',
    'anthropic-claude',
    'microsoft-copilot',
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['status', 'hours', 'amenity', 'menu', 'address', 'phone']),
  claim_text: z.string(),
  expected_truth: z.string(),
});

export const AuditResultSchema = z.object({
  hallucinations: z.array(HallucinationItemSchema),
});

export type AuditResultOutput = z.infer<typeof AuditResultSchema>;

// ── Greed Engine — Perplexity Head-to-Head ──────────────────────────────────

export const PerplexityHeadToHeadSchema = z.object({
  winner: z.string(),
  reasoning: z.string(),
  key_differentiators: z.array(z.string()),
});

export type PerplexityHeadToHeadOutput = z.infer<typeof PerplexityHeadToHeadSchema>;

// ── Greed Engine — GPT Intercept Analysis ───────────────────────────────────

export const InterceptAnalysisSchema = z.object({
  winner: z.string(),
  winning_factor: z.string(),
  gap_magnitude: z.enum(['high', 'medium', 'low']),
  gap_details: z.object({
    competitor_mentions: z.number(),
    your_mentions: z.number(),
  }),
  suggested_action: z.string(),
  action_category: z.enum(['reviews', 'menu', 'attributes', 'content', 'photos']),
});

export type InterceptAnalysisOutput = z.infer<typeof InterceptAnalysisSchema>;

// ── SOV Engine — Share of Voice Query ───────────────────────────────────────

export const SovQueryResultSchema = z.object({
  rank_position: z.number().nullable(),
  mentioned_competitors: z.array(z.string()),
  raw_response: z.string(),
});

export type SovQueryResultOutput = z.infer<typeof SovQueryResultSchema>;

// ── SOV Engine — Cron batch query (Doc 04c §4.2 prompt shape) ───────────────

export const SovCronResultSchema = z.object({
  businesses: z.array(z.string()),
  cited_url: z.string().nullable(),
});

export type SovCronResultOutput = z.infer<typeof SovCronResultSchema>;

// ── Occasion Engine — Draft generation (Doc 16 §4.2) ───────────────────────

export const OccasionDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  estimated_aeo_score: z.number().min(0).max(100),
  target_keywords: z.array(z.string()),
});

export type OccasionDraftOutput = z.infer<typeof OccasionDraftSchema>;

// ── Autopilot Engine — Draft brief generation (Doc 19 §3.2) ─────────────────

export const AutopilotDraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  estimated_aeo_score: z.number().min(0).max(100),
  target_keywords: z.array(z.string()),
});

export type AutopilotDraftOutput = z.infer<typeof AutopilotDraftSchema>;

// ── Citation Intelligence — Citation cron response (Doc 18 §2.1) ────────────

export const CitationCronResultSchema = z.object({
  recommendations: z.array(z.object({
    business: z.string(),
    source_url: z.string().nullable(),
  })),
});

export type CitationCronResultOutput = z.infer<typeof CitationCronResultSchema>;

// ── Sentiment Extraction — SOV raw_response analysis (Sprint 81) ────────────

/**
 * Sprint 81 — Sentiment extraction schema.
 * Used with generateObject() to extract sentiment from SOV raw_response.
 */
export const SentimentExtractionSchema = z.object({
  /** Overall sentiment score: -1.0 (very negative) to 1.0 (very positive) */
  score: z.number().min(-1).max(1),

  /** Sentiment label */
  label: z.enum(['very_positive', 'positive', 'neutral', 'negative', 'very_negative']),

  /** Descriptors used about the business, categorized */
  descriptors: z.object({
    positive: z.array(z.string()).describe('Positive adjectives/phrases used about the business (e.g., "popular", "premium", "highly rated")'),
    negative: z.array(z.string()).describe('Negative adjectives/phrases used about the business (e.g., "inconsistent", "overpriced", "slow service")'),
    neutral: z.array(z.string()).describe('Neutral descriptors (e.g., "located in", "offers", "serves")'),
  }),

  /** Overall tone of how AI presents the business */
  tone: z.enum([
    'enthusiastic',     // Strong recommendation with superlatives
    'positive',         // Clear recommendation, good description
    'matter_of_fact',   // Factual, no strong opinion
    'mixed',            // Both positive and negative elements
    'cautious',         // Hedging, uncertain language
    'negative',         // Discouraging, negative framing
  ]),

  /** Is the business the primary recommendation or an also-mentioned? */
  recommendation_strength: z.enum(['primary', 'secondary', 'mentioned', 'not_mentioned']),
});

export type SentimentExtraction = z.infer<typeof SentimentExtractionSchema>;

// ── Menu OCR — GPT-4o Vision PDF/image extraction (Sprint 59A) ──────────────

export const MenuOCRItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  price: z.string().optional(),
  category: z.string(),
});

export const MenuOCRSchema = z.object({
  items: z.array(MenuOCRItemSchema).min(1),
});

export type MenuOCROutput = z.infer<typeof MenuOCRSchema>;
