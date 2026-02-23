-- ============================================================
-- Migration: 20260223000003_gbp_integration.sql
-- Description: Google Business Profile OAuth integration tables.
--              RFC: RFC_GBP_ONBOARDING_V2_REPLACEMENT.md (Rev 2)
-- Breaking: No — new tables + nullable column additions only.
-- Depends on: organizations, locations, location_integrations (initial schema)
-- ============================================================

-- ── locations: Add GBP-specific columns ──────────────────────
-- Both columns are nullable — no existing rows broken.

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS google_location_name VARCHAR(255) NULL;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS gbp_integration_id UUID NULL
    REFERENCES public.location_integrations(id) ON DELETE SET NULL;


-- ── google_oauth_tokens ───────────────────────────────────────
-- Per-org GBP OAuth token storage.
--
-- SECURITY:
--   access_token and refresh_token MUST be encrypted before INSERT.
--   Use Supabase Vault (pgsodium) or application-layer AES-256.
--   Service role ONLY. RLS deny-by-default (no CREATE POLICY statements).
--   Never read by browser clients.

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID         NOT NULL UNIQUE
                                 REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Encrypted at rest before INSERT
  access_token      TEXT         NOT NULL,
  refresh_token     TEXT         NOT NULL,

  token_type        VARCHAR(20)  NOT NULL DEFAULT 'Bearer',
  expires_at        TIMESTAMPTZ  NOT NULL,

  -- GBP account info (non-sensitive, plain text)
  gbp_account_name  VARCHAR(255) NULL,   -- "accounts/1234567890"
  google_email      VARCHAR(255) NULL,   -- display only
  scopes            TEXT         NULL,   -- space-separated scope list

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_updated_at_google_oauth_tokens
  BEFORE UPDATE ON public.google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Deny-by-default RLS. No policy = no access for authenticated/anon roles.
ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_oauth_tokens FROM authenticated;
REVOKE ALL ON public.google_oauth_tokens FROM anon;


-- ── pending_gbp_imports ───────────────────────────────────────
-- Short-lived GBP location picker state (replaces cookie-based approach).
-- Exists for max 10 minutes during OAuth flow. Auto-cleaned by daily cron.
--
-- WHY: Browsers enforce 4KB cookie limit. A single GBP location object
-- is ~850 bytes. 5 locations = ~4.25KB → silent cookie drop → infinite
-- OAuth redirect loop. This table has no size limit.

CREATE TABLE IF NOT EXISTS public.pending_gbp_imports (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  locations_data JSONB       NOT NULL,   -- Full GBP locations array
  account_name   VARCHAR(255),           -- "accounts/1234567890"
  has_more       BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at     TIMESTAMPTZ NOT NULL,   -- NOW() + INTERVAL '10 minutes'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_gbp_imports_org
  ON public.pending_gbp_imports(org_id);

-- Cleanup: daily cron runs DELETE FROM pending_gbp_imports WHERE expires_at < NOW()
-- Service role only. No authenticated/anon access.
ALTER TABLE public.pending_gbp_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pending_gbp_imports FROM authenticated;
REVOKE ALL ON public.pending_gbp_imports FROM anon;
REVOKE ALL ON public.pending_gbp_imports FROM authenticated;
REVOKE ALL ON public.pending_gbp_imports FROM anon;
