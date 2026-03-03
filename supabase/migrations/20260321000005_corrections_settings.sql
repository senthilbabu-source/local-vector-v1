-- Sprint 121: Correction Follow-up + Settings Expansion
-- Migration: 20260321000002_corrections_settings.sql

-- ---------------------------------------------------------------------------
-- 1. Add 'corrected' to correction_status enum (ai_hallucinations.correction_status)
-- ---------------------------------------------------------------------------
ALTER TYPE public.correction_status ADD VALUE IF NOT EXISTS 'corrected';

-- Add corrected_at column to ai_hallucinations
ALTER TABLE public.ai_hallucinations
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. correction_follow_ups table — tracks correction lifecycle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.correction_follow_ups (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hallucination_id      uuid        NOT NULL UNIQUE
                                    REFERENCES public.ai_hallucinations(id)
                                    ON DELETE CASCADE,
  org_id                uuid        NOT NULL
                                    REFERENCES public.organizations(id)
                                    ON DELETE CASCADE,
  correction_brief_id   uuid        REFERENCES public.content_drafts(id)
                                    ON DELETE SET NULL,
  rescan_due_at         timestamptz NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  rescan_completed_at   timestamptz,
  rescan_status         text        NOT NULL DEFAULT 'pending'
                                    CHECK (rescan_status IN (
                                      'pending','cleared','persists','inconclusive'
                                    )),
  rescan_ai_response    text,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correction_follow_ups_org_id
  ON public.correction_follow_ups (org_id);

CREATE INDEX IF NOT EXISTS idx_correction_follow_ups_rescan_due
  ON public.correction_follow_ups (rescan_due_at, rescan_status)
  WHERE rescan_status = 'pending';

ALTER TABLE public.correction_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "correction_follow_ups_org_read"
  ON public.correction_follow_ups FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "correction_follow_ups_service_role"
  ON public.correction_follow_ups FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. org_settings table — per-org configurable settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_settings (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid        NOT NULL UNIQUE
                                        REFERENCES public.organizations(id)
                                        ON DELETE CASCADE,
  notify_email_digest       boolean     NOT NULL DEFAULT true,
  notify_slack_webhook_url  text,
  notify_in_app             boolean     NOT NULL DEFAULT true,
  notify_sov_drop_threshold int         NOT NULL DEFAULT 5
                                        CHECK (notify_sov_drop_threshold BETWEEN 1 AND 20),
  scan_frequency            text        NOT NULL DEFAULT 'weekly'
                                        CHECK (scan_frequency IN ('weekly','bi-weekly','monthly')),
  created_at                timestamptz NOT NULL DEFAULT NOW(),
  updated_at                timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_settings_org_read"
  ON public.org_settings FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_settings_admin_update"
  ON public.org_settings FOR UPDATE
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = public.current_user_org_id()
        AND m.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND m.role IN ('owner','admin')
    )
  );

CREATE POLICY "org_settings_service_role"
  ON public.org_settings FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. org_api_keys table — Agency plan API key management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL
                            REFERENCES public.organizations(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  key_prefix    text        NOT NULL,
  key_hash      text        NOT NULL,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at  timestamptz,
  expires_at    timestamptz,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_org_api_keys_org_id
  ON public.org_api_keys (org_id) WHERE is_active = true;

ALTER TABLE public.org_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_api_keys_org_read"
  ON public.org_api_keys FOR SELECT
  USING (org_id = public.current_user_org_id());

CREATE POLICY "org_api_keys_owner_manage"
  ON public.org_api_keys FOR ALL
  USING (
    org_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = public.current_user_org_id()
        AND m.user_id = (
          SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
        )
        AND m.role = 'owner'
    )
  );

CREATE POLICY "org_api_keys_service_role"
  ON public.org_api_keys FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. Backfill org_settings for existing orgs
-- ---------------------------------------------------------------------------
INSERT INTO public.org_settings (org_id)
SELECT id FROM public.organizations
ON CONFLICT (org_id) DO NOTHING;
