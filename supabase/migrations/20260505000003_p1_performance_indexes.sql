-- P1 Audit Fix #8-9: Missing composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sov_evaluations_org_created
  ON sov_evaluations (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hallucinations_location
  ON ai_hallucinations (location_id);
