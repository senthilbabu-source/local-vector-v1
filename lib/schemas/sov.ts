import { z } from 'zod';

// ---------------------------------------------------------------------------
// Engine enum — mirrors the evaluations schema so both features share the
// same allowed set of LLM engines.
// ---------------------------------------------------------------------------

export const SOV_ENGINES = ['openai', 'perplexity'] as const;
export type SovEngine = (typeof SOV_ENGINES)[number];

// ---------------------------------------------------------------------------
// addTargetQuery input
// ---------------------------------------------------------------------------

export const AddQuerySchema = z.object({
  location_id: z.string().uuid('A valid location ID is required'),
  query_text: z
    .string()
    .min(3, 'Query must be at least 3 characters')
    .max(500, 'Query must be at most 500 characters'),
});

export type AddQueryInput = z.infer<typeof AddQuerySchema>;

// ---------------------------------------------------------------------------
// runSovEvaluation input
// ---------------------------------------------------------------------------

export const RunSovSchema = z.object({
  query_id: z.string().uuid('A valid query ID is required'),
  engine: z.enum(SOV_ENGINES, {
    message: 'Engine must be openai or perplexity',
  }),
});

export type RunSovInput = z.infer<typeof RunSovSchema>;
