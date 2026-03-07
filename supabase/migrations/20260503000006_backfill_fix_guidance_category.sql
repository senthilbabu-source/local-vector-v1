-- Backfill fix_guidance_category from category for all existing hallucinations.
-- Previously, the audit cron inserted hallucinations without setting this column,
-- so the FixGuidancePanel never rendered step-by-step fix instructions.
UPDATE public.ai_hallucinations
SET fix_guidance_category = category
WHERE fix_guidance_category IS NULL
  AND category IS NOT NULL;
