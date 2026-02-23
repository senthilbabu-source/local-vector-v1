-- ============================================================
-- Migration: 20260223000001_sov_engine.sql
-- Description: SOV Engine — creates sov_target_queries and
--              sov_first_mover_alerts tables.
-- Spec: 04c-SOV-ENGINE.md
-- Breaking: No — new tables only.
-- Depends on: organizations, locations tables (initial schema)
-- ============================================================

-- ── sov_target_queries ────────────────────────────────────────
-- Stores the library of local AI prompts per location.
-- System-generated queries seeded at location setup.
-- Custom queries allowed on Growth+ plans.

CREATE TABLE IF NOT EXISTS public.sov_target_queries (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id     UUID          NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,

  -- The query text fired against Perplexity Sonar
  query_text      TEXT          NOT NULL,

  -- Taxonomy
  query_category  VARCHAR(50)   NOT NULL
    CHECK (query_category IN ('discovery', 'comparison', 'occasion', 'near_me', 'custom')),
  occasion_tag    VARCHAR(50)   NULL,       -- 'birthday' | 'date_night' | 'bachelorette' | NULL
  intent_modifier VARCHAR(50)   NULL,       -- 'late_night' | 'with_parking' | NULL

  -- Source
  is_system_generated  BOOLEAN  NOT NULL DEFAULT TRUE,
  is_active            BOOLEAN  NOT NULL DEFAULT TRUE,

  -- Execution tracking (updated by SOV cron after each run)
  last_run_at          TIMESTAMPTZ  NULL,
  last_sov_result      FLOAT        NULL,   -- most recent SOV % for this query (0–100)
  last_cited           BOOLEAN      NULL,   -- was our business mentioned in last run?
  run_count            INTEGER      NOT NULL DEFAULT 0,

  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Prevent duplicate queries per location
  UNIQUE(location_id, query_text)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sov_queries_org
  ON public.sov_target_queries(org_id);

CREATE INDEX IF NOT EXISTS idx_sov_queries_location_active
  ON public.sov_target_queries(location_id, is_active)
  WHERE is_active = TRUE;

-- Cron picks up queries not yet run or last run > 6 days ago
CREATE INDEX IF NOT EXISTS idx_sov_queries_last_run
  ON public.sov_target_queries(last_run_at ASC NULLS FIRST);

-- Auto-update timestamps
CREATE TRIGGER set_updated_at_sov_target_queries
  BEFORE UPDATE ON public.sov_target_queries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.sov_target_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.sov_target_queries
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_insert" ON public.sov_target_queries
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.sov_target_queries
  FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON public.sov_target_queries
  FOR DELETE USING (org_id = public.current_user_org_id());


-- ── sov_first_mover_alerts ────────────────────────────────────
-- Created by the SOV cron when a query returns zero local business citations.
-- Feeds the First Mover Alert feed in the dashboard (Doc 06 Section 10).
-- Can optionally trigger an Autopilot content draft (Doc 19).

CREATE TABLE IF NOT EXISTS public.sov_first_mover_alerts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id  UUID         REFERENCES public.locations(id) ON DELETE SET NULL,
  query_id     UUID         REFERENCES public.sov_target_queries(id) ON DELETE CASCADE,
  query_text   TEXT         NOT NULL,    -- denormalized for display after query deletion
  detected_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  status       VARCHAR(20)  NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'actioned', 'dismissed')),
  actioned_at  TIMESTAMPTZ  NULL,

  -- One alert per query per org — upsert on conflict
  UNIQUE(org_id, query_id)
);

ALTER TABLE public.sov_first_mover_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON public.sov_first_mover_alerts
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_update" ON public.sov_first_mover_alerts
  FOR UPDATE USING (org_id = public.current_user_org_id());
