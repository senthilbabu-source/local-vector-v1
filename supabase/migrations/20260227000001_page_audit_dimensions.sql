-- Sprint 71: Add missing dimension score columns to page_audits
-- The auditor computes 5 dimension scores but only 3 were persisted.
-- faq_schema_score and entity_clarity_score were lost after audit.

ALTER TABLE public.page_audits
  ADD COLUMN IF NOT EXISTS faq_schema_score INTEGER,
  ADD COLUMN IF NOT EXISTS entity_clarity_score INTEGER;

-- Backfill: For rows where faq_schema_present is known, derive score
-- faq_schema_present=true with unknown count → estimate 40 (1-2 items)
-- faq_schema_present=false → 0
UPDATE public.page_audits
SET faq_schema_score = CASE
  WHEN faq_schema_present = TRUE THEN 40
  WHEN faq_schema_present = FALSE THEN 0
  ELSE NULL
END
WHERE faq_schema_score IS NULL;

-- entity_clarity_score: No data to backfill from. Leave NULL.
-- NULL scores will display as "—" (pending) per AI_RULES §20.
