# 03 — Database Schema & Migrations

## Complete SQL DDL for LocalVector.ai
## Target: Supabase PostgreSQL
### Version: 2.6 | Date: February 23, 2026
---

> ⚠️ **CRITICAL: SOURCE OF TRUTH WARNING**
> **DO NOT** use the SQL code blocks in this document for migrations or DDL. They are for conceptual reference only and may be outdated.
>
> **The executable, authoritative schema is located in:**
> 📂 `prod_schema.sql`
>
## Editor Configuration
> 🤖 **AI Enforced:** This project includes a `.cursorrules` file that strictly forces the AI to use `supabase/prod_schema.sql` as the database source of truth. You do not need to manually remind the AI of this rule.

> *Refer to this document ONLY for:*
> * *Design Principles*
> * *TypeScript Interfaces / JSONB Shapes*
> * *Entity Relationships*

---

## Usage

Run this entire script in the Supabase SQL Editor to initialize the database, or save as a Supabase migration:

```bash
npx supabase migration new init_localvector_schema
# Paste contents into the generated file
npx supabase db push
```

---

## Schema Design Principles

1. **Every tenant table has `org_id`** — no exceptions.
2. **RLS on every tenant table** — defense in depth alongside application-level checks.
3. **`locations` is the anchor** — a business can have multiple locations (even on Starter). The `org_id` scopes to the organization; `location_id` scopes to the specific venue.
4. **Audit trail by default** — `created_at` and `updated_at` on every table.
5. **JSONB for flexible data** — hours, amenities, and menu items use JSONB to avoid rigid column sprawl.
6. **Enums for constrained values** — plan tiers, severity levels, statuses.

---

## Complete SQL Script

