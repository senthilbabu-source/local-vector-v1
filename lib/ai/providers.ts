// ---------------------------------------------------------------------------
// lib/ai/providers.ts — Centralized AI Provider Configuration (Vercel AI SDK)
//
// Surgery 1: Replaces raw fetch() calls across all services with the Vercel
// AI SDK unified provider API. All AI model access goes through this module.
//
// Benefits over raw fetch():
//   • Unified API across OpenAI, Perplexity, Anthropic, Google
//   • Zod-validated structured output (Output.object) — no manual JSON.parse
//   • Built-in retries, error typing, and streaming support
//   • Single point of change for model upgrades or provider swaps
//   • OpenTelemetry-ready for Sentry integration
//
// Usage:
//   import { openai, perplexity, anthropic, google, getModel } from '@/lib/ai/providers';
//   const { output } = await generateText({
//     model: getModel('openai'),
//     output: Output.object({ schema: MyZodSchema }),
//     prompt: '...',
//   });
// ---------------------------------------------------------------------------

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';

// ── Provider instances ──────────────────────────────────────────────────────

/**
 * OpenAI provider — used for Fear Engine (GPT-4o) and Greed Engine (GPT-4o-mini).
 * API key sourced from OPENAI_API_KEY env var automatically.
 */
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
});

/**
 * Perplexity provider — uses OpenAI-compatible API.
 * Used for SOV Engine queries and Greed Engine Stage 1 (head-to-head).
 * API key sourced from PERPLEXITY_API_KEY env var.
 */
export const perplexity = createOpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai/',
  compatibility: 'compatible',
  name: 'perplexity',
});

/**
 * Anthropic provider — used for multi-engine Truth Audit (Claude Sonnet).
 * API key sourced from ANTHROPIC_API_KEY env var.
 */
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Google Generative AI provider — used for multi-engine Truth Audit (Gemini).
 * API key sourced from GOOGLE_GENERATIVE_AI_API_KEY env var.
 */
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

/**
 * xAI provider (Grok) — OpenAI-compatible API.
 * Used for SOV Engine queries. Has native web search grounding.
 * API key sourced from XAI_API_KEY env var.
 */
export const xai = createOpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  compatibility: 'compatible',
  name: 'xai',
});

/**
 * You.com provider — OpenAI-compatible chat API with native web search.
 * Used for SOV Engine queries.
 * API key sourced from YOUCOM_API_KEY env var.
 */
export const youcom = createOpenAI({
  apiKey: process.env.YOUCOM_API_KEY,
  baseURL: 'https://api.you.com/v1',
  compatibility: 'compatible',
  name: 'youcom',
});

// ── Web Search Tool for OpenAI Responses API ────────────────────────────────

/**
 * Creates a web_search_preview provider-defined tool for OpenAI Responses API models.
 * Pass this in the `tools` parameter of generateText/generateObject calls
 * when using openai.responses() models to enable live web search grounding.
 *
 * @param city  Business city (e.g. "Alpharetta") — localizes search results
 * @param state Business state (e.g. "Georgia")
 */
export function webSearchTool(city?: string | null, state?: string | null) {
  return {
    type: 'provider-defined' as const,
    id: 'openai.web_search_preview' as const,
    args: {
      ...(city && state ? {
        userLocation: {
          type: 'approximate' as const,
          city,
          country: 'US',
          region: state,
        },
      } : {}),
    },
    parameters: z.object({}),
  };
}

// ── Model registry ──────────────────────────────────────────────────────────

/**
 * Canonical model IDs used across the platform.
 * Centralised here so model upgrades require exactly one change.
 *
 * ENGINE-GROUNDING-FIX: All external query-facing models now use web-grounded
 * search (OpenAI Responses API, Gemini useSearchGrounding, Perplexity sonar-pro).
 * Internal processing models (sentiment, content-brief, etc.) remain ungrounded.
 */
