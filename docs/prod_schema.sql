-- ============================================================
-- LOCALVECTOR.AI — COMPLETE CLEAN SCHEMA
-- Version: 2.6 (Added location_integrations — required by migration 20260223000003)
-- Target: Supabase PostgreSQL
-- ============================================================

-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- 2. CUSTOM TYPES (ENUMS)
-- ============================================================
DO $$
BEGIN
  -- Plan Tiers
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
    CREATE TYPE plan_tier AS ENUM ('trial', 'starter', 'growth', 'agency');
  END IF;

  -- Plan Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_status') THEN
    CREATE TYPE plan_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'paused');
  END IF;

  -- Membership Roles
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role') THEN
    CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;

  -- Hallucination Severity
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hallucination_severity') THEN
    CREATE TYPE hallucination_severity AS ENUM ('critical', 'high', 'medium', 'low');
  END IF;

  -- Correction Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'correction_status') THEN
    CREATE TYPE correction_status AS ENUM ('open', 'verifying', 'fixed', 'dismissed', 'recurring');
  END IF;

  -- Audit Prompt Types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_prompt_type') THEN
    CREATE TYPE audit_prompt_type AS ENUM ('status_check', 'hours_check', 'amenity_check', 'menu_check', 'recommendation');
  END IF;

  -- Model Providers
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'model_provider') THEN
    CREATE TYPE model_provider AS ENUM ('openai-gpt4o', 'perplexity-sonar', 'google-gemini', 'anthropic-claude', 'microsoft-copilot');
  END IF;

  -- Listing Sync Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
    CREATE TYPE sync_status AS ENUM ('synced', 'mismatch', 'not_linked', 'error', 'needs_auth');
  END IF;

  -- Magic Menu Processing Status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'menu_processing_status') THEN
    CREATE TYPE menu_processing_status AS ENUM ('uploading', 'processing', 'review_ready', 'published', 'failed');
  END IF;
END $$;

-- 3. CORE TABLES (Level 0 - No Dependencies)
-- ============================================================

-- Users (Mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_provider_id UUID NOT NULL UNIQUE,  -- Maps to auth.users.id
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Directories (Global Reference)
CREATE TABLE IF NOT EXISTS public.directories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  base_url TEXT,
  is_priority BOOLEAN DEFAULT FALSE,
  feeds_ai_models BOOLEAN DEFAULT FALSE,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TENANT TABLES (Level 1 - Depends on Level 0)
-- ============================================================

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_user_id UUID, -- References users(id), constraint added later or kept loose to prevent cycle
  
  -- Billing
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan plan_tier DEFAULT 'trial',
  plan_status plan_status DEFAULT 'trialing',

  -- Limits
  max_locations INTEGER DEFAULT 1,
  audit_frequency VARCHAR(20) DEFAULT 'weekly',
  max_ai_audits_per_month INTEGER DEFAULT 4,
  ai_audits_used_this_month INTEGER DEFAULT 0,
  current_billing_period_start TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships (Join Table: Users <-> Orgs)
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role membership_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

-- 5. LOCATION DATA (Level 2 - Depends on Orgs)
-- ============================================================

-- Locations
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,

  -- Ground Truth
  business_name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',
  phone VARCHAR(50),
  website_url TEXT,
  google_place_id VARCHAR(255),
  place_details_refreshed_at TIMESTAMPTZ DEFAULT NOW(),

  -- JSONB Data
  hours_data JSONB,
  amenities JSONB,
  categories JSONB,
  attributes JSONB,
  
  operational_status VARCHAR(50) DEFAULT 'OPERATIONAL',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, slug)
);

-- Business Info (Legacy - kept for migration safety)
CREATE TABLE IF NOT EXISTS public.business_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  website_url TEXT,
  hours_data JSONB,
  amenities JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ENGINE TABLES (Level 3 - Depends on Locations/Orgs)
-- ============================================================

-- AI Audits (Fear Engine)
CREATE TABLE IF NOT EXISTS public.ai_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  model_provider model_provider NOT NULL,
  prompt_type audit_prompt_type NOT NULL,
  prompt_text TEXT,
  raw_response TEXT,
  response_metadata JSONB,
  is_hallucination_detected BOOLEAN DEFAULT FALSE,
  audit_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Hallucinations (Fear Engine - Depends on Audits)