```sql
-- ============================================================
-- LOCALVECTOR.AI — SYSTEM INITIALIZATION SCRIPT
-- Version: 2.3 (AEO/GEO Standard + Crawler Analytics)
-- Run this in Supabase SQL Editor to initialize the database
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search on business names

-- ============================================================
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

-- ============================================================
-- 3. CORE TENANT TABLES
-- ============================================================

-- Organizations (The Tenant)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,           -- URL-safe, used for menu.localvector.ai/{slug}
  owner_user_id UUID,                          -- Set after user creation

  -- Billing & Plan
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan plan_tier DEFAULT 'trial',
  plan_status plan_status DEFAULT 'trialing',

  -- Limits (enforced by plan, updated by Stripe webhook)
  max_locations INTEGER DEFAULT 1,
  audit_frequency VARCHAR(20) DEFAULT 'weekly',  -- 'weekly' | 'daily'
  max_ai_audits_per_month INTEGER DEFAULT 4,
  ai_audits_used_this_month INTEGER DEFAULT 0,
  current_billing_period_start TIMESTAMPTZ,
  onboarding_completed BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Mirrors Supabase auth.users)
-- FIXED: Matches Nuclear Rebuild (auth_provider_id is UUID)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_provider_id UUID NOT NULL UNIQUE,  -- Changed from VARCHAR to UUID to match auth.users.id
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships (Users ↔ Organizations, many-to-many)
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role membership_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);


-- ============================================================
-- 4. LOCATION & BUSINESS DATA
-- ============================================================

-- Locations (A business can have multiple physical locations)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,                    -- "Charcoal N Chill - Alpharetta"
  slug VARCHAR(100) NOT NULL,                    -- "charcoal-n-chill-alpharetta"
  is_primary BOOLEAN DEFAULT FALSE,              -- First location = primary

  -- Ground Truth (The "Real" data we compare AI answers against)
  business_name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  country VARCHAR(50) DEFAULT 'US',
  phone VARCHAR(50),
  website_url TEXT,
  google_place_id VARCHAR(255),                  -- For Google Places API lookups
  place_details_refreshed_at TIMESTAMPTZ DEFAULT NOW(),  -- Google ToS: refresh Place details every 30 days (see Doc 10, Section 4)

  -- Structured Data (JSONB for flexibility)
  hours_data JSONB,                              -- { "monday": {"open": "17:00", "close": "23:00"}, ... }
  amenities JSONB,                               -- { "has_outdoor_seating": true, "serves_alcohol": true, ... }
  categories JSONB,                              -- ["Hookah Bar", "Indian Restaurant", "Lounge"]
  attributes JSONB,                              -- { "price_range": "$$", "vibe": "upscale casual", "music": "DJ" }

  -- Operational Status
  operational_status VARCHAR(50) DEFAULT 'OPERATIONAL',  -- OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, slug)
);

-- Business Info (Legacy compatibility — maps to primary location)
-- DEPRECATED: Use `locations` table. Kept for backward compatibility during migration.
CREATE TABLE IF NOT EXISTS business_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  website_url TEXT,
  hours_data JSONB,
  amenities JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 5. THE FEAR ENGINE (Hallucination Audits)
-- ============================================================

-- Audit Runs (One row per scheduled or on-demand audit execution)
CREATE TABLE IF NOT EXISTS ai_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  model_provider model_provider NOT NULL,
  prompt_type audit_prompt_type NOT NULL,
  prompt_text TEXT,                               -- The actual prompt sent
  raw_response TEXT,                              -- Full response from the AI model
  response_metadata JSONB,                        -- { "tokens_used": 150, "latency_ms": 2300 }
  is_hallucination_detected BOOLEAN DEFAULT FALSE,
  audit_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hallucinations (Red Alerts — specific factual errors detected)
CREATE TABLE IF NOT EXISTS ai_hallucinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES ai_audits(id) ON DELETE SET NULL,

  -- What was wrong
  severity hallucination_severity DEFAULT 'high',
  category VARCHAR(50),                           -- 'status', 'hours', 'amenity', 'menu', 'address', 'phone'
  model_provider model_provider NOT NULL,
  claim_text TEXT NOT NULL,                       -- "ChatGPT says you are permanently closed"
  expected_truth TEXT,                            -- "You are OPERATIONAL, open Mon-Sat 5PM-12AM"

  -- Resolution
  correction_status correction_status DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Tracking
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,            -- Increments if same hallucination recurs

  -- Propagation Tracking (Outcome Architecture Patch)
  propagation_events JSONB DEFAULT '[]'::jsonb,  -- [{"event": "published", "date": "..."}]

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. THE GREED ENGINE (Competitor Intercept)
-- ============================================================

-- Competitors (User-defined competitors to track)
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,
  competitor_address TEXT,
  competitor_google_place_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor Intercepts (Analysis results)
CREATE TABLE IF NOT EXISTS competitor_intercepts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  competitor_name VARCHAR(255) NOT NULL,

  -- The Query Context
  query_asked VARCHAR(500),                      -- "Best happy hour in Alpharetta"
  model_provider model_provider NOT NULL,

  -- The Analysis
  winner VARCHAR(255),                           -- Who the AI recommended
  winner_reason TEXT,                            -- "Winner had 15 reviews mentioning 'cheap drinks'"
  winning_factor VARCHAR(255),                   -- "Happy Hour mentions"
  gap_analysis JSONB,                            -- { "competitor_mentions": 15, "your_mentions": 0 }
  gap_magnitude VARCHAR(20),                     -- 'high' | 'medium' | 'low'

  -- The Action
  suggested_action TEXT,                         -- "Get 3 reviews mentioning Happy Hour"
  action_status VARCHAR(20) DEFAULT 'pending',   -- 'pending' | 'in_progress' | 'completed' | 'dismissed'

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 7. THE MAGIC ENGINE (Menu-to-Schema)
-- ============================================================

-- Magic Menus (The core menu record)
CREATE TABLE IF NOT EXISTS magic_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,

  -- Source
  source_url TEXT,                               -- Supabase Storage URL of uploaded PDF/Image
  source_type VARCHAR(20),                       -- 'pdf' | 'image' | 'manual'

  -- AI Processing
  processing_status menu_processing_status DEFAULT 'uploading',
  extracted_data JSONB,                          -- Raw AI-extracted menu structure
  extraction_confidence FLOAT,                   -- 0.0–1.0 confidence score from OCR

  -- The Generated Schema.org JSON-LD
  json_ld_schema JSONB,                          -- The code we want AI bots to read
  human_verified BOOLEAN DEFAULT FALSE,          -- User clicked "I certify this is correct"
  verified_at TIMESTAMPTZ,

  -- Public Page Settings
  is_published BOOLEAN DEFAULT FALSE,
  public_slug VARCHAR(100),                      -- maps to menu.localvector.ai/{slug}
  page_views INTEGER DEFAULT 0,
  last_crawled_by JSONB,                         -- { "googlebot": "2026-02-15", "perplexitybot": "2026-02-14" }

  -- AEO & Propagation Tracking
  ai_readability_score FLOAT CHECK (ai_readability_score >= 0 AND ai_readability_score <= 100), -- 0-100 score for "Answer-First" compliance
  llms_txt_content TEXT,                         -- Generated Markdown for AI agents (AEO)
  propagation_events JSONB DEFAULT '[]'::jsonb,  -- [{"event": "crawled", "date": "..."}] -- CRITICAL: Must support 'link_injected' event via POST /magic-menu/:id/track-injection.

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu Items (Normalized from extracted_data for querying)
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES magic_menus(id) ON DELETE CASCADE,

  category VARCHAR(100),                         -- "Appetizers", "Hookah Flavors", "Drinks"
  name VARCHAR(255) NOT NULL,
  description TEXT,                              -- AI-generated if not present on PDF
  price DECIMAL(10, 2),
  price_note VARCHAR(100),                       -- "Market Price", "Starting at"
  currency VARCHAR(3) DEFAULT 'USD',
  dietary_tags JSONB,                            -- ["vegetarian", "gluten-free", "spicy"]
  is_available BOOLEAN DEFAULT TRUE,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7.1 CRAWLER ANALYTICS (Propagation Tracking)
-- ============================================================

-- Crawler Hits (Logs visits from Googlebot, GPTBot, etc.)
CREATE TABLE IF NOT EXISTS crawler_hits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES magic_menus(id) ON DELETE CASCADE,
  
  bot_type VARCHAR(50) NOT NULL,                 -- 'Googlebot', 'GPTBot', 'ClaudeBot', 'Applebot'
  user_agent TEXT,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries (e.g., "Last crawled by Google")
CREATE INDEX IF NOT EXISTS idx_crawler_hits_menu_bot ON crawler_hits(menu_id, bot_type, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_hits_org ON crawler_hits(org_id);

-- RLS: Tenant Isolation
ALTER TABLE crawler_hits ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can read their own crawler stats
CREATE POLICY "org_isolation_select" ON crawler_hits
  FOR SELECT USING (org_id = public.current_user_org_id());

-- Policy: Service Role (Edge Functions) can insert hits
-- Note: Middleware/Edge functions bypass RLS with service_role key, 
-- but explicit allow for authenticated backend is good practice.
CREATE POLICY "service_role_insert" ON crawler_hits
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 8. LISTING MANAGEMENT (The Big 6)
-- ============================================================

-- Directories (Global reference table — NOT tenant-scoped)
CREATE TABLE IF NOT EXISTS directories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,             -- 'google', 'yelp', 'apple', 'facebook', 'tripadvisor', 'bing'
  display_name VARCHAR(100) NOT NULL,            -- 'Google Business Profile'
  base_url TEXT,                                 -- '[https://business.google.com](https://business.google.com)'
  is_priority BOOLEAN DEFAULT FALSE,             -- TRUE for Big 6
  feeds_ai_models BOOLEAN DEFAULT FALSE,         -- TRUE if known to feed into AI training
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Listings (Tenant-scoped: one row per directory per location)
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  directory_id UUID NOT NULL REFERENCES directories(id),

  -- Listing Data
  listing_url TEXT,
  sync_status sync_status DEFAULT 'not_linked',
  nap_name VARCHAR(255),                         -- Name as it appears on this directory
  nap_address TEXT,
  nap_phone VARCHAR(50),
  nap_consistency_score INTEGER,                 -- 0–100

  -- Audit Trail
  last_checked_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  error_details TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, location_id, directory_id)
);


-- ============================================================
-- 9. VISIBILITY SCORING
-- ============================================================

-- Visibility Score Snapshots (Historical tracking)
CREATE TABLE IF NOT EXISTS visibility_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,

  -- Score Components
  visibility_score FLOAT,                        -- 0–100: How often cited by AI
  accuracy_score FLOAT,                          -- 0–100: How accurate AI claims are
  data_health_score FLOAT,                       -- 0–100: Schema completeness + listing sync

  -- Composite Reality Score = (Visibility × 0.4) + (Accuracy × 0.4) + (DataHealth × 0.2)
  reality_score FLOAT,

  -- Trend
  score_delta FLOAT,                             -- Change from previous snapshot
  snapshot_date DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, location_id, snapshot_date)
);

-- ============================================================
-- 9.1 AEO ANALYTICS (NEW v2.2)
-- ============================================================

CREATE TABLE IF NOT EXISTS visibility_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,

  -- AEO Metrics
  share_of_voice FLOAT,          -- % of AI answers mentioning the brand (0-100)
  citation_rate FLOAT,           -- % of answers with a clickable citation (0-100)
  sentiment_gap FLOAT,           -- Difference between brand sentiment and competitor (-1.0 to 1.0)

  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, location_id, snapshot_date)
);


-- ============================================================
-- 10. ROW-LEVEL SECURITY (RLS)
-- ============================================================

-- Helper Function: Get the current user's org_id from their membership
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID AS $$
  SELECT m.org_id
  FROM memberships m
  WHERE m.user_id = (
    SELECT u.id FROM users u WHERE u.auth_provider_id = auth.uid()::text
  )
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_hallucinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_intercepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant Isolation
-- Pattern: Users can only SELECT/INSERT/UPDATE/DELETE rows where org_id matches their membership

CREATE POLICY "org_isolation_select" ON organizations
  FOR SELECT USING (id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON locations
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_insert" ON locations
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON locations
  FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON business_info
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON ai_audits
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON ai_hallucinations
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON ai_hallucinations
  FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON competitors
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_insert" ON competitors
  FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_delete" ON competitors
  FOR DELETE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON competitor_intercepts
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON magic_menus
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON magic_menus
  FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON ai_hallucinations
  FOR DELETE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON magic_menus
  FOR DELETE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON menu_items
  FOR DELETE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_delete" ON listings
  FOR DELETE USING (org_id = public.current_user_org_id());

-- Magic Menus: Public read for published menus (AI crawlers need this)
CREATE POLICY "public_published_menus" ON magic_menus
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "org_isolation_select" ON menu_items
  FOR SELECT USING (org_id = public.current_user_org_id());
-- Menu items also public when parent menu is published
CREATE POLICY "public_menu_items" ON menu_items
  FOR SELECT USING (
    menu_id IN (SELECT id FROM magic_menus WHERE is_published = TRUE)
  );

CREATE POLICY "org_isolation_select" ON listings
  FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "org_isolation_update" ON listings
  FOR UPDATE USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON visibility_scores
  FOR SELECT USING (org_id = public.current_user_org_id());

CREATE POLICY "org_isolation_select" ON visibility_analytics
  FOR SELECT USING (org_id = public.current_user_org_id());

-- ADDITION TO SECTION 10: Explicit Link Injection Policy
-- Allows the application to update the propagation status specifically for Link Injection events
CREATE POLICY "tenant_link_injection_update" ON magic_menus
  FOR UPDATE USING (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- PUBLIC USER PROFILE SECURITY
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so profiles can be seen)
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.users FOR SELECT
  USING ( true );

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile."
  ON public.users FOR UPDATE
  USING ( auth.uid() = auth_provider_id );

-- PERMISSIONS (Critical for Auth Triggers)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;

-- ============================================================
-- 11. INDEXES
-- ============================================================

-- Core lookups
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(org_id, slug);

-- Fear Engine
CREATE INDEX IF NOT EXISTS idx_audits_org ON ai_audits(org_id);
CREATE INDEX IF NOT EXISTS idx_audits_date ON ai_audits(org_id, audit_date DESC);
CREATE INDEX IF NOT EXISTS idx_hallucinations_org ON ai_hallucinations(org_id);
CREATE INDEX IF NOT EXISTS idx_hallucinations_open ON ai_hallucinations(org_id, correction_status) WHERE correction_status = 'open';

-- Greed Engine
CREATE INDEX IF NOT EXISTS idx_intercepts_org ON competitor_intercepts(org_id);
CREATE INDEX IF NOT EXISTS idx_competitors_org ON competitors(org_id);

-- Magic Engine
CREATE INDEX IF NOT EXISTS idx_magic_menu_slug ON magic_menus(public_slug) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_menu_items_menu ON menu_items(menu_id);

-- Listings
CREATE INDEX IF NOT EXISTS idx_listings_org ON listings(org_id);

-- Visibility
CREATE INDEX IF NOT EXISTS idx_visibility_org_date ON visibility_scores(org_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_visibility_analytics_org_date ON visibility_analytics(org_id, snapshot_date DESC);


-- ============================================================
-- 12. TRIGGERS
-- ============================================================

-- Auto-update `updated_at` timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_organizations BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_locations BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_magic_menus BEFORE UPDATE ON magic_menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_listings BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_menu_items BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create org + membership when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  org_slug VARCHAR(100);
BEGIN
  -- Generate slug from email prefix
  org_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'));
  -- Ensure uniqueness by appending random suffix if needed
  IF EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) THEN
    org_slug := org_slug || '-' || SUBSTRING(uuid_generate_v4()::text FROM 1 FOR 8);
  END IF;

  -- Create organization
  INSERT INTO organizations (name, slug, owner_user_id)
  VALUES (COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Venue', org_slug, NEW.id)
  RETURNING id INTO new_org_id;

  -- Create membership (owner role)
  INSERT INTO memberships (user_id, org_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- AUTOMATIC TRIGGER: Create public user when Auth user is created
-- FIXED: Handles duplicates safely and uses SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_provider_id, email, full_name, avatar_url)
  VALUES (
    NEW.id, -- Now inserting as UUID
    NEW.email,
    -- Fallback: Use email prefix if full_name is missing
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (auth_provider_id) DO NOTHING; -- Prevent crash if user exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();

-- Reset monthly audit counter on billing period
CREATE OR REPLACE FUNCTION reset_monthly_audit_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_billing_period_start IS DISTINCT FROM OLD.current_billing_period_start THEN
    NEW.ai_audits_used_this_month := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reset_audit_counter BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION reset_monthly_audit_counter();

-- ADDITION TO SECTION 12: Google ToS Compliance Cron Trigger
-- Marks location details for re-fetch every 30 days per Google Maps Platform Terms
CREATE OR REPLACE FUNCTION trigger_google_tos_refresh()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.place_details_refreshed_at < NOW() - INTERVAL '30 days' THEN
    -- This flag triggers the Edge Function refresh logic defined in Doc 04
    PERFORM net.http_post(
      url:='https://<project>.supabase.co/functions/v1/refresh-google-data',
      headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      body:=jsonb_build_object('location_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

---

-- ============================================================
-- 13. STORAGE SECURITY (Buckets & RLS)
-- ============================================================
-- Precaution: Initialize the private bucket for menu uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('menus', 'menus', false) 
ON CONFLICT DO NOTHING;

-- Policy: Users can only upload to their own org's folder
-- Folder structure: /menus/{org_id}/{filename}
CREATE POLICY "Tenant Upload Access" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'menus' AND 
    (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

-- Policy: Users can only read their own org's folder
CREATE POLICY "Tenant Read Access" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'menus' AND 
    (storage.foldername(name))[1] = public.current_user_org_id()::text
  );

-- ============================================================
-- 14. SEED DATA
-- ============================================================

-- 14.1 Global Reference Data: Big 6 Directories
-- REQUIRED: These IDs are referenced by the listings table
INSERT INTO directories (name, display_name, base_url, is_priority, feeds_ai_models) VALUES
  ('google', 'Google Business Profile', 'https://business.google.com', TRUE, TRUE),
  ('yelp', 'Yelp', 'https://biz.yelp.com', TRUE, TRUE),
  ('apple', 'Apple Maps (Apple Business Connect)', 'https://businessconnect.apple.com', TRUE, TRUE),
  ('facebook', 'Facebook', 'https://business.facebook.com', TRUE, TRUE),
  ('tripadvisor', 'TripAdvisor', 'https://tripadvisor.com', TRUE, TRUE),
  ('bing', 'Bing Places', 'https://bingplaces.com', TRUE, TRUE),
  ('opentable', 'OpenTable', 'https://restaurant.opentable.com', FALSE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- 14.2 Golden Tenant: Charcoal N Chill (Tenant Zero)
-- REQUIRED: Used for Phase 0 testing and "Dogfooding"
INSERT INTO organizations (id, name, slug, plan, plan_status, audit_frequency, max_locations, onboarding_completed)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Fixed UUID for testing reliability
  'Charcoal N Chill', 
  'charcoal-n-chill', 
  'growth', 
  'active', 
  'daily', 
  1,
  TRUE
) ON CONFLICT (slug) DO NOTHING;

-- 14.3 Primary Location (Alpharetta)
INSERT INTO locations (
  org_id, 
  name, 
  slug, 
  is_primary,
  business_name, 
  address_line1, 
  city, 
  state, 
  zip, 
  country,
  phone, 
  website_url, 
  operational_status,
  hours_data, 
  amenities, 
  categories, 
  google_place_id
)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Matches Org ID above
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
  -- Hours: Open Mon-Sun 5PM-11PM/1AM
  '{
    "monday": {"open": "17:00", "close": "23:00"},
    "tuesday": {"open": "17:00", "close": "23:00"},
    "wednesday": {"open": "17:00", "close": "23:00"},
    "thursday": {"open": "17:00", "close": "00:00"},
    "friday": {"open": "17:00", "close": "01:00"},
    "saturday": {"open": "17:00", "close": "01:00"},
    "sunday": {"open": "17:00", "close": "23:00"}
  }'::jsonb,
  -- Amenities: Core set matching Doc 11 Fixtures
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
  -- Categories
  '["Hookah Bar", "Indian Restaurant", "Fusion Restaurant", "Lounge", "Nightlife"]'::jsonb,
  'ChIJi8-1ywdO9YgR9s5j-y0_1lI' -- Real Google Place ID
) ON CONFLICT (org_id, slug) DO NOTHING;

-- 14.4 Test User (Owner)
INSERT INTO users (auth_provider_id, email, full_name)
VALUES (
  'test-owner-uid-123', 
  'aruna@charcoalnchill.com', 
  'Aruna (Founder)'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO memberships (user_id, org_id, role)
SELECT id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'owner'
FROM users WHERE email = 'aruna@charcoalnchill.com'
ON CONFLICT (user_id, org_id) DO NOTHING;
```

