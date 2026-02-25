import { z } from 'zod';

/**
 * The four LLM engines supported by the AI Truth Audit.
 * Exported as a const tuple so both Zod schemas and UI components
 * derive typed arrays from a single source of truth.
 */
export const EVALUATION_ENGINES = ['openai', 'perplexity', 'anthropic', 'gemini'] as const;
export type EvaluationEngine = (typeof EVALUATION_ENGINES)[number];

/**
 * Schema for triggering an on-demand AI evaluation for a location.
 *
 * `location_id` comes from the UI context (not user-typed).
 * `engine` is selected from a fixed set of allowed values.
 * Both are validated here so the Server Action has a single trusted parse path.
 */
export const RunEvaluationSchema = z.object({
  location_id: z.string().uuid('A valid location ID is required'),
  engine: z.enum(EVALUATION_ENGINES, {
    message: 'Engine must be openai, perplexity, anthropic, or gemini',
  }),
});

export type RunEvaluationInput = z.infer<typeof RunEvaluationSchema>;

/**
 * Schema for the verifyHallucinationFix Server Action.
 *
 * Accepts the UUID of the ai_hallucinations row to re-check.
 * The org_id is never accepted from the client — RLS scopes the fetch.
 */
export const VerifyHallucinationSchema = z.object({
  hallucination_id: z.string().uuid('A valid hallucination ID is required'),
});

export type VerifyHallucinationInput = z.infer<typeof VerifyHallucinationSchema>;

/**
 * Schema for triggering a multi-engine Truth Audit.
 * Runs all four engines in parallel for the given location.
 */
export const RunMultiAuditSchema = z.object({
  location_id: z.string().uuid('A valid location ID is required'),
});

export type RunMultiAuditInput = z.infer<typeof RunMultiAuditSchema>;
