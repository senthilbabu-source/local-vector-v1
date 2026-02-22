-- ============================================================
-- MIGRATION: 20260221000002_create_integrations
-- Purpose:   Introduce the location_integrations table for
--            tracking third-party API connections per location
--            (Google Business Profile, Apple Business Connect,
--            Bing Places). Includes all four RLS policies.
--
-- Applies after: 20260221000001_public_menu_reads.sql
-- ============================================================

-- ── 1. CREATE location_integrations TABLE ─────────────────────

CREATE TABLE IF NOT EXISTS public.location_integrations (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Tenant isolation — every row belongs to one org
  org_id      UUID          NOT NULL
                            REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- The location this integration is attached to
  location_id UUID          NOT NULL
                            REFERENCES public.locations(id) ON DELETE CASCADE,

  -- Which third-party platform this row represents
  -- Allowed values: 'google' | 'apple' | 'bing'
  platform    VARCHAR(20)   NOT NULL,

  -- Current sync state
  -- Allowed values: 'disconnected' | 'connected' | 'syncing' | 'error'
  status      VARCHAR(20)   NOT NULL DEFAULT 'disconnected',

  -- Timestamp of the most recent successful sync (NULL until first sync)
  last_sync_at TIMESTAMPTZ  NULL,

  -- Optional external identifier (e.g. GBP location ID, Apple listing ID)
  external_id VARCHAR(255)  NULL,

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 2. UNIQUE CONSTRAINT ──────────────────────────────────────
-- A location can only have one connection row per platform.
-- Prevents duplicate rows and makes upsert logic safe.

ALTER TABLE public.location_integrations
  DROP CONSTRAINT IF EXISTS uq_location_platform;

ALTER TABLE public.location_integrations
  ADD CONSTRAINT uq_location_platform
  UNIQUE (location_id, platform);

-- ── 3. INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_location_integrations_org
  ON public.location_integrations(org_id);

CREATE INDEX IF NOT EXISTS idx_location_integrations_location
  ON public.location_integrations(location_id);

-- ── 4. ENABLE RLS ─────────────────────────────────────────────

ALTER TABLE public.location_integrations ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS POLICIES — all four operations ─────────────────────
-- Each policy gates access through current_user_org_id() so that
-- tenants are completely isolated. Without org_id enforcement on
-- INSERT/UPDATE, an attacker could cause silent RLS shadowbans or
-- inject rows into another org's data.

-- SELECT: org members can only read their own integration rows
CREATE POLICY "org_isolation_select" ON public.location_integrations
  FOR SELECT
  USING (org_id = public.current_user_org_id());

-- INSERT: org members can only create integrations for their org
-- CRITICAL: Without this, inserts are silently rejected (RLS Shadowban)
CREATE POLICY "org_isolation_insert" ON public.location_integrations
  FOR INSERT
  WITH CHECK (org_id = public.current_user_org_id());

-- UPDATE: org members can only update their own integration rows
CREATE POLICY "org_isolation_update" ON public.location_integrations
  FOR UPDATE
  USING  (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- DELETE: org members can only delete their own integration rows
CREATE POLICY "org_isolation_delete" ON public.location_integrations
  FOR DELETE
  USING (org_id = public.current_user_org_id());