---

## Entity Relationship Summary

```
organizations (1) ──── (N) locations
     │                       │
     │                       ├── (N) ai_audits
     │                       ├── (N) ai_hallucinations
     │                       ├── (N) competitor_intercepts
     │                       ├── (N) magic_menus ──── (N) menu_items
     │                       │                   └── (N) crawler_hits
     │                       ├── (N) listings ──── (1) directories [global]
     │                       ├── (N) visibility_scores
     │                       └── (N) visibility_analytics [NEW AEO Data]
     │
     ├── (N) memberships ──── (1) users
     └── (N) competitors
```

---

## Section 15: TypeScript Data Interfaces for JSONB Columns

All code that reads or writes JSONB columns MUST validate against these interfaces. These are the canonical shapes — Doc 04 (Intelligence Engine), Doc 05 (API Contract), Doc 06 (Frontend), and Doc 11 (Test Fixtures) all reference these definitions.

**🤖 Agent Rule:** Import these types from `src/lib/types/ground-truth.ts`. Do NOT invent ad-hoc shapes for any JSONB column.

### 15.1 `locations.hours_data`
```typescript
// src/lib/types/ground-truth.ts

type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface DayHours {
  open: string;   // 24h format: "17:00"
  close: string;  // 24h format: "23:00" or "01:00" (next day)
}

type HoursData = Record<DayOfWeek, DayHours | 'closed'>;
```

