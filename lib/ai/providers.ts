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
//   import { openai, perplexity, getModel } from '@/lib/ai/providers';
//   const { output } = await generateText({
//     model: getModel('openai'),
//     output: Output.object({ schema: MyZodSchema }),
//     prompt: '...',
//   });
// ---------------------------------------------------------------------------

import { createOpenAI } from '@ai-sdk/openai';

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

// ── Model registry ──────────────────────────────────────────────────────────

/**
 * Canonical model IDs used across the platform.
 * Centralised here so model upgrades require exactly one change.
 */
export const MODELS = {
  /** Fear Engine — hallucination detection (high reasoning) */
  'fear-audit': openai('gpt-4o'),

  /** Greed Engine Stage 2 — intercept analysis (cost-efficient) */
  'greed-intercept': openai('gpt-4o-mini'),

  /** Greed Engine Stage 1 — head-to-head comparison (live web) */
  'greed-headtohead': perplexity('sonar'),

  /** SOV Engine — share-of-voice queries (live web results) */
  'sov-query': perplexity('sonar'),

  /** SOV Engine — OpenAI alternative for multi-model SOV */
  'sov-query-openai': openai('gpt-4o'),
} as const;

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
export function hasApiKey(provider: 'openai' | 'perplexity'): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'perplexity') return !!process.env.PERPLEXITY_API_KEY;
  return false;
}
