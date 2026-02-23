-- pgcrypto is required for crypt() and gen_salt() used in the auth user insert.
-- Supabase local dev includes it but does not always auto-activate it.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- LOCALVECTOR.AI — LOCAL DEVELOPMENT SEED
-- Runs automatically after all migrations on `npx supabase db reset`.
-- Uses fixed UUIDs throughout so data is deterministic and easy to
-- reference in unit tests, Playwright fixtures, and manual QA.
--
-- Fixed UUID reference card:
--   auth user id   : 00000000-0000-0000-0000-000000000001
--   public user id : 00000000-0000-0000-0000-000000000002
--   org id         : a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (pre-seeded by migration)
--   location id    : dynamic — retrieved via subquery (slug='alpharetta')
--   magic menu id  : c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   category BBQ   : d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   category Sides : d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   item e0–e3     : e[0-3]eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--
-- Phase 19 Test User (Playwright Onboarding Guard test):
--   auth user id   : 00000000-0000-0000-0000-000000000010
--   public user id : 00000000-0000-0000-0000-000000000011
--   org id         : b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11
--   Credentials    : incomplete@localvector.ai / Password123!
--   Purpose        : Primary location has hours_data=NULL + amenities=NULL
--                    so the dashboard Onboarding Guard always fires.
--
-- Credentials: dev@localvector.ai / Password123!
-- Public honeypot: http://localhost:3000/m/charcoal-n-chill
-- ============================================================

-- ── 1. DEV PUBLIC USER ────────────────────────────────────────────────────────
-- Insert into public.users BEFORE auth.users to claim the fixed UUID.
-- The on_user_created trigger (which auto-creates an org + membership) is
-- disabled for this single insert so we can link the user to the existing
-- golden tenant org manually in step 3.
--
-- When auth.users is inserted in step 2, the on_auth_user_created trigger
-- fires and tries to mirror the row into public.users — but hits
-- ON CONFLICT (auth_provider_id) DO NOTHING, so on_user_created never
-- fires a second time. No stray org is created.

ALTER TABLE public.users DISABLE TRIGGER on_user_created;