**Example (from Golden Tenant seed):**
```json
{
  "monday": { "open": "17:00", "close": "23:00" },
  "tuesday": { "open": "17:00", "close": "23:00" },
  "sunday": { "open": "17:00", "close": "23:00" }
}
```

**Rule:** A missing day key means "hours unknown" (not "closed"). Use the string `"closed"` explicitly for days the venue is closed.

### 15.2 `locations.amenities`
```typescript
interface Amenities {
  has_outdoor_seating: boolean;
  serves_alcohol: boolean;
  has_hookah: boolean;
  is_kid_friendly: boolean;
  takes_reservations: boolean;
  has_live_music: boolean;
  has_dj?: boolean;
  has_private_rooms?: boolean;
  [key: string]: boolean | undefined;  // extensible for future amenities
}
```

**Rule:** Core amenities (the first 6) are required. Additional amenities use the same `has_` or `is_` prefix convention. The Fear Engine (Doc 04, Section 2.2C) checks against these keys.

### 15.3 `locations.categories`
```typescript
type Categories = string[];
// Example: ["Hookah Bar", "Indian Restaurant", "Fusion Restaurant", "Lounge"]
```

### 15.4 `locations.attributes`
```typescript
interface Attributes {
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  vibe?: string;
  music?: string;
  [key: string]: string | undefined;
}
```