CREATE TABLE IF NOT EXISTS public.ai_hallucinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES public.ai_audits(id) ON DELETE SET NULL,
  severity hallucination_severity DEFAULT 'high',
  category VARCHAR(50),
  model_provider model_provider NOT NULL,
  claim_text TEXT NOT NULL,
  expected_truth TEXT,
  correction_status correction_status DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  propagation_events JSONB DEFAULT '[]'::jsonb,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitors (Greed Engine)
CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  competitor_address TEXT,
  competitor_google_place_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor Intercepts (Greed Engine)
CREATE TABLE IF NOT EXISTS public.competitor_intercepts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  query_asked VARCHAR(500),
  model_provider model_provider NOT NULL,
  winner VARCHAR(255),
  winner_reason TEXT,
  winning_factor VARCHAR(255),
  gap_analysis JSONB,
  gap_magnitude VARCHAR(20),
  suggested_action TEXT,
  action_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Magic Menus (Magic Engine)
CREATE TABLE IF NOT EXISTS public.magic_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  source_url TEXT,
  source_type VARCHAR(20),
  processing_status menu_processing_status DEFAULT 'uploading',
  extracted_data JSONB,
  extraction_confidence FLOAT,
  json_ld_schema JSONB,
  human_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT FALSE,
  public_slug VARCHAR(100),
  page_views INTEGER DEFAULT 0,
  last_crawled_by JSONB,
  ai_readability_score FLOAT CHECK (ai_readability_score >= 0 AND ai_readability_score <= 100),
  llms_txt_content TEXT,
  propagation_events JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items (Magic Engine - Depends on Menus)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.magic_menus(id) ON DELETE CASCADE,
  category VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2),
  price_note VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'USD',
  dietary_tags JSONB,
  is_available BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawler Hits (Magic Engine - Analytics)
CREATE TABLE IF NOT EXISTS public.crawler_hits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.magic_menus(id) ON DELETE CASCADE,
  bot_type VARCHAR(50) NOT NULL,
  user_agent TEXT,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listings (Depends on Directories)
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  directory_id UUID NOT NULL REFERENCES public.directories(id),
  listing_url TEXT,
  sync_status sync_status DEFAULT 'not_linked',
  nap_name VARCHAR(255),
  nap_address TEXT,
  nap_phone VARCHAR(50),
  nap_consistency_score INTEGER,
  last_checked_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  error_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, location_id, directory_id)
);

-- Location Integrations (Third-Party Connections: GBP, WordPress, etc.)
-- Created in migration 20260221000002. Required by migration 20260223000003_gbp_integration.sql.
CREATE TABLE IF NOT EXISTS public.location_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  integration_type VARCHAR(50) NOT NULL,  -- 'google' | 'wordpress' | 'apple' | 'bing'
  platform VARCHAR(20),                   -- legacy alias for integration_type
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connected', 'syncing', 'error')),
  external_id VARCHAR(255),               -- GBP location resource name or external platform ID (non-sensitive, plain text)
  credentials JSONB,                      -- Encrypted at application layer before storage. Service role only.
  last_sync_at TIMESTAMPTZ,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, location_id, integration_type)
);

-- Visibility Scores
CREATE TABLE IF NOT EXISTS public.visibility_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  visibility_score FLOAT,
  accuracy_score FLOAT,
  data_health_score FLOAT,
  reality_score FLOAT,
  score_delta FLOAT,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, location_id, snapshot_date)
);

-- Visibility Analytics (AEO)
CREATE TABLE IF NOT EXISTS public.visibility_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  share_of_voice FLOAT,
  citation_rate FLOAT,
  sentiment_gap FLOAT,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, location_id, snapshot_date)
);

-- 7. HELPER FUNCTIONS (Must be before Policies)
-- ============================================================

-- Function: Get current user's org_id
-- CRITICAL: Relies on table 'memberships' existing
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
  SELECT m.org_id
  FROM public.memberships m
  WHERE m.user_id = (
    SELECT u.id FROM public.users u WHERE u.auth_provider_id = auth.uid()
  )
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 8. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hallucinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_intercepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visibility_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visibility_analytics ENABLE ROW LEVEL SECURITY;
-- Note: directories is generally public read, or service role only for updates.
ALTER TABLE public.directories ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Users
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.users FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile."
  ON public.users FOR UPDATE USING (auth.uid() = auth_provider_id);

-- Directories
CREATE POLICY "Directories are viewable by everyone" 
  ON public.directories FOR SELECT USING (true);

