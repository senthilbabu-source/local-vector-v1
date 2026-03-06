-- ---------------------------------------------------------------------------
-- S17 — Content → SOV Feedback Loop publish rank columns (Wave 2, AI_RULES §217)
--
-- Adds two columns to content_drafts:
--   pre_publish_rank  — citation rank_position snapshot at publish time
--   post_publish_rank — citation rank_position after next SOV scan post-publish
--
-- published_at already exists from 20260224000001_content_pipeline.sql.
-- rank values mirror sov_evaluations.rank_position (0.0–1.0 or null).
-- ---------------------------------------------------------------------------

ALTER TABLE content_drafts
  ADD COLUMN IF NOT EXISTS pre_publish_rank  numeric(5,2),
  ADD COLUMN IF NOT EXISTS post_publish_rank numeric(5,2);

COMMENT ON COLUMN content_drafts.pre_publish_rank  IS
  'SOV citation rank for the linked target_query at the time this draft was published';
COMMENT ON COLUMN content_drafts.post_publish_rank IS
  'SOV citation rank for the linked target_query on the first scan after publishing';