### 15.5 `magic_menus.extracted_data`

> ⚠️ **Updated Phase 19** — The v2.2 nested `sections/MenuSection` shape was replaced during
> Phase 14 implementation. The canonical interfaces live in `lib/types/menu.ts`; all code MUST
> import from there.

```typescript
// Source of truth: lib/types/menu.ts

/**
 * A single menu item extracted by the AI parser.
 * `confidence` drives the Confidence Triage UI (Phase 14):
 *   ≥ 0.85 = auto-approved (emerald)
 *   0.60–0.84 = needs review (amber)
 *   < 0.60 = must edit — blocks publish (crimson)
 */
interface MenuExtractedItem {
  id: string;
  name: string;
  description?: string;
  price?: string;            // formatted string e.g. "$18.00"
  category: string;          // flat string — no nested MenuSection
  confidence: number;        // 0.0–1.0
}

/** Top-level shape for `magic_menus.extracted_data` JSONB column. */
interface MenuExtractedData {
  items: MenuExtractedItem[];
  extracted_at: string;      // ISO-8601 timestamp
  source_url?: string;       // origin PDF/URL if known
}
```

**Rule:** Import `MenuExtractedItem`, `MenuExtractedData`, `MenuWorkspaceData`, and `PropagationEvent` exclusively from `lib/types/menu.ts`. Do **not** redeclare these shapes inline.

