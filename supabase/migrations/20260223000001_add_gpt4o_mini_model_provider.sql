-- ---------------------------------------------------------------------------
-- Migration: add 'openai-gpt4o-mini' to the model_provider enum
--
-- Phase 3 (Competitor Intercept) uses GPT-4o-mini for the intercept analysis
-- stage. The original enum only contained the five providers from Phase 0.
-- ---------------------------------------------------------------------------

ALTER TYPE model_provider ADD VALUE IF NOT EXISTS 'openai-gpt4o-mini';
