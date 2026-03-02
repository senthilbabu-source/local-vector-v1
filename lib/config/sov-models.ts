// ---------------------------------------------------------------------------
// lib/config/sov-models.ts — SOV Model Configuration by Plan Tier (Sprint 123)
//
// Determines which AI models are queried per target query in the SOV cron.
// This is a CODE constant — no DB column for model config.
// Changing model availability requires a code deploy.
// ---------------------------------------------------------------------------

import type { ModelKey } from '@/lib/ai/providers';

export type SOVModelId =
  | 'perplexity_sonar'
  | 'openai_gpt4o_mini'
  | 'gemini_flash';

export interface SOVModelConfig {
  id: SOVModelId;
  /** Shown in UI: "Perplexity", "ChatGPT (GPT-4o mini)", "Gemini" */
  display_name: string;
  /** Key in MODELS registry from providers.ts */
  provider_key: ModelKey;
  max_tokens: number;
  /** ms delay between calls to this provider (rate limit discipline) */
  call_delay_ms: number;
  /** Which provider's API key must be present */
  api_key_provider: 'openai' | 'perplexity' | 'google';
}

export const SOV_MODEL_CONFIGS: Record<SOVModelId, SOVModelConfig> = {
  perplexity_sonar: {
    id: 'perplexity_sonar',
    display_name: 'Perplexity',
    provider_key: 'sov-query',
    max_tokens: 512,
    call_delay_ms: 500,
    api_key_provider: 'perplexity',
  },
  openai_gpt4o_mini: {
    id: 'openai_gpt4o_mini',
    display_name: 'ChatGPT',
    provider_key: 'sov-query-gpt',
    max_tokens: 512,
    call_delay_ms: 200,
    api_key_provider: 'openai',
  },
  gemini_flash: {
    id: 'gemini_flash',
    display_name: 'Gemini',
    provider_key: 'sov-query-gemini',
    max_tokens: 512,
    call_delay_ms: 200,
    api_key_provider: 'google',
  },
};

/**
 * Models enabled per plan tier.
 * Starter: Perplexity only (existing behavior unchanged).
 * Growth: Perplexity + ChatGPT.
 * Agency: all three.
 */
export const PLAN_SOV_MODELS: Record<string, SOVModelId[]> = {
  trial:   ['perplexity_sonar'],
  starter: ['perplexity_sonar'],
  growth:  ['perplexity_sonar', 'openai_gpt4o_mini'],
  agency:  ['perplexity_sonar', 'openai_gpt4o_mini', 'gemini_flash'],
};

/**
 * Returns model IDs enabled for the given plan tier.
 * Fallback: ['perplexity_sonar'] for unknown plan tiers.
 */
export function getEnabledModels(planTier: string): SOVModelId[] {
  return PLAN_SOV_MODELS[planTier] ?? ['perplexity_sonar'];
}
