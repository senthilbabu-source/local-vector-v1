-- ============================================================
-- Migration: 20260302000002_occasion_snooze_sidebar_badges.sql
-- Sprint 101: Occasion snooze tracking + sidebar badge state
-- ============================================================

-- -------------------------------------------------------
-- 1. Occasion snooze tracking
--    Tracks per-user, per-occasion snooze/dismiss state.
--    Permanent dismiss uses far-future snoozed_until.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS occasion_snoozes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occasion_id     uuid NOT NULL REFERENCES local_occasions(id) ON DELETE CASCADE,
  snoozed_until   timestamptz NOT NULL,
  snoozed_at      timestamptz NOT NULL DEFAULT now(),
  snooze_count    integer NOT NULL DEFAULT 1,
  UNIQUE (org_id, user_id, occasion_id)
);

ALTER TABLE occasion_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occasion_snoozes_select" ON occasion_snoozes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "occasion_snoozes_insert" ON occasion_snoozes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "occasion_snoozes_update" ON occasion_snoozes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "occasion_snoozes_delete" ON occasion_snoozes
  FOR DELETE USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 2. Sidebar badge last-seen tracking
--    Tracks when a user last "saw" each badge section.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS sidebar_badge_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section         text NOT NULL CHECK (section IN ('content_drafts', 'visibility')),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, section)
);

ALTER TABLE sidebar_badge_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sidebar_badge_state_all" ON sidebar_badge_state
  FOR ALL USING (user_id = auth.uid());

-- -------------------------------------------------------
-- 3. Indexes
-- -------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_occasion_snoozes_org_user
  ON occasion_snoozes(org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_occasion_snoozes_snoozed_until
  ON occasion_snoozes(snoozed_until);

CREATE INDEX IF NOT EXISTS idx_sidebar_badge_state_lookup
  ON sidebar_badge_state(org_id, user_id, section);