export const MODELS = {
  /** Fear Engine — hallucination detection with live web search (Responses API).
   *  Callers must pass webSearchTool() in tools for grounding. */
  'fear-audit': openai.responses('gpt-4o'),

  /** Greed Engine Stage 2 — intercept analysis (cost-efficient, internal reasoning) */
  'greed-intercept': openai('gpt-4o-mini'),

  /** Greed Engine Stage 1 — head-to-head comparison (live web, upgraded to sonar-pro) */
  'greed-headtohead': perplexity('sonar-pro'),

  /** SOV Engine — share-of-voice queries (live web results, upgraded to sonar-pro) */
  'sov-query': perplexity('sonar-pro'),

  /** SOV Engine — OpenAI path with live web search (Responses API).
   *  Callers must pass webSearchTool() in tools for grounding. */
  'sov-query-openai': openai.responses('gpt-4o'),

  /** SOV Engine — Google AI Overview simulation (search-grounded) */
  'sov-query-google': google('gemini-2.0-flash', { useSearchGrounding: true }),

  /** SOV Engine — Copilot simulation via Bing-grounded Perplexity (closest available proxy).
   *  TODO: Replace with official Microsoft Copilot API when available. */
  'sov-query-copilot': perplexity('sonar-pro'),

  /** Truth Audit — Anthropic engine (multi-engine comparison) */
  'truth-audit-anthropic': anthropic('claude-sonnet-4-20250514'),

  /** Truth Audit — Google engine with search grounding for accurate live comparison */
  'truth-audit-gemini': google('gemini-2.0-flash', { useSearchGrounding: true }),

  /** Truth Audit — OpenAI engine (multi-engine comparison) */
  'truth-audit-openai': openai('gpt-4o-mini'),

  /** Truth Audit — Perplexity engine (multi-engine comparison, upgraded to sonar-pro) */
  'truth-audit-perplexity': perplexity('sonar-pro'),

  /** AI Chat Assistant — streaming conversational agent with tool calls */
  'chat-assistant': openai('gpt-4o'),

  /** Menu OCR — GPT-4o Vision for PDF/image menu extraction (Sprint 59A) */
  'menu-ocr': openai('gpt-4o'),

  /** Sprint 81 — Sentiment extraction (cheap, structured output) */
  'sentiment-extract': openai('gpt-4o-mini'),

  /** Sprint 82 — Source mention extraction (cheap, structured output) */
  'source-extract': openai('gpt-4o-mini'),

  /** Sprint 86 — Content brief generation (cheap, structured output) */
  'content-brief': openai('gpt-4o-mini'),

  /** Sprint F (N2): AI Answer Preview — ChatGPT response */
  'preview-chatgpt': openai('gpt-4o-mini'),

  /** Sprint F (N2): AI Answer Preview — Perplexity response (basic tier for preview) */
  'preview-perplexity': perplexity('sonar'),

  /** Sprint F (N2): AI Answer Preview — Gemini response */
  'preview-gemini': google('gemini-2.0-flash'),

  /** Sprint 104: AI FAQ auto-generator (Doc 17 §4) — cost-efficient */
  'faq-generation': openai('gpt-4o-mini'),

  /** Sprint 108: Authority citation detection (basic tier for batch operations) */
  'authority-citation': perplexity('sonar'),

  /** Sprint 110: Sandbox AI simulation (Claude Sonnet for content analysis) */
  'sandbox-simulation': anthropic('claude-sonnet-4-20250514'),

  /** Sprint 120: Streaming content preview (Haiku for speed + cost) */
  'streaming-preview': anthropic('claude-3-5-haiku-20241022'),

  /** Sprint 120: Streaming SOV query simulation (Haiku for speed + cost) */
  'streaming-sov-simulate': anthropic('claude-3-5-haiku-20241022'),

  /** Sprint 123: Multi-Model SOV — GPT-4o-mini with live web search (Responses API).
   *  Callers must pass webSearchTool() in tools for grounding. */
  'sov-query-gpt': openai.responses('gpt-4o-mini'),

  /** Sprint 123: Multi-Model SOV — Gemini Flash with search grounding */
  'sov-query-gemini': google('gemini-2.0-flash', { useSearchGrounding: true }),

  /** Sprint 133: RAG chatbot — Haiku for speed + cost on public widget */
  'rag-chatbot': anthropic('claude-3-5-haiku-20241022'),

  /** Sprint 135: Intent Discovery prompt expansion (Haiku for cost) */
  'intent-expand': anthropic('claude-3-5-haiku-20241022'),

  /** Sprint 2: Grok (xAI) SOV queries — native web search, agency plan */
  'sov-query-grok': xai('grok-3-mini'),

  /** Sprint 2: You.com SOV queries — native web search, agency plan */
  'sov-query-youcom': youcom('you-research'),

  /** Sprint 6: Community platform monitoring via Perplexity web search */
  'community-monitor': perplexity('sonar-pro'),

  /** Menu Enhance: AI descriptions + typo corrections for extracted menu items */
  'menu-enhance': openai('gpt-4o-mini'),

} as const;

/** Sprint 119: Embedding model — kept separate from MODELS to preserve LanguageModelV1 union */
export const embeddingModel = openai.embedding('text-embedding-3-small');
export const EMBEDDING_MODEL = 'text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;

export type ModelKey = keyof typeof MODELS;

/**
 * Get a model instance by its canonical key.
 * Throws if the key is unknown — fail fast during development.
 */
export function getModel(key: ModelKey) {
  const model = MODELS[key];
  if (!model) {
    throw new Error(`[ai/providers] Unknown model key: ${key}`);
  }
  return model;
}

// ── API key availability check ──────────────────────────────────────────────

/**
 * Check if the required API key for a provider is configured.
 * Used by services to determine whether to run in demo/mock mode.
 */
export function hasApiKey(provider: 'openai' | 'perplexity' | 'anthropic' | 'google' | 'xai' | 'youcom'): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'perplexity') return !!process.env.PERPLEXITY_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  if (provider === 'google') return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (provider === 'xai') return !!process.env.XAI_API_KEY;
  if (provider === 'youcom') return !!process.env.YOUCOM_API_KEY;
  return false;
}
