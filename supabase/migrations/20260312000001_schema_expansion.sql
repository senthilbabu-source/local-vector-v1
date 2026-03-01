-- ══════════════════════════════════════════════════════════════
-- Sprint 106: Schema Expansion Engine — New Tables
-- ══════════════════════════════════════════════════════════════

-- 1. page_schemas — Generated JSON-LD schemas per page per location
--    IMPORTANT: This is a SIBLING to page_audits, not a replacement.
--    page_audits = AEO scores (Doc 17). page_schemas = generated JSON-LD (this sprint).
CREATE TABLE IF NOT EXISTS public.page_schemas (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       uuid        NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id            uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_url          text        NOT NULL,
  page_type         text        NOT NULL CHECK (page_type IN
                    ('homepage','about','faq','event','blog_post','service','other')),
  schema_types      text[]      NOT NULL DEFAULT '{}',
  json_ld           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  embed_snippet     text,
  public_url        text,
  content_hash      text,
  status            text        NOT NULL CHECK (status IN
                    ('draft','pending_review','published','failed','stale'))
                    DEFAULT 'draft',
  human_approved    boolean     NOT NULL DEFAULT false,
  confidence        numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  missing_fields    text[]      NOT NULL DEFAULT '{}',
  validation_errors text[]      NOT NULL DEFAULT '{}',
  generated_at      timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz,
  last_crawled_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, page_url)
);

ALTER TABLE public.page_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_schemas: org members can read own"
  ON public.page_schemas FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "page_schemas: org members can update own"
  ON public.page_schemas FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "page_schemas: service role full access"
  ON public.page_schemas FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_page_schemas_location_status
  ON public.page_schemas (location_id, status);

CREATE INDEX IF NOT EXISTS idx_page_schemas_location_page_type
  ON public.page_schemas (location_id, page_type);

CREATE INDEX IF NOT EXISTS idx_page_schemas_stale
  ON public.page_schemas (location_id, last_crawled_at)
  WHERE status IN ('published', 'stale');

COMMENT ON TABLE public.page_schemas IS
  'Generated JSON-LD schemas per page per location. Sibling to page_audits (which scores pages). Sprint 106.';

-- ──────────────────────────────────────────────────────────────

-- 2. Add schema health columns to locations table
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS schema_health_score    integer CHECK (schema_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS schema_last_run_at     timestamptz,
  ADD COLUMN IF NOT EXISTS website_slug           text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_locations_schema_health
  ON public.locations (org_id, schema_health_score)
  WHERE schema_health_score IS NOT NULL;

COMMENT ON COLUMN public.locations.schema_health_score IS
  'Composite 0–100 schema coverage score across all page types. NULL = never run. Sprint 106.';
COMMENT ON COLUMN public.locations.schema_last_run_at IS
  'Timestamp of last successful schema expansion run. Sprint 106.';
COMMENT ON COLUMN public.locations.website_slug IS
  'URL-safe slug for schema.localvector.ai/{slug}/ routing. Auto-derived from business name. Sprint 106.';
