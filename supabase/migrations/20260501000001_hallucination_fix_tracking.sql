-- ---------------------------------------------------------------------------
-- S14 — Hallucination fix tracking columns (Wave 1, AI_RULES §214)
--
-- Adds four columns to ai_hallucinations:
--   fixed_at                — when the user submitted the correction
--   verified_at             — when the cron confirmed the fix propagated
--   revenue_recovered_monthly — snapshotted revenue impact at fix time
--   fix_guidance_category   — maps to fix-guidance.ts lookup for UI steps
--
-- Backfills existing corrected/fixed rows so historical data is usable.
-- ---------------------------------------------------------------------------

ALTER TABLE ai_hallucinations
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS revenue_recovered_monthly numeric(10,2),
  ADD COLUMN IF NOT EXISTS fix_guidance_category text;

-- Backfill fixed_at from corrected/fixed rows using created_at as proxy
UPDATE ai_hallucinations
  SET fixed_at = created_at
  WHERE correction_status IN ('corrected', 'fixed')
    AND fixed_at IS NULL
    AND created_at IS NOT NULL;

-- Backfill verified_at from rows already confirmed fixed by the cron
UPDATE ai_hallucinations
  SET verified_at = follow_up_checked_at
  WHERE correction_status = 'fixed'
    AND follow_up_result = 'fixed'
    AND verified_at IS NULL
    AND follow_up_checked_at IS NOT NULL;

-- Backfill fix_guidance_category from existing category values
-- (category column already exists; fix_guidance_category is the mapped key)
UPDATE ai_hallucinations
  SET fix_guidance_category = LOWER(category)
  WHERE fix_guidance_category IS NULL
    AND category IS NOT NULL
    AND LOWER(category) IN ('hours', 'closed', 'address', 'phone', 'menu', 'cuisine');