### 15.6 `menu_items.dietary_tags`
```typescript
type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'spicy' | 'contains-nuts' | 'halal' | 'kosher';
type DietaryTags = DietaryTag[];
```

### 15.7 `competitor_intercepts.gap_analysis`
```typescript
interface GapAnalysis {
  competitor_mentions: number;
  your_mentions: number;
  [key: string]: number | string;  // extensible for future gap types
}
```

### 15.8 `ai_audits.response_metadata`
```typescript
interface AuditResponseMetadata {
  tokens_used: number;
  latency_ms: number;
  model_version?: string;
}
```

### 15.9 `magic_menus.last_crawled_by`
```typescript
type CrawlerLog = Record<string, string>;
// Example: { "googlebot": "2026-02-15", "perplexitybot": "2026-02-14" }
```

### 15.10 `propagation_events` (Shared by `ai_hallucinations` & `magic_menus`)
```typescript
interface PropagationEvent {
  event: 'published' | 'link_injected' | 'crawled' | 'indexed' | 'live_in_ai';
  date: string; // ISO 8601
  details?: string;
}

type PropagationEvents = PropagationEvent[];
```

### 15.11 `ai_hallucinations` — TypeScript interface

> ⚠️ **Critical naming corrections (Phase 19 sync):**
> - Column is `model_provider` **not** `engine`
> - Column is `correction_status` **not** `is_resolved`
> - All ENUM values are **strictly lowercase**: `'critical'`, `'high'`, `'medium'`, `'low'`
> - Valid `category` values: `'status' | 'hours' | 'amenity' | 'menu' | 'address' | 'phone'`

```typescript
type ModelProvider =
  | 'openai-gpt4o'
  | 'perplexity-sonar'
  | 'google-gemini'
  | 'anthropic-claude'
  | 'microsoft-copilot';

type HallucinationSeverity = 'critical' | 'high' | 'medium' | 'low';  // all lowercase

type CorrectionStatus = 'open' | 'verifying' | 'fixed' | 'dismissed' | 'recurring';

type HallucinationCategory = 'status' | 'hours' | 'amenity' | 'menu' | 'address' | 'phone';

interface AiHallucination {
  id: string;
  org_id: string;
  location_id: string | null;
  audit_id: string | null;

  // What was wrong
  model_provider: ModelProvider;   // ← was incorrectly "engine" in early seed data
  severity: HallucinationSeverity;
  category: HallucinationCategory;
  claim_text: string;              // e.g. "Charcoal N Chill is permanently closed."
  expected_truth: string;          // e.g. "Open Tuesday–Sunday 11 AM–10 PM."

  // Resolution
  correction_status: CorrectionStatus;  // ← was incorrectly "is_resolved: boolean"
  resolved_at: string | null;
  resolution_notes: string | null;

  // Recurrence tracking
  first_detected_at: string;   // ISO-8601
  last_seen_at: string;        // ISO-8601
  occurrence_count: number;    // increments when same hallucination recurs

  // Timestamps
  detected_at: string;
  created_at: string;
}
```

**Rule:** When inserting rows via seed.sql or Server Actions, all enum values **must** be lowercase strings. Uppercase variants (e.g. `'CRITICAL'`) will fail the PostgreSQL CHECK constraint.

### 15.12 `sov_target_queries` — TypeScript interface

> **Source file:** `src/lib/types/sov.ts`
> **Migration:** `supabase/migrations/20260223000001_sov_engine.sql`
> **Spec:** Doc 04c Section 2

