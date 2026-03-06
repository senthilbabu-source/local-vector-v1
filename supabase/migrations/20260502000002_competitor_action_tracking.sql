-- ---------------------------------------------------------------------------
-- S19: Competitor Gap Before/After (Wave 2, AI_RULES §219)
--
-- Adds two columns to competitor_intercepts:
--   pre_action_gap     — JSONB snapshot of gap_analysis at the moment the
--                        user marks an intercept 'completed'
--   action_completed_at — timestamp when the action was completed
-- ---------------------------------------------------------------------------

ALTER TABLE competitor_intercepts
  ADD COLUMN IF NOT EXISTS pre_action_gap      jsonb,
  ADD COLUMN IF NOT EXISTS action_completed_at timestamptz;
