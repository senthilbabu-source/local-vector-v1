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
