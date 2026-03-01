-- ══════════════════════════════════════════════════════════════
-- Sprint 107: Review Intelligence Engine — New Tables
-- ══════════════════════════════════════════════════════════════

-- 1. brand_voice_profiles — Per-location brand voice config
CREATE TABLE IF NOT EXISTS public.brand_voice_profiles (
  id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid         NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id               uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tone                 text         NOT NULL CHECK (tone IN ('warm','professional','casual','playful'))
                                    DEFAULT 'warm',
  formality            text         NOT NULL CHECK (formality IN ('formal','semi-formal','casual'))
                                    DEFAULT 'semi-formal',
  use_emojis           boolean      NOT NULL DEFAULT false,
  sign_off             text         NOT NULL DEFAULT '— The Team',
  owner_name           text,
  highlight_keywords   text[]       NOT NULL DEFAULT '{}',
  avoid_phrases        text[]       NOT NULL DEFAULT '{}',
  custom_instructions  text,
  derived_from         text         NOT NULL CHECK (derived_from IN ('website_copy','manual','hybrid'))
                                    DEFAULT 'website_copy',
  last_updated_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

ALTER TABLE public.brand_voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_voice_profiles: org members can read and update own"
  ON public.brand_voice_profiles FOR ALL
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "brand_voice_profiles: service role full access"
  ON public.brand_voice_profiles FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.brand_voice_profiles IS
  'Per-location brand voice config for AI response generation. Sprint 107.';

-- ──────────────────────────────────────────────────────────────

-- 2. reviews — Fetched + analyzed reviews from all platforms
CREATE TABLE IF NOT EXISTS public.reviews (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_review_id       text         NOT NULL,
  platform                 text         NOT NULL CHECK (platform IN ('google','yelp')),
  location_id              uuid         NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  org_id                   uuid         NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewer_name            text         NOT NULL,
  reviewer_photo_url       text,
  rating                   integer      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text                     text         NOT NULL DEFAULT '',
  published_at             timestamptz  NOT NULL,
  platform_url             text,

  -- Sentiment analysis
  sentiment_label          text         NOT NULL CHECK (sentiment_label IN ('positive','neutral','negative'))
                                        DEFAULT 'neutral',
  sentiment_score          numeric(3,2) CHECK (sentiment_score BETWEEN -1 AND 1),
  keywords                 text[]       NOT NULL DEFAULT '{}',
  topics                   jsonb        NOT NULL DEFAULT '[]'::jsonb,

  -- Response tracking
  response_draft           text,
  response_status          text         NOT NULL
    CHECK (response_status IN ('pending_draft','draft_ready','pending_approval','approved','published','skipped'))
    DEFAULT 'pending_draft',
  response_published_at    timestamptz,
  response_published_text  text,
  response_error           text,

  -- Metadata
  fetched_at               timestamptz  NOT NULL DEFAULT now(),
  last_updated_at          timestamptz  NOT NULL DEFAULT now(),

  UNIQUE (platform_review_id, platform, location_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews: org members can read own"
  ON public.reviews FOR SELECT
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "reviews: org members can update own"
  ON public.reviews FOR UPDATE
  USING (org_id IN (SELECT org_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "reviews: service role full access"
  ON public.reviews FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_reviews_location_status
  ON public.reviews (location_id, response_status);

CREATE INDEX IF NOT EXISTS idx_reviews_location_published
  ON public.reviews (location_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_unanswered
  ON public.reviews (location_id, rating, response_status)
  WHERE response_status IN ('pending_draft','draft_ready','pending_approval');

CREATE INDEX IF NOT EXISTS idx_reviews_platform
  ON public.reviews (location_id, platform, published_at DESC);

CREATE TRIGGER set_updated_at_reviews
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.reviews IS
  'Reviews fetched from Google and Yelp with sentiment analysis and response tracking. Sprint 107.';

-- ──────────────────────────────────────────────────────────────

-- 3. Add account_id to google_oauth_tokens (needed for GBP Reviews API path)
ALTER TABLE public.google_oauth_tokens
  ADD COLUMN IF NOT EXISTS account_id text;

COMMENT ON COLUMN public.google_oauth_tokens.account_id IS
  'GBP Account ID (accounts/{id}) required for Reviews API path. Populated on first review fetch. Sprint 107.';

-- ──────────────────────────────────────────────────────────────

-- 4. Add review health columns to locations
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS review_health_score    integer CHECK (review_health_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS reviews_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_review_count     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating             numeric(2,1) CHECK (avg_rating BETWEEN 1.0 AND 5.0);

COMMENT ON COLUMN public.locations.review_health_score IS
  'Composite 0–100 review signal health score. NULL = never synced. Sprint 107.';
