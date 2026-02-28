// ---------------------------------------------------------------------------
// lib/services/multi-engine-eval.service.ts — Multi-Engine Truth Audit Service
//
// Sprint 55: Extracted from hallucinations/actions.ts so the cron pipeline
// can run multi-engine evaluations without going through a Server Action.
//
// Pure service — no Supabase client creation, no auth context.
// Callers pass their own Supabase client for DB writes.
//
// AI_RULES §6: business logic in lib/services/ never creates its own client.
// ---------------------------------------------------------------------------

import { generateText } from 'ai';
import { getModel, hasApiKey } from '@/lib/ai/providers';
import * as Sentry from '@sentry/nextjs';
import type { EvaluationEngine } from '@/lib/schemas/evaluations';
import { EVALUATION_ENGINES } from '@/lib/schemas/evaluations';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  accuracy_score: number;
  hallucinations_detected: string[];
  response_text: string;
}

export interface EngineEvaluation {
  engine: EvaluationEngine;
  result: EvaluationResult;
}

export interface MultiEngineEvalInput {
  business_name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  phone?: string | null;
  website_url?: string | null;
}

// ── Engine → provider mapping ────────────────────────────────────────────────

const ENGINE_PROVIDER: Record<EvaluationEngine, 'openai' | 'perplexity' | 'anthropic' | 'google'> = {
  openai: 'openai',
  perplexity: 'perplexity',
  anthropic: 'anthropic',
  gemini: 'google',
};

const ENGINE_KEY_NAMES: Record<EvaluationEngine, string> = {
  openai: 'OPENAI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GOOGLE_GENERATIVE_AI_API_KEY',
};

// ── Prompt builder ───────────────────────────────────────────────────────────

export function buildEvalPrompt(location: MultiEngineEvalInput): string {
  const address = [
    location.address_line1,
    location.city,
    location.state,
    location.zip,
  ]
    .filter(Boolean)
    .join(', ');

  return `You are an AI accuracy auditor for restaurant and business data.

GROUND TRUTH (from our verified database):
- Business name: ${location.business_name}
- Address: ${address || 'not listed'}
- Phone: ${location.phone ?? 'not listed'}
- Website: ${location.website_url ?? 'not listed'}

TASK:
1. Think about what an AI assistant would say if asked about "${location.business_name}" in "${location.city ?? ''}, ${location.state ?? ''}".
2. Compare that knowledge against the GROUND TRUTH above.
3. Identify any specific inaccuracies an AI might state.

Return a JSON object with exactly these three fields:
- "accuracy_score": integer 0-100 (100 = AI knowledge perfectly matches ground truth, 0 = entirely wrong)
- "hallucinations_detected": array of strings, each describing one specific inaccuracy (empty array if none)
- "response_text": a realistic AI response a user might receive when asking about this business

Return only valid JSON. No markdown, no explanation outside the JSON object.`;
}

// ── Mock result ──────────────────────────────────────────────────────────────

function mockResult(engine: EvaluationEngine): EvaluationResult {
  return {
    accuracy_score: 80,
    hallucinations_detected: [
      `Mock evaluation — no ${ENGINE_KEY_NAMES[engine]} is configured.`,
      'Set the API key and re-run the audit to get real results.',
    ],
    response_text: `[MOCK] Simulated ${engine} response. Configure the API key to run a real audit.`,
  };
}

// ── Single-engine caller ─────────────────────────────────────────────────────

export async function callEngine(
  engine: EvaluationEngine,
  prompt: string,
): Promise<EvaluationResult> {
  const provider = ENGINE_PROVIDER[engine];

  if (!hasApiKey(provider)) {
    return mockResult(engine);
  }

  try {
    const modelKey = `truth-audit-${engine}` as const;
    const { text } = await generateText({
      model: getModel(modelKey),
      prompt,
    });

    // Extract JSON from potential markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      accuracy_score: Math.min(100, Math.max(0, Number(parsed.accuracy_score ?? 0))),
      hallucinations_detected: Array.isArray(parsed.hallucinations_detected)
        ? (parsed.hallucinations_detected as string[])
        : [],
      response_text: String(parsed.response_text ?? text),
    };
  } catch (err) {
    Sentry.captureException(err, { tags: { file: 'multi-engine-eval.service.ts', sprint: 'A' } });
    return mockResult(engine);
  }
}

// ── Multi-engine runner ──────────────────────────────────────────────────────

/**
 * Runs all 4 AI engines in parallel using Promise.allSettled.
 * Returns results for engines that succeeded; failed engines are skipped.
 */
export async function runAllEngines(
  location: MultiEngineEvalInput,
): Promise<EngineEvaluation[]> {
  const promptText = buildEvalPrompt(location);

  const settled = await Promise.allSettled(
    EVALUATION_ENGINES.map(async (engine) => {
      const result = await callEngine(engine, promptText);
      return { engine, result };
    }),
  );

  return settled
    .filter((s): s is PromiseFulfilledResult<EngineEvaluation> => s.status === 'fulfilled')
    .map((s) => s.value);
}