-- Organizations
CREATE POLICY "org_isolation_select" ON public.organizations
  FOR SELECT USING (id = public.current_user_org_id());

-- Locations
CREATE POLICY "org_isolation_select" ON public.locations
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_insert" ON public.locations
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON public.locations
  FOR UPDATE USING (org_id = public.current_user_org_id());

-- Business Info
CREATE POLICY "org_isolation_select" ON public.business_info
  FOR SELECT USING (org_id = public.current_user_org_id());

-- AI Audits
CREATE POLICY "org_isolation_select" ON public.ai_audits
  FOR SELECT USING (org_id = public.current_user_org_id());

-- AI Hallucinations
CREATE POLICY "org_isolation_select" ON public.ai_hallucinations
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON public.ai_hallucinations
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON public.ai_hallucinations
  FOR DELETE USING (org_id = public.current_user_org_id());

-- Competitors
CREATE POLICY "org_isolation_select" ON public.competitors
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_insert" ON public.competitors
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON public.competitors
  FOR DELETE USING (org_id = public.current_user_org_id());

-- Competitor Intercepts
CREATE POLICY "org_isolation_select" ON public.competitor_intercepts
  FOR SELECT USING (org_id = public.current_user_org_id());

-- Magic Menus
CREATE POLICY "org_isolation_select" ON public.magic_menus
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON public.magic_menus
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON public.magic_menus
  FOR DELETE USING (org_id = public.current_user_org_id());
CREATE POLICY "public_published_menus" ON public.magic_menus
  FOR SELECT USING (is_published = TRUE);