INSERT INTO public.users (id, auth_provider_id, email, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'dev@localvector.ai',
  'Dev User'
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.users ENABLE TRIGGER on_user_created;

-- ── 2. DEV AUTH USER ──────────────────────────────────────────────────────────
-- Insert into Supabase auth.users so the dev user can sign in via the app
-- login form or the Supabase Studio UI (http://localhost:54323).
--
-- Credentials: dev@localvector.ai / Password123!
--
-- crypt() + gen_salt() from pgcrypto (available in all Supabase local stacks).
-- email_confirmed_at is set so the account is immediately active — no email
-- verification step required in the dev environment.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'dev@localvector.ai',
  crypt('Password123!', gen_salt('bf')),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Dev User"}'::jsonb,
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. ORG MEMBERSHIP ─────────────────────────────────────────────────────────
-- Make the dev user an owner of the golden tenant org so the dashboard
-- shows real data from the Charcoal N Chill location on first login.

INSERT INTO public.memberships (user_id, org_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'owner'
)
ON CONFLICT (user_id, org_id) DO NOTHING;

-- ── 4. PUBLISHED MAGIC MENU ───────────────────────────────────────────────────
-- Create a fully published menu with public_slug 'charcoal-n-chill'.
-- The LLM honeypot page is reachable at /m/charcoal-n-chill after seeding.
-- location_id is retrieved via subquery because the Alpharetta location has
-- no fixed UUID in the migration — only its slug is stable.

INSERT INTO public.magic_menus (
  id,
  org_id,
  location_id,
  public_slug,
  is_published,
  processing_status,
  human_verified
)
SELECT
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'charcoal-n-chill',
  TRUE,
  'published'::menu_processing_status,
  TRUE
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 5. MENU CATEGORIES ────────────────────────────────────────────────────────

INSERT INTO public.menu_categories (id, org_id, menu_id, name, sort_order)
VALUES
  (
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'BBQ Plates',
    1
  ),
  (
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Sides & Starters',
    2
  )
ON CONFLICT (id) DO NOTHING;

-- ── 6. MENU ITEMS ─────────────────────────────────────────────────────────────

INSERT INTO public.menu_items (
  id, org_id, menu_id, category_id,
  name, description, price, currency, is_available, sort_order
)
VALUES
  (
    'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Smoked Brisket',
    'Low-and-slow smoked beef brisket served with house BBQ sauce, pickles, and white bread.',
    28.00, 'USD', TRUE, 1
  ),
  (
    'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Smoked Half Chicken',
    'Hickory-smoked half chicken with a crispy bark, served with two sides of your choice.',
    22.00, 'USD', TRUE, 2
  ),
  (
    'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Truffle Mac & Cheese',
    'Creamy three-cheese mac tossed with black truffle oil, topped with crispy breadcrumbs.',
    14.00, 'USD', TRUE, 1
  ),
  (
    'e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Collard Greens',
    'Southern-style collard greens slow-cooked with smoked turkey and a touch of apple cider vinegar.',
    9.00, 'USD', TRUE, 2
  )
ON CONFLICT (id) DO NOTHING;

-- ── 7. GOOGLE INTEGRATION (connected) ────────────────────────────────────────
-- Adds a Google Business Profile row in a 'connected' state with a recent
-- last_sync_at so the Integrations dashboard shows a live-looking connection.
-- location_id is retrieved via subquery (same pattern as magic_menus above).

INSERT INTO public.location_integrations (org_id, location_id, platform, status, last_sync_at)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'google',
  'connected',
  NOW() - INTERVAL '2 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (location_id, platform) DO NOTHING;

-- ── 8. AI EVALUATIONS (Phase 9) ───────────────────────────────────────────────
-- Two dummy evaluation rows for the Hallucination Monitor dashboard:
--   • OpenAI   — high accuracy score (95), no hallucinations
--   • Perplexity — lower score (65), two realistic mock hallucinations
--
-- Fixed UUIDs:
--   OpenAI eval    : f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   Perplexity eval: f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--
-- location_id retrieved via subquery (location has no fixed UUID).

INSERT INTO public.ai_evaluations (
  id, org_id, location_id, engine,
  prompt_used, response_text,
  accuracy_score, hallucinations_detected,
  created_at
)
SELECT
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'openai',
  'Tell me about Charcoal N Chill restaurant in Alpharetta, GA. Include the address, phone number, hours, and menu highlights.',
  'Charcoal N Chill is a popular Indian-fusion restaurant and hookah lounge located at 11950 Jones Bridge Road, Suite 103, Alpharetta, GA 30005. They can be reached at (470) 546-4866 and their website is charcoalnchill.com. The restaurant is open Monday through Sunday from 5:00 PM, with extended hours on weekends. They are known for their smoked BBQ dishes, hookah, and vibrant nightlife atmosphere.',
  95,
  '[]'::jsonb,
  NOW() - INTERVAL '3 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ai_evaluations (
  id, org_id, location_id, engine,
  prompt_used, response_text,
  accuracy_score, hallucinations_detected,
  created_at
)
SELECT
  'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'perplexity',
  'Tell me about Charcoal N Chill restaurant in Alpharetta, GA. Include the address, phone number, hours, and menu highlights.',
  'Charcoal N Chill is an Indian restaurant in Alpharetta, GA. The restaurant is open Monday through Sunday including Monday evenings. You can reach them at (470) 123-4567. They are well known for their lamb chops and seafood platters.',
  65,
  '["Claims the restaurant is open on Monday evenings, but it is closed on Mondays", "States an incorrect phone number: (470) 123-4567 instead of (470) 546-4866"]'::jsonb,
  NOW() - INTERVAL '1 hour'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 9. SHARE OF VOICE SEED DATA (Phase 10) ────────────────────────────────────
-- One target query + one SOV evaluation for the Charcoal N Chill location:
--   • Target query  : "Best BBQ restaurant in Alpharetta GA"
--   • SOV eval      : OpenAI engine, rank_position 2, two competitor mentions
--
-- Fixed UUIDs:
--   target_query id  : c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   sov_evaluation id: c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--
-- location_id retrieved via subquery (same pattern as sections 4 and 7–8).

INSERT INTO public.target_queries (id, org_id, location_id, query_text)
SELECT
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'Best BBQ restaurant in Alpharetta GA'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'openai',
  2,
  '["Dreamland BBQ", "Pappadeaux Seafood Kitchen"]'::jsonb,
  'Here are some of the best BBQ restaurants in Alpharetta, GA: 1. Dreamland BBQ — a beloved regional chain known for its slow-smoked ribs. 2. Charcoal N Chill — a popular spot for smoked brisket and a vibrant atmosphere. 3. Pappadeaux Seafood Kitchen — though primarily seafood, their BBQ offerings are worth a visit.',
  NOW() - INTERVAL '30 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 10. REALITY SCORE DASHBOARD SEED DATA (Phase 13) ─────────────────────────
--
-- Column mapping (verified against migrations/20260218000000_initial_schema.sql):
--   model_provider  model_provider ENUM  — NOT "engine"
--   correction_status correction_status ENUM ('open','fixed',...) — NOT "is_resolved" boolean
--   severity        hallucination_severity ENUM — lowercase ('critical','high','medium','low')
--   category        VARCHAR(50) — values must match AlertFeed CATEGORY_LABELS keys
--

-- 1. CRITICAL Open Alert (ChatGPT says the restaurant is permanently closed)
INSERT INTO public.ai_hallucinations (
  id, org_id, location_id,
  model_provider, severity, category,
  claim_text, expected_truth,
  correction_status,
  first_detected_at, last_seen_at, occurrence_count,
  created_at
)
SELECT
  'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'openai-gpt4o',
  'critical',
  'status',
  'Charcoal N Chill is permanently closed.',
  'We are open Tuesday–Sunday 11 AM–10 PM.',
  'open',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '30 minutes',
  3,
  NOW() - INTERVAL '1 hour'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 2. HIGH Open Alert (Perplexity reports wrong closing time on weekends)
INSERT INTO public.ai_hallucinations (
  id, org_id, location_id,
  model_provider, severity, category,
  claim_text, expected_truth,
  correction_status,
  first_detected_at, last_seen_at, occurrence_count,
  created_at
)
SELECT
  'f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'perplexity-sonar',
  'high',
  'hours',
  'Closes at 10 PM on weekends.',
  'Open until midnight Friday and Saturday.',
  'open',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '1 hour',
  2,
  NOW() - INTERVAL '2 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- 3. MEDIUM Fixed Alert (Gemini said no alcohol — now corrected)
INSERT INTO public.ai_hallucinations (
  id, org_id, location_id,
  model_provider, severity, category,
  claim_text, expected_truth,
  correction_status,
  first_detected_at, last_seen_at, occurrence_count,
  created_at
)
SELECT
  'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'google-gemini',
  'medium',
  'amenity',
  'Does not serve alcohol.',
  'Full bar available — beer, wine, and cocktails.',
  'fixed',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '2 hours',
  1,
  NOW() - INTERVAL '3 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 11. PLAYWRIGHT TEST USER (Phase 19) ───────────────────────────────────────
-- Credentials: incomplete@localvector.ai / Password123!
--
-- This user's primary location intentionally has hours_data=NULL and
-- amenities=NULL so that the Dashboard Layout Onboarding Guard always redirects
-- them to /onboarding. This allows the Playwright Onboarding Guard E2E test
-- (tests/e2e/onboarding.spec.ts) to exercise the full guard → form → dashboard
-- round-trip without disturbing the golden-tenant dev user.
--
-- ⚠️  This test is NOT idempotent: submitting the onboarding form updates the
-- location row in the DB. Run `npx supabase db reset` before each full E2E run
-- to restore hours_data=NULL / amenities=NULL.
--
-- Same trigger-disable pattern as the dev user in Section 1.

-- 11a. Public user record (must exist before auth.users to hold the fixed UUID)
ALTER TABLE public.users DISABLE TRIGGER on_user_created;

INSERT INTO public.users (id, auth_provider_id, email, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000010',
  'incomplete@localvector.ai',
  'Incomplete Test User'
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.users ENABLE TRIGGER on_user_created;

-- 11b. Auth user (on_auth_user_created fires, hits ON CONFLICT in public.users,
--      so no stray org is created by the trigger)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000010',
  'authenticated',
  'authenticated',
  'incomplete@localvector.ai',
  crypt('Password123!', gen_salt('bf')),
  NOW(), NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Incomplete Test User"}'::jsonb,
  NOW(), NOW(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- 11c. Organization (plan defaults to 'trial'; onboarding_completed stays FALSE)
INSERT INTO public.organizations (id, name, slug)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  'Incomplete Test Org',
  'incomplete-test-org'
)
ON CONFLICT (id) DO NOTHING;

-- 11d. Membership
INSERT INTO public.memberships (user_id, org_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  'owner'
)
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 11e. Primary location — hours_data and amenities are explicitly NULL.
--      The Dashboard Layout Onboarding Guard checks:
--        if (primaryLocation && !primaryLocation.hours_data && !primaryLocation.amenities)
--          redirect('/onboarding')
--      Both columns NULL satisfies this condition.
--
--      ⚠️  DO UPDATE (not DO NOTHING) so that a previous E2E test run that
--      submitted the onboarding form and wrote hours_data/amenities is always
--      reset back to NULL when `npx supabase db reset` replays this seed.
INSERT INTO public.locations (org_id, name, slug, business_name, is_primary, hours_data, amenities)
VALUES (
  'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11',
  'Test Restaurant - Main',
  'test-main',
  'Test Restaurant',
  TRUE,
  NULL,
  NULL
)
ON CONFLICT (org_id, slug) DO UPDATE
  SET hours_data = NULL,
      amenities  = NULL,
      is_primary = TRUE;

-- ── 12. HYBRID UPLOAD TEST USER (Phase 14.5) ──────────────────────────────────
-- Credentials: upload@localvector.ai / Password123!
--
-- This user has a COMPLETE location (non-null hours_data + amenities) so the
-- Dashboard Layout Onboarding Guard does NOT fire. They have NO magic_menus
-- record, so /dashboard/magic-menus renders UploadState with the 3-tab UI.
--
-- Used by: tests/e2e/hybrid-upload.spec.ts
--
-- ⚠️  NOT idempotent: the E2E test writes a magic_menus record for this user.
--     Run `npx supabase db reset` before each full E2E run.
--
-- Fixed UUIDs:
--   auth user id   : 00000000-0000-0000-0000-000000000020
--   public user id : 00000000-0000-0000-0000-000000000021
--   org id         : c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22

ALTER TABLE public.users DISABLE TRIGGER on_user_created;

INSERT INTO public.users (id, auth_provider_id, email, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000020',
  'upload@localvector.ai',
  'Upload Test User'
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.users ENABLE TRIGGER on_user_created;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000020',
  'authenticated',
  'authenticated',
  'upload@localvector.ai',
  crypt('Password123!', gen_salt('bf')),
  NOW(), NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "Upload Test User"}'::jsonb,
  NOW(), NOW(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, slug)
VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22',
  'Upload Test Org',
  'upload-test-org'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.memberships (user_id, org_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22',
  'owner'
)
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Primary location with non-null hours_data + amenities (any truthy JSONB value
-- satisfies !primaryLocation.hours_data === false, bypassing the onboarding guard).
-- No magic_menus record is inserted — the E2E test starts from UploadState.
INSERT INTO public.locations (org_id, name, slug, business_name, is_primary, hours_data, amenities)
VALUES (
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22',
  'Upload Test Restaurant - Main',
  'upload-test-main',
  'Upload Test Restaurant',
  TRUE,
  '{"monday":{"open":"11:00","close":"22:00"},"tuesday":{"open":"11:00","close":"22:00"},"wednesday":{"open":"11:00","close":"22:00"},"thursday":{"open":"11:00","close":"22:00"},"friday":{"open":"11:00","close":"23:00"},"saturday":{"open":"11:00","close":"23:00"},"sunday":{"open":"12:00","close":"21:00"}}'::jsonb,
  '{"wifi":true,"outdoor_seating":true,"parking":true,"reservations":true}'::jsonb
)
-- DO UPDATE (not DO NOTHING) guarantees hours_data/amenities are always
-- refreshed on `npx supabase db reset`, even if the row existed previously
-- with stale or NULL values from an earlier migration run.
ON CONFLICT (org_id, slug) DO UPDATE SET
  hours_data = EXCLUDED.hours_data,
  amenities  = EXCLUDED.amenities,
  is_primary = EXCLUDED.is_primary;

-- ── 13. COMPETITOR INTERCEPT SEED DATA (Phase 3) ──────────────────────────────
-- One competitor (Cloud 9 Lounge) and one head-to-head intercept for the
-- golden tenant (Charcoal N Chill). The intercept shows Cloud 9 winning on
-- "late night atmosphere" with a suggested action for Charcoal N Chill.
--
-- Fixed UUIDs (match src/__fixtures__/golden-tenant.ts MOCK_COMPETITOR + MOCK_INTERCEPT):
--   competitor id  : a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   intercept id   : a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--
-- NOTE: model_provider value must match the model_provider ENUM in prod_schema.sql.
-- location_id retrieved via subquery (same pattern as all other sections).

INSERT INTO public.competitors (
  id, org_id, location_id, competitor_name, competitor_address
)
SELECT
  'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'Cloud 9 Lounge',
  '123 Main St, Alpharetta, GA 30005'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.competitor_intercepts (
  id, org_id, location_id,
  competitor_name, query_asked, model_provider,
  winner, winner_reason, winning_factor,
  gap_analysis, gap_magnitude,
  suggested_action, action_status,
  created_at
)
SELECT
  'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'Cloud 9 Lounge',
  'Best hookah bar in Alpharetta GA',
  'openai-gpt4o-mini',
  'Cloud 9 Lounge',
  'More review mentions of late-night atmosphere and happy hour deals.',
  '15 more review mentions of "late night" atmosphere',
  '{"competitor_mentions": 15, "your_mentions": 2}'::jsonb,
  'high',
  'Ask 3 customers to mention "late night" in their reviews this week',
  'pending',
  NOW() - INTERVAL '1 hour'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;