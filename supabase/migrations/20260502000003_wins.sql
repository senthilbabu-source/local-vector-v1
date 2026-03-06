-- ---------------------------------------------------------------------------
-- S20: Wins Feed (Wave 2, AI_RULES §220)
--
-- Lightweight win-log table: one row per positive action taken by an org
-- (initially: hallucination corrected). Feeds the Wins Feed on the dashboard
-- and the /dashboard/wins full list page.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS wins (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  win_type        text        NOT NULL DEFAULT 'hallucination_fixed',
  title           text        NOT NULL,
  detail          text,
  revenue_impact  numeric(10,2),
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS wins_org_id_created_at_idx
  ON wins (org_id, created_at DESC);

ALTER TABLE wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wins_select_own"
  ON wins FOR SELECT
  USING (org_id = (
    SELECT org_id FROM memberships WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "wins_insert_own"
  ON wins FOR INSERT
  WITH CHECK (org_id = (
    SELECT org_id FROM memberships WHERE user_id = auth.uid() LIMIT 1
  ));