-- Policy for Link Injection updates
CREATE POLICY "tenant_link_injection_update" ON public.magic_menus
  FOR UPDATE USING (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- Menu Items
CREATE POLICY "org_isolation_select" ON public.menu_items
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON public.menu_items
  FOR DELETE USING (org_id = public.current_user_org_id());
CREATE POLICY "public_menu_items" ON public.menu_items
  FOR SELECT USING (
    menu_id IN (SELECT id FROM public.magic_menus WHERE is_published = TRUE)
  );

-- Crawler Hits
CREATE POLICY "org_isolation_select" ON public.crawler_hits
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "service_role_insert" ON public.crawler_hits
  FOR INSERT WITH CHECK (true);

-- Listings
CREATE POLICY "org_isolation_select" ON public.listings
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON public.listings
  FOR UPDATE USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON public.listings
  FOR DELETE USING (org_id = public.current_user_org_id());

-- Visibility
CREATE POLICY "org_isolation_select" ON public.visibility_scores
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_select" ON public.visibility_analytics
  FOR SELECT USING (org_id = public.current_user_org_id());

-- 9. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_org ON public.locations(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_slug ON public.locations(org_id, slug);
CREATE INDEX IF NOT EXISTS idx_audits_org ON public.ai_audits(org_id);
CREATE INDEX IF NOT EXISTS idx_audits_date ON public.ai_audits(org_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_hallucinations_org ON public.ai_hallucinations(org_id);
CREATE INDEX IF NOT EXISTS idx_hallucinations_open ON public.ai_hallucinations(org_id, correction_status) WHERE correction_status = 'open';
CREATE INDEX IF NOT EXISTS idx_intercepts_org ON public.competitor_intercepts(org_id);
CREATE INDEX IF NOT EXISTS idx_competitors_org ON public.competitors(org_id);
CREATE INDEX IF NOT EXISTS idx_magic_menu_slug ON public.magic_menus(public_slug) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON public.menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_crawler_hits_menu_bot ON public.crawler_hits(menu_id, bot_type, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_org ON public.listings(org_id);
CREATE INDEX IF NOT EXISTS idx_visibility_org_date ON public.visibility_scores(org_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_analytics_org_date ON public.visibility_analytics(org_id, snapshot_date DESC);

-- 10. TRIGGERS & AUTOMATION
-- ============================================================

-- A. Timestamp Updater
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_locations BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_magic_menus BEFORE UPDATE ON public.magic_menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_listings BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_menu_items BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- B. Handle New User Signup (Creates Org & Membership)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  org_slug VARCHAR(100);
BEGIN
  -- Generate slug from email prefix
  org_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = org_slug) THEN
    org_slug := org_slug || '-' || SUBSTRING(uuid_generate_v4()::text FROM 1 FOR 8);
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name, slug, owner_user_id)
  VALUES (COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Venue', org_slug, NEW.id)
  RETURNING id INTO new_org_id;

  -- Create membership (owner role)
  INSERT INTO public.memberships (user_id, org_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- C. Handle Auth User Created (Syncs auth.users -> public.users)
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_provider_id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (auth_provider_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger on auth.users (Standard Supabase Pattern)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- D. Reset Monthly Audits
CREATE OR REPLACE FUNCTION reset_monthly_audit_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_billing_period_start IS DISTINCT FROM OLD.current_billing_period_start THEN
    NEW.ai_audits_used_this_month := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reset_audit_counter BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION reset_monthly_audit_counter();

-- E. Google ToS Compliance (30 Day Refresh)
CREATE OR REPLACE FUNCTION trigger_google_tos_refresh()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.place_details_refreshed_at < NOW() - INTERVAL '30 days' THEN
    PERFORM net.http_post(
      url:='https://<project>.supabase.co/functions/v1/refresh-google-data',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body:=jsonb_build_object('location_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('menus', 'menus', false) 
ON CONFLICT DO NOTHING;

CREATE POLICY "Tenant Upload Access" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menus' AND 
    (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

CREATE POLICY "Tenant Read Access" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'menus' AND 
    (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

-- 12. SEED DATA
-- ============================================================

-- Directories
INSERT INTO public.directories (name, display_name, base_url, is_priority, feeds_ai_models) VALUES
  ('google', 'Google Business Profile', 'https://business.google.com', TRUE, TRUE),
  ('yelp', 'Yelp', 'https://biz.yelp.com', TRUE, TRUE),
  ('apple', 'Apple Maps (Apple Business Connect)', 'https://businessconnect.apple.com', TRUE, TRUE),
  ('facebook', 'Facebook', 'https://business.facebook.com', TRUE, TRUE),
  ('tripadvisor', 'TripAdvisor', 'https://tripadvisor.com', TRUE, TRUE),
  ('bing', 'Bing Places', 'https://bingplaces.com', TRUE, TRUE),
  ('opentable', 'OpenTable', 'https://restaurant.opentable.com', FALSE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Golden Tenant & Location
INSERT INTO public.organizations (id, name, slug, plan, plan_status, audit_frequency, max_locations, onboarding_completed)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Charcoal N Chill', 
  'charcoal-n-chill', 
  'growth', 
  'active', 
  'daily', 
  1,
  TRUE
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.locations (
  org_id, name, slug, is_primary, business_name, address_line1, city, state, zip, country, phone, website_url, operational_status, hours_data, amenities, categories, google_place_id
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Charcoal N Chill - Alpharetta', 
  'alpharetta', 
  TRUE,
  'Charcoal N Chill', 
  '11950 Jones Bridge Road Ste 103', 
  'Alpharetta', 
  'GA', 
  '30005',
  'US',
  '(470) 546-4866', 
  'https://charcoalnchill.com', 
  'OPERATIONAL',
  '{
    "monday": {"open": "17:00", "close": "23:00"},
    "tuesday": {"open": "17:00", "close": "23:00"},
    "wednesday": {"open": "17:00", "close": "23:00"},
    "thursday": {"open": "17:00", "close": "00:00"},
    "friday": {"open": "17:00", "close": "01:00"},
    "saturday": {"open": "17:00", "close": "01:00"},
    "sunday": {"open": "17:00", "close": "23:00"}
  }'::jsonb,
  '{
    "has_outdoor_seating": true,
    "serves_alcohol": true,
    "has_hookah": true,
    "is_kid_friendly": false,
    "takes_reservations": true,
    "has_live_music": true,
    "has_dj": true,
    "has_private_rooms": true
  }'::jsonb,
  '["Hookah Bar", "Indian Restaurant", "Fusion Restaurant", "Lounge", "Nightlife"]'::jsonb,
  'ChIJi8-1ywdO9YgR9s5j-y0_1lI'
) ON CONFLICT (org_id, slug) DO NOTHING;

-- Test User
INSERT INTO public.users (auth_provider_id, email, full_name)
VALUES (
  'test-owner-uid-123', 
  'aruna@charcoalnchill.com', 
  'Aruna (Founder)'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO public.memberships (user_id, org_id, role)
SELECT id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'owner'
FROM public.users WHERE email = 'aruna@charcoalnchill.com'
ON CONFLICT (user_id, org_id) DO NOTHING;