```typescript
// src/lib/types/sov.ts

export type QueryCategory = 'discovery' | 'comparison' | 'occasion' | 'near_me' | 'custom';

export interface SOVTargetQuery {
  id: string;
  orgId: string;
  locationId: string;
  queryText: string;
  queryCategory: QueryCategory;
  occasionTag: string | null;
  intentModifier: string | null;
  isSystemGenerated: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  lastSovResult: number | null;   // 0–100, most recent query-level SOV %
  lastCited: boolean | null;      // was our business mentioned in last run?
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SOVReport {
  orgId: string;
  locationId: string;
  snapshotDate: string;
  shareOfVoice: number;           // 0–100, aggregate across all active queries
  citationRate: number;           // 0–100, % of cited results with a URL
  queriesRun: number;
  queriesCited: number;
  topCitedQuery: string | null;
  firstMoverAlerts: SOVFirstMoverAlert[];
  weekOverWeekDelta: number | null;
}

export interface SOVFirstMoverAlert {
  id: string;
  orgId: string;
  locationId: string | null;
  queryId: string;
  queryText: string;
  detectedAt: string;
  status: 'new' | 'actioned' | 'dismissed';
  actionedAt: string | null;
}
```

**🤖 Agent Rule:** Import `QueryCategory`, `SOVTargetQuery`, `SOVReport`, `SOVFirstMoverAlert` exclusively from `src/lib/types/sov.ts`. Do NOT redeclare these shapes inline in cron functions or API routes.

---

### 15.13 `content_drafts` — TypeScript interface

> **Source file:** `src/lib/types/content-pipeline.ts`
> **Migration:** `supabase/migrations/20260223000002_content_pipeline.sql`
> **Spec:** Doc 05 Section 13, Doc 06 Section 9

```typescript
// src/lib/types/content-pipeline.ts

export type DraftTriggerType = 'competitor_gap' | 'occasion' | 'prompt_missing' | 'first_mover' | 'manual';
export type DraftContentType = 'faq_page' | 'occasion_page' | 'blog_post' | 'landing_page' | 'gbp_post';
export type DraftStatus = 'draft' | 'approved' | 'published' | 'rejected' | 'archived';

export interface ContentDraft {
  id: string;
  orgId: string;
  locationId: string | null;
  triggerType: DraftTriggerType;
  triggerId: string | null;        // FK to competitor_intercepts, sov_target_queries, or local_occasions
  draftTitle: string;
  draftContent: string;
  targetPrompt: string | null;     // The AI query this content is designed to win
  contentType: DraftContentType;
  aeoScore: number | null;         // 0–100, calculated at draft creation
  status: DraftStatus;
  humanApproved: boolean;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
}

// Shape returned by GET /api/content-drafts/:id (includes trigger context)
export interface ContentDraftWithContext extends ContentDraft {
  triggerContext: {
    competitorName?: string;
    winningFactor?: string;
    queryAsked?: string;
    occasionName?: string;
  } | null;
  aeoBreakdown: {
    answerFirst: number;
    keywordDensity: number;
    structure: number;
  } | null;
  targetKeywords: string[];
}
```

**🤖 Agent Rule:** `POST /api/content-drafts/:id/publish` MUST validate `humanApproved === true` AND `status === 'approved'` server-side before executing. This is enforced even if the client sends a direct API call. Return `403` with message if either condition fails.

---

### 15.14 `page_audits` — TypeScript interface

> **Source file:** `src/lib/types/content-pipeline.ts`
> **Migration:** `supabase/migrations/20260223000002_content_pipeline.sql`
> **Spec:** Doc 05 Section 14

```typescript
// src/lib/types/content-pipeline.ts (continued)

export type PageType = 'homepage' | 'menu' | 'about' | 'faq' | 'events' | 'occasion' | 'other';

export interface PageAuditRecommendation {
  issue: string;
  fix: string;
  impactPoints: number;   // How many points this fix adds to overall_score
  priority: 'high' | 'medium' | 'low';
}

export interface PageAudit {
  id: string;
  orgId: string;
  locationId: string | null;
  pageUrl: string;
  pageType: PageType;
  overallScore: number | null;          // 0–100
  aeoReadabilityScore: number | null;   // 0–100
  answerFirstScore: number | null;      // 0–100, does first sentence answer intent?
  schemaCompletenessScore: number | null; // 0–100, required schema types present?
  faqSchemaPresent: boolean | null;
  recommendations: PageAuditRecommendation[] | null;
  lastAuditedAt: string;
  createdAt: string;
}
```

---

### 15.15 `local_occasions` — TypeScript interface

> **Source file:** `src/lib/types/occasions.ts`
> **Migration:** `supabase/migrations/20260223000002_content_pipeline.sql`
> **Spec:** Doc 06 Section 10

```typescript
// src/lib/types/occasions.ts

export type OccasionType = 'holiday' | 'celebration' | 'recurring' | 'seasonal';

export interface OccasionQueryPattern {
  query: string;
  category: QueryCategory;   // from sov.ts
}

export interface LocalOccasion {
  id: string;
  name: string;                          // "Valentine's Day"
  occasionType: OccasionType;
  triggerDaysBefore: number;             // Alert fires this many days before peak
  annualDate: string | null;             // 'MM-DD' format (e.g., '02-14'), null for floating dates
  peakQueryPatterns: OccasionQueryPattern[];
  relevantCategories: string[];          // ["restaurant", "hookah lounge", "bar"]
  isActive: boolean;
  createdAt: string;
}
```

---

### 15.16 `citation_source_intelligence` — TypeScript interface

> **Source file:** `src/lib/types/citations.ts`
> **Migration:** `supabase/migrations/20260223000002_content_pipeline.sql`
> **Spec:** Doc 05 Section 15

```typescript
// src/lib/types/citations.ts

export interface CitationSourceIntelligence {
  id: string;
  businessCategory: string;       // 'hookah lounge'
  city: string;
  state: string;
  platform: string;               // 'yelp' | 'tripadvisor' | 'reddit' | 'google' | 'facebook'
  citationFrequency: number;      // 0.0–1.0
  sampleQuery: string | null;
  sampleSize: number;
  modelProvider: ModelProvider;   // from AiHallucination type
  measuredAt: string;
}

// Shape used by the Citation Gap Finder UI (Doc 06 Section 11)
export interface CitationPlatformWithGap extends CitationSourceIntelligence {
  orgListed: boolean;             // derived from tenant's listings table
  orgListingUrl: string | null;
  gap: boolean;                   // true when !orgListed && citationFrequency > 0.3
  gapAction: string | null;       // "Claim your TripAdvisor listing to appear in 62% more AI answers"
}

export interface CitationGapSummary {
  gapScore: number;               // 0–100
  platformsCovered: number;
  platformsThatMatter: number;    // platforms with citationFrequency > 0.3
  topGap: {
    platform: string;
    citationFrequency: number;
    action: string;
  } | null;
}
```

**🤖 Agent Rule:** Import all citation types from `src/lib/types/citations.ts`. The `citationFrequency` field is a float 0.0–1.0 (not a percentage). Multiply by 100 only at the display layer.

---

### 15.17 GBP OAuth interfaces

> **Source file:** `src/lib/types/gbp.ts`
> **Migration:** `supabase/migrations/20260223000003_gbp_integration.sql`
> **Spec:** RFC_GBP_ONBOARDING_V2_REPLACEMENT.md

```typescript
// src/lib/types/gbp.ts

// Shape of a single location from the GBP Locations API
export interface GBPLocation {
  name: string;                   // "accounts/1234567890/locations/987654321"
  title: string;                  // Business display name
  storefrontAddress: {
    addressLines: string[];
    locality: string;             // city
    administrativeArea: string;   // state
    postalCode: string;
  };
  regularHours?: {
    periods: GBPHoursPeriod[];
  };
  openInfo?: {
    status: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
  };
  metadata?: {
    placeId: string;              // maps to locations.google_place_id
  };
}

export interface GBPHoursPeriod {
  openDay: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  openTime: { hours: number; minutes: number };
  closeDay: string;
  closeTime: { hours: number; minutes: number };
}

// What's stored in pending_gbp_imports.locations_data
export interface PendingGBPImport {
  id: string;
  orgId: string;
  locationsData: GBPLocation[];
  accountName: string;
  hasMore: boolean;
  expiresAt: string;
  createdAt: string;
}
```

**⚠️ Timezone gap (RFC Rev 2 §4.2):** `GBPHoursPeriod` times have no explicit timezone. When mapping to `HoursData`, the audit prompt must supply timezone context. Use the `locations.city` + `locations.state` from the imported row to infer timezone via a lookup (e.g., `Intl.DateTimeFormat` IANA timezone database).


---

**Phase 5** - The Database Fix

## Updated Schema (Post-Fix)

### 1. Users (`public.users`)
* `id`: UUID (Primary Key, matches `auth.users.id`)
* `email`: Text
* `full_name`: Text (Replaces `first_name` / `last_name`)
* `auth_provider_id`: UUID (Strictly typed, matches `id`)
* `created_at`: Timestamp

### 2. Organizations (`public.organizations`)
* `id`: UUID (Primary Key)
* `name`: Text
* `slug`: Text (Unique)
* `created_at`: Timestamp

### 3. Memberships (`public.memberships`)
* `user_id`: UUID (Foreign Key -> `public.users.id`)
* `org_id`: UUID (Foreign Key -> `public.organizations.id`)
* `role`: Text ('owner', 'admin', 'member')
* *Constraint:* Composite Primary Key (`user_id`, `org_id`)

### 4. Locations (`public.locations`)
* `id`: UUID (Primary Key)
* `org_id`: UUID (Foreign Key -> `public.organizations.id`)
* `name`: Text (Internal name)
* `business_name`: Text (Public display name)
* `slug`: Text (URL friendly)
* `address_line1`: Text
* `city`: Text
* `state`: Text
* `phone`: Text
* `created_at`: Timestamp

### Row Level Security (RLS)
* **Strategy:** "Membership-Based Access"
* **Rule:** A user can `SELECT` or `INSERT` rows only if their `auth.uid()` exists in the `memberships` table for the related `org_id`.