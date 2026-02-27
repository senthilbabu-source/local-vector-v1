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
--   competitor id  : a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   intercept id   : a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   content_draft  : b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   page_audit     : b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   occasion Val   : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   occasion NYE   : c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   occasion Bday  : c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   revenue_config : d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   rev_snapshot_1 : d3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   rev_snapshot_2 : d4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   rev_snapshot_3 : d5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   ai_audit_1     : d6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   ai_audit_2     : d7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   target_query BBQ: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (shared UUID, different table)
--   sov_eval openai : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (shared UUID, different table)
--   target_query hookah: c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 69)
--   sov_eval px BBQ : c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 69)
--   sov_eval ai hookah: c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 69)
--   sov_eval px hookah: c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 69)
--   target_query comp: c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 70)
--   target_query occ : c9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 70)
--   sov_eval google BBQ: c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 74)
--   sov_eval google hookah: c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a12  (Sprint 74)
--   sov_eval copilot BBQ: c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a13   (Sprint 79)
--   sov_eval copilot hookah: c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14 (Sprint 79)
--   crawler_hit g0-g5: g[0-5]eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 73)
--   cron_run f0-f3  : f[0-3]eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (Sprint 76)
--   vis_analytics_2  : e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 76 freshness)
--   vis_analytics_3  : e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 76 freshness)
--   vis_analytics_4  : h0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 77 timeline)
--   vis_analytics_5  : h1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 77 timeline)
--   vis_analytics_6  : h2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 77 timeline)
--   vis_analytics_7  : h3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 77 timeline)
--   entity_check     : i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11      (Sprint 80 entity health)
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

-- ── 3. ORG MEMBERSHIP + PLAN ──────────────────────────────────────────────────
-- Make the dev user an owner of the golden tenant org so the dashboard
-- shows real data from the Charcoal N Chill location on first login.
-- Set plan = 'growth' so all Growth-gated features (Compete, SOV) are
-- accessible for manual QA without extra Supabase Studio steps.

INSERT INTO public.memberships (user_id, org_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'owner'
)
ON CONFLICT (user_id, org_id) DO NOTHING;

UPDATE public.organizations
SET plan = 'growth'
WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

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

INSERT INTO public.location_integrations (org_id, location_id, platform, status, last_sync_at, listing_url)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'google',
  'connected',
  NOW() - INTERVAL '2 hours',
  'https://g.page/charcoal-n-chill-alpharetta'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (location_id, platform) DO NOTHING;

-- ── 8. AI EVALUATIONS (Phase 9 + Truth Audit) ─────────────────────────────────
-- Four evaluation rows for the AI Truth Audit dashboard:
--   • OpenAI     — high accuracy (95), no hallucinations
--   • Perplexity — lower score  (65), two mock hallucinations
--   • Anthropic  — good score   (90), one minor hallucination
--   • Gemini     — good score   (88), one minor hallucination
--
-- Fixed UUIDs:
--   OpenAI eval    : f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   Perplexity eval: f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   Anthropic eval : f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   Gemini eval    : f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
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
  'Charcoal N Chill is a popular Indian-fusion restaurant and hookah lounge located at 11950 Jones Bridge Road, Suite 103, Alpharetta, GA 30005. They can be reached at (470) 546-4866 and their website is charcoalnchill.com. The restaurant is open Tuesday through Sunday from 5:00 PM, closed on Mondays, with extended hours on weekends until 2 AM. They are known for their smoked BBQ dishes, hookah, and vibrant nightlife atmosphere.',
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

-- Anthropic eval: f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- Gemini eval:    f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.ai_evaluations (
  id, org_id, location_id, engine,
  prompt_used, response_text,
  accuracy_score, hallucinations_detected,
  created_at
)
SELECT
  'f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'anthropic',
  'Tell me about Charcoal N Chill restaurant in Alpharetta, GA. Include the address, phone number, hours, and menu highlights.',
  'Charcoal N Chill is an Indian-fusion restaurant and hookah lounge at 11950 Jones Bridge Road, Suite 103, Alpharetta, GA 30005. Phone: (470) 546-4866. Open Tuesday through Sunday from 5 PM, closed Mondays, with weekend extended hours until 2 AM. They serve a fusion menu with BBQ, hookahs, and have live entertainment on weekends.',
  90,
  '["Describes the cuisine as strictly Indian-fusion but the restaurant also features American BBQ"]'::jsonb,
  NOW() - INTERVAL '2 hours'
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
  'f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'gemini',
  'Tell me about Charcoal N Chill restaurant in Alpharetta, GA. Include the address, phone number, hours, and menu highlights.',
  'Charcoal N Chill is a restaurant and hookah bar located at 11950 Jones Bridge Road, Suite 103, Alpharetta, GA 30005. Contact: (470) 546-4866. Open Monday-Sunday starting at 5 PM with later closing on Friday and Saturday. Known for BBQ plates, hookah, and live music events.',
  82,
  '["Claims the restaurant is open Monday-Sunday but it is closed on Mondays"]'::jsonb,
  NOW() - INTERVAL '90 minutes'
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

INSERT INTO public.target_queries (id, org_id, location_id, query_text, query_category)
SELECT
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'Best BBQ restaurant in Alpharetta GA',
  'discovery'
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

-- ── 9b. SPRINT 69 — Additional SOV seeds for "AI Says" page ────────────────
-- Adds: Perplexity eval for BBQ query, new hookah query + evals (both engines).

-- Perplexity eval for existing BBQ query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'perplexity',
  1,
  '["Dreamland BBQ"]'::jsonb,
  'Based on recent reviews and local recommendations, Charcoal N Chill stands out as a top BBQ destination in Alpharetta, GA. Known for their premium smoked brisket and vibrant atmosphere, they have earned a loyal following. Dreamland BBQ is another popular option for those seeking traditional slow-smoked ribs. Sources: Yelp, Google Reviews.',
  NOW() - INTERVAL '25 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- New target query: hookah bar
INSERT INTO public.target_queries (id, org_id, location_id, query_text, query_category)
SELECT
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'Best hookah bar near Alpharetta',
  'near_me'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- OpenAI eval for hookah query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'openai',
  2,
  '["Cloud 9 Lounge"]'::jsonb,
  'Here are some of the best hookah bars near Alpharetta: 1. Cloud 9 Lounge — known for its premium hookah selection and late-night vibes. 2. Charcoal N Chill — a popular spot for Indo-American fusion cuisine with an excellent hookah menu. 3. Sahara Hookah Lounge — a cozy spot with a wide variety of flavors.',
  NOW() - INTERVAL '20 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Perplexity eval for hookah query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'perplexity',
  1,
  '["Cloud 9 Lounge", "Sahara Hookah Lounge"]'::jsonb,
  'Charcoal N Chill is widely regarded as the best hookah bar near Alpharetta. Their premium hookah service, combined with Indo-American fusion cuisine, creates a unique experience. Cloud 9 Lounge and Sahara Hookah Lounge are also popular alternatives in the area. Sources: Google Reviews, TripAdvisor.',
  NOW() - INTERVAL '15 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 9c. SPRINT 74 — Google-grounded SOV evaluation ──────────────────────────
-- Google AI Overview simulation using Gemini + Search Grounding.
-- UUID: c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

-- Google eval for BBQ query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response, cited_sources,
  created_at
)
SELECT
  'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'google',
  1,
  '["Cloud 9 Lounge", "Astra Hookah"]'::jsonb,
  'Based on recent reviews, Charcoal N Chill is a top-rated hookah lounge in Alpharetta, GA, known for its Indo-American fusion cuisine and premium hookah experience. Other popular options include Cloud 9 Lounge and Astra Hookah.',
  '[{"url": "https://www.yelp.com/biz/charcoal-n-chill-alpharetta", "title": "Yelp"}, {"url": "https://g.co/charcoal-n-chill", "title": "Google Business Profile"}]'::jsonb,
  NOW() - INTERVAL '10 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Google eval for hookah query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response, cited_sources,
  created_at
)
SELECT
  'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'google',
  1,
  '["Cloud 9 Lounge", "Sahara Hookah Lounge"]'::jsonb,
  'Charcoal N Chill is widely regarded as the best hookah bar near Alpharetta. Their premium hookah service, combined with Indo-American fusion cuisine, creates a unique experience. Cloud 9 Lounge and Sahara Hookah Lounge are also popular alternatives.',
  '[{"url": "https://www.yelp.com/biz/charcoal-n-chill-alpharetta", "title": "Charcoal N Chill - Yelp"}, {"url": "https://www.google.com/maps/place/Charcoal+N+Chill", "title": "Google Maps"}]'::jsonb,
  NOW() - INTERVAL '5 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 9d. SPRINT 79 — Copilot SOV evaluation ───────────────────────────────────
-- Microsoft Copilot simulation using GPT-4o with Bing-focused system prompt.
-- UUID: c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a13 (BBQ), c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14 (hookah)

-- Copilot eval for BBQ query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'copilot',
  2,
  '["Cloud 9 Lounge"]'::jsonb,
  'Based on Bing Places and Yelp reviews, Charcoal N Chill in Alpharetta is a well-reviewed hookah lounge offering Indo-American fusion cuisine. Cloud 9 Lounge is another popular option in the area.',
  NOW() - INTERVAL '3 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Copilot eval for hookah query
INSERT INTO public.sov_evaluations (
  id, org_id, location_id, query_id,
  engine, rank_position, mentioned_competitors, raw_response,
  created_at
)
SELECT
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'copilot',
  1,
  '["Cloud 9 Lounge", "Sahara Hookah Lounge"]'::jsonb,
  'According to Yelp and TripAdvisor reviews, Charcoal N Chill is highly rated as the best hookah bar near Alpharetta, GA. Their premium hookah service and Indo-American fusion menu stand out. Cloud 9 Lounge and Sahara Hookah Lounge are also popular alternatives.',
  NOW() - INTERVAL '2 minutes'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 9e. SPRINT 82 — Source mentions for OpenAI evaluation ──────────────────────
-- OpenAI doesn't return structured cited_sources, so source_mentions stores
-- the AI-extracted references from raw_response.
UPDATE public.sov_evaluations
SET source_mentions = '{
  "sources": [
    {"name": "Yelp", "type": "review_site", "inferredUrl": "https://www.yelp.com/biz/charcoal-n-chill-alpharetta", "context": "4.5 star rating", "isCompetitorContent": false},
    {"name": "Google Maps", "type": "directory", "inferredUrl": null, "context": "Business listing", "isCompetitorContent": false}
  ],
  "sourcingQuality": "well_sourced"
}'::jsonb
WHERE engine = 'openai'
  AND org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

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

-- ── 14. PHASE 2 TABLE SEED DATA ───────────────────────────────────────────────
-- Seeds: local_occasions (reference), content_drafts, page_audits,
--        citation_source_intelligence.
-- Skipped: google_oauth_tokens (service-role / encrypted secrets — never in dev seed),
--          pending_gbp_imports (ephemeral; expires 10 min — no dev value).
--
-- Fixed UUIDs (match reference card above):
--   content_draft  : b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   page_audit     : b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   occasion Val   : c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   occasion NYE   : c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   occasion Bday  : c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

-- ── 14a. local_occasions (shared reference table — no org_id, 32 occasions) ────
-- Doc 16 §6: Priority seeding — Phase 6 + Sprint 56C expansion (32 occasions).
-- ON CONFLICT (name) DO NOTHING for idempotent re-seeding.
INSERT INTO public.local_occasions (
  id, name, occasion_type, trigger_days_before, annual_date,
  peak_query_patterns, relevant_categories, is_active
) VALUES
-- Tier 1 — Hospitality Core
(
  'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Valentine''s Day',
  'holiday',
  28,
  '02-14',
  '[{"query":"romantic dinner {city}","category":"occasion"},{"query":"best place for date night {city}","category":"occasion"},{"query":"Valentine''s dinner {city}","category":"occasion"}]'::jsonb,
  '["restaurant","hookah lounge","bar","event venue","lounge"]'::jsonb,
  TRUE
),
(
  'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'New Year''s Eve',
  'holiday',
  42,
  '12-31',
  '[{"query":"NYE dinner {city}","category":"occasion"},{"query":"New Year''s Eve plans {city}","category":"occasion"},{"query":"NYE party venue {city}","category":"occasion"}]'::jsonb,
  '["restaurant","hookah lounge","bar","nightclub","event venue","lounge"]'::jsonb,
  TRUE
),
(
  'c4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Mother''s Day',
  'holiday',
  28,
  '05-11',
  '[{"query":"Mother''s Day brunch {city}","category":"occasion"},{"query":"Mother''s Day dinner {city}","category":"occasion"},{"query":"where to take mom {city}","category":"occasion"}]'::jsonb,
  '["restaurant","cafe","bakery","brunch"]'::jsonb,
  TRUE
),
(
  'c5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Father''s Day',
  'holiday',
  21,
  '06-15',
  '[{"query":"Father''s Day dinner {city}","category":"occasion"},{"query":"Father''s Day restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","bar","steakhouse","bbq","grill"]'::jsonb,
  TRUE
),
(
  'c6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Christmas Eve',
  'holiday',
  21,
  '12-24',
  '[{"query":"Christmas Eve dinner {city}","category":"occasion"},{"query":"holiday dinner {city}","category":"occasion"}]'::jsonb,
  '["restaurant","bar","lounge","event venue"]'::jsonb,
  TRUE
),
(
  'c7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Thanksgiving Eve',
  'holiday',
  21,
  '11-27',
  '[{"query":"Thanksgiving Eve bar {city}","category":"occasion"},{"query":"Wednesday before Thanksgiving plans {city}","category":"occasion"}]'::jsonb,
  '["bar","lounge","hookah lounge","nightclub","restaurant"]'::jsonb,
  TRUE
),
(
  'c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'New Year''s Day',
  'holiday',
  14,
  '01-01',
  '[{"query":"New Year''s Day brunch {city}","category":"occasion"},{"query":"hangover brunch {city}","category":"occasion"}]'::jsonb,
  '["restaurant","cafe","brunch","bar"]'::jsonb,
  TRUE
),
-- Tier 2 — Celebration Milestones
(
  'c3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Birthday Celebration',
  'recurring',
  14,
  NULL,
  '[{"query":"best restaurant for birthday dinner {city}","category":"occasion"},{"query":"birthday party venues near me","category":"occasion"}]'::jsonb,
  '["restaurant","hookah lounge","bar","event venue","lounge"]'::jsonb,
  TRUE
),
(
  'c9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Bachelorette Party',
  'celebration',
  60,
  NULL,
  '[{"query":"bachelorette party venue {city}","category":"occasion"},{"query":"girls night out {city}","category":"occasion"},{"query":"bachelorette dinner {city}","category":"occasion"}]'::jsonb,
  '["bar","lounge","hookah lounge","nightclub","event venue","restaurant"]'::jsonb,
  TRUE
),
(
  'ca00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Anniversary Dinner',
  'recurring',
  14,
  NULL,
  '[{"query":"anniversary restaurant {city}","category":"occasion"},{"query":"romantic anniversary dinner {city}","category":"occasion"}]'::jsonb,
  '["restaurant","lounge","bar","steakhouse"]'::jsonb,
  TRUE
),
(
  'cb00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Graduation Dinner',
  'celebration',
  21,
  NULL,
  '[{"query":"graduation dinner {city}","category":"occasion"},{"query":"graduation celebration {city}","category":"occasion"}]'::jsonb,
  '["restaurant","event venue","bar","lounge"]'::jsonb,
  TRUE
),
(
  'cc00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Baby Shower Brunch',
  'celebration',
  14,
  NULL,
  '[{"query":"baby shower venue {city}","category":"occasion"},{"query":"baby shower brunch {city}","category":"occasion"}]'::jsonb,
  '["restaurant","cafe","brunch","event venue"]'::jsonb,
  TRUE
),
(
  'cd00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Engagement Celebration',
  'celebration',
  14,
  NULL,
  '[{"query":"engagement party venue {city}","category":"occasion"},{"query":"where to celebrate engagement {city}","category":"occasion"}]'::jsonb,
  '["restaurant","bar","lounge","event venue"]'::jsonb,
  TRUE
),
-- Tier 3 — Cultural & Ethnic Occasions
(
  'ce00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Diwali',
  'holiday',
  21,
  NULL,
  '[{"query":"Diwali dinner {city}","category":"occasion"},{"query":"Diwali celebration restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","indian","lounge","event venue"]'::jsonb,
  TRUE
),
(
  'cf00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'St. Patrick''s Day',
  'holiday',
  21,
  '03-17',
  '[{"query":"St Patrick''s Day bar {city}","category":"occasion"},{"query":"St Patrick''s Day party {city}","category":"occasion"}]'::jsonb,
  '["bar","pub","lounge","restaurant"]'::jsonb,
  TRUE
),
(
  'd000bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Cinco de Mayo',
  'holiday',
  21,
  '05-05',
  '[{"query":"Cinco de Mayo party {city}","category":"occasion"},{"query":"Cinco de Mayo restaurant {city}","category":"occasion"}]'::jsonb,
  '["bar","mexican","restaurant","lounge"]'::jsonb,
  TRUE
),
(
  'd100bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Eid al-Fitr',
  'holiday',
  28,
  NULL,
  '[{"query":"iftar dinner {city}","category":"occasion"},{"query":"Eid celebration restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","halal","hookah lounge","event venue"]'::jsonb,
  TRUE
),
(
  'd200bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Lunar New Year',
  'holiday',
  28,
  NULL,
  '[{"query":"Lunar New Year dinner {city}","category":"occasion"},{"query":"Chinese New Year restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","asian","lounge","event venue"]'::jsonb,
  TRUE
),
-- Tier 4 — Seasonal & Recurring
(
  'd300bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Super Bowl Sunday',
  'seasonal',
  14,
  '02-09',
  '[{"query":"Super Bowl watch party venue {city}","category":"occasion"},{"query":"game day bar {city}","category":"occasion"}]'::jsonb,
  '["bar","lounge","hookah lounge","restaurant","pub"]'::jsonb,
  TRUE
),
(
  'd400bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Holiday Party Season',
  'seasonal',
  21,
  '11-01',
  '[{"query":"holiday party venue {city}","category":"occasion"},{"query":"corporate holiday dinner {city}","category":"occasion"}]'::jsonb,
  '["restaurant","bar","lounge","event venue","hookah lounge"]'::jsonb,
  TRUE
),
-- Tier 5 — Additional Holidays (Sprint 56C — Phase 2, 12 more occasions)
(
  'd500bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Easter',
  'holiday',
  21,
  NULL,
  '[{"query":"Easter brunch {city}","category":"occasion"},{"query":"Easter dinner {city}","category":"occasion"},{"query":"family Easter restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","cafe","brunch","bakery"]'::jsonb,
  TRUE
),
(
  'd600bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Halloween',
  'holiday',
  21,
  '10-31',
  '[{"query":"Halloween party venue {city}","category":"occasion"},{"query":"Halloween bar {city}","category":"occasion"},{"query":"costume party near me","category":"occasion"}]'::jsonb,
  '["bar","lounge","nightclub","hookah lounge","event venue","restaurant"]'::jsonb,
  TRUE
),
(
  'd700bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'July 4th',
  'holiday',
  21,
  '07-04',
  '[{"query":"4th of July restaurant {city}","category":"occasion"},{"query":"July 4th bar {city}","category":"occasion"},{"query":"Independence Day party {city}","category":"occasion"}]'::jsonb,
  '["bar","restaurant","bbq","grill","event venue"]'::jsonb,
  TRUE
),
(
  'd800bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Labor Day Weekend',
  'holiday',
  14,
  '09-01',
  '[{"query":"Labor Day weekend restaurant {city}","category":"occasion"},{"query":"Labor Day brunch {city}","category":"occasion"}]'::jsonb,
  '["restaurant","bar","brunch","bbq","grill"]'::jsonb,
  TRUE
),
-- Tier 5 — Additional Celebrations
(
  'd900bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Reunion Party',
  'celebration',
  30,
  NULL,
  '[{"query":"family reunion venue {city}","category":"occasion"},{"query":"class reunion restaurant {city}","category":"occasion"},{"query":"private dining {city}","category":"occasion"}]'::jsonb,
  '["restaurant","event venue","bar","lounge"]'::jsonb,
  TRUE
),
(
  'da00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Retirement Celebration',
  'celebration',
  21,
  NULL,
  '[{"query":"retirement dinner venue {city}","category":"occasion"},{"query":"retirement party restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","event venue","bar","lounge","steakhouse"]'::jsonb,
  TRUE
),
-- Tier 5 — Additional Recurring
(
  'db00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Date Night',
  'recurring',
  7,
  NULL,
  '[{"query":"date night restaurants {city}","category":"occasion"},{"query":"romantic dinner near me","category":"occasion"},{"query":"best date spot {city}","category":"occasion"}]'::jsonb,
  '["restaurant","lounge","bar","hookah lounge","steakhouse"]'::jsonb,
  TRUE
),
(
  'dc00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Business Lunch',
  'recurring',
  3,
  NULL,
  '[{"query":"business lunch {city}","category":"occasion"},{"query":"client lunch near me","category":"occasion"},{"query":"best restaurant for business meeting {city}","category":"occasion"}]'::jsonb,
  '["restaurant","steakhouse","cafe"]'::jsonb,
  TRUE
),
(
  'dd00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Sunday Brunch',
  'recurring',
  3,
  NULL,
  '[{"query":"Sunday brunch {city}","category":"occasion"},{"query":"best brunch spot {city}","category":"occasion"},{"query":"bottomless brunch near me","category":"occasion"}]'::jsonb,
  '["restaurant","cafe","brunch","bar"]'::jsonb,
  TRUE
),
-- Tier 5 — Additional Seasonal
(
  'de00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Patio Season',
  'seasonal',
  14,
  '04-15',
  '[{"query":"best patio restaurant {city}","category":"occasion"},{"query":"outdoor dining near me","category":"occasion"},{"query":"rooftop bar {city}","category":"occasion"}]'::jsonb,
  '["restaurant","bar","lounge","cafe","brunch"]'::jsonb,
  TRUE
),
(
  'df00bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Football Season',
  'seasonal',
  14,
  '09-07',
  '[{"query":"football watch party {city}","category":"occasion"},{"query":"sports bar near me","category":"occasion"},{"query":"NFL Sunday bar {city}","category":"occasion"}]'::jsonb,
  '["bar","pub","restaurant","lounge"]'::jsonb,
  TRUE
),
(
  'e000bc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Prom and Formal Season',
  'seasonal',
  28,
  '04-01',
  '[{"query":"prom dinner {city}","category":"occasion"},{"query":"formal dining near me","category":"occasion"},{"query":"pre-prom restaurant {city}","category":"occasion"}]'::jsonb,
  '["restaurant","steakhouse","lounge"]'::jsonb,
  TRUE
)
ON CONFLICT (name) DO NOTHING;

-- ── 14b. content_drafts (golden tenant — Charcoal N Chill) ────────────────────
INSERT INTO public.content_drafts (
  id, org_id, location_id,
  trigger_type, trigger_id,
  draft_title, draft_content, target_prompt, content_type,
  aeo_score, status, human_approved,
  created_at, updated_at
)
SELECT
  'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'competitor_gap',
  'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',  -- links to golden intercept
  'Why Charcoal N Chill Has the Best Late-Night Hookah Experience in Alpharetta',
  'When you''re searching for the best late-night hookah bar in Alpharetta, Charcoal N Chill stands out for three reasons: premium charcoal-managed hookahs, a full bar serving craft cocktails, and a vibrant atmosphere open until 1 AM on weekends. Our customers describe the experience as the closest thing to a luxury lounge outside of Atlanta.',
  'Best hookah bar in Alpharetta GA open late',
  'faq_page',
  72,
  'draft',
  FALSE,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 14c. page_audits (golden tenant — homepage audit) ─────────────────────────
INSERT INTO public.page_audits (
  id, org_id, location_id,
  page_url, page_type,
  aeo_readability_score, answer_first_score, schema_completeness_score, faq_schema_present,
  faq_schema_score, entity_clarity_score,
  overall_score,
  recommendations,
  last_audited_at, created_at
)
SELECT
  'b2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'https://charcoalnchill.com',
  'homepage',
  78,                          -- aeo_readability_score
  65,                          -- answer_first_score
  55,                          -- schema_completeness_score
  FALSE,                       -- faq_schema_present
  0,                           -- faq_schema_score (no FAQ schema)
  62,                          -- entity_clarity_score (has name+address but missing hours in text)
  66,                          -- overall_score
  '[{"issue":"Opening text is navigation/hero copy with no substance","fix":"Replace your opening section with: \"Charcoal N Chill is Alpharetta''s premier [value prop]. [Top differentiator]. [CTA].\" Start with the answer.","impactPoints":35,"dimensionKey":"answerFirst"},{"issue":"Missing required JSON-LD schema for homepage page","fix":"Add a <script type=\"application/ld+json\"> block with the correct @type for your homepage page. This is the single highest-impact technical fix for AI visibility.","impactPoints":25,"dimensionKey":"schemaCompleteness","schemaType":"LocalBusiness"},{"issue":"No FAQPage schema found — this is the #1 driver of AI citations","fix":"Add FAQPage schema with at least 5 Q&A pairs about Charcoal N Chill. AI models directly extract and quote FAQ content.","impactPoints":20,"dimensionKey":"faqSchema","schemaType":"FAQPage"}]'::jsonb,
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  faq_schema_score = EXCLUDED.faq_schema_score,
  entity_clarity_score = EXCLUDED.entity_clarity_score,
  recommendations = EXCLUDED.recommendations;

-- ── 14d. citation_source_intelligence (aggregate market data) ─────────────────
-- Hookah lounge / Alpharetta market — which platforms AI cites most.
INSERT INTO public.citation_source_intelligence (
  business_category, city, state, platform,
  citation_frequency, sample_query, sample_size, model_provider, measured_at
) VALUES
(
  'hookah lounge', 'Alpharetta', 'GA', 'yelp',
  0.72,
  'Best hookah lounge in Alpharetta GA',
  25, 'perplexity-sonar', NOW() - INTERVAL '1 day'
),
(
  'hookah lounge', 'Alpharetta', 'GA', 'google',
  0.88,
  'Best hookah lounge in Alpharetta GA',
  25, 'perplexity-sonar', NOW() - INTERVAL '1 day'
),
(
  'hookah lounge', 'Alpharetta', 'GA', 'tripadvisor',
  0.44,
  'Hookah bars near Alpharetta rated',
  25, 'perplexity-sonar', NOW() - INTERVAL '1 day'
),
(
  'hookah lounge', 'Alpharetta', 'GA', 'facebook',
  0.28,
  'Popular hookah lounges Alpharetta GA',
  25, 'perplexity-sonar', NOW() - INTERVAL '1 day'
)
ON CONFLICT (business_category, city, state, platform, model_provider) DO NOTHING;

-- ── 15. REVENUE LEAK CONFIG (Feature #1) ─────────────────────────────────────
INSERT INTO public.revenue_config (
    id, org_id, location_id, business_type, avg_ticket,
    monthly_searches, local_conversion_rate, walk_away_rate
)
SELECT
    'd2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    l.id,
    'restaurant', 47.50, 2400, 0.0320, 0.6500
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id) DO NOTHING;

-- ── 15b. REVENUE SNAPSHOTS (3 weeks of mock data) ────────────────────────────
INSERT INTO public.revenue_snapshots (
    id, org_id, location_id, leak_low, leak_high, breakdown, inputs_snapshot, snapshot_date
)
SELECT
    'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    l.id,
    2100.00, 3800.00,
    '{"hallucination_cost":{"low":800,"high":1400},"sov_gap_cost":{"low":900,"high":1600},"competitor_steal_cost":{"low":400,"high":800}}'::jsonb,
    '{"avg_ticket":47.50,"monthly_searches":2400,"local_conversion_rate":0.032,"walk_away_rate":0.65}'::jsonb,
    CURRENT_DATE - INTERVAL '14 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

INSERT INTO public.revenue_snapshots (
    id, org_id, location_id, leak_low, leak_high, breakdown, inputs_snapshot, snapshot_date
)
SELECT
    'd4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    l.id,
    2400.00, 4100.00,
    '{"hallucination_cost":{"low":900,"high":1500},"sov_gap_cost":{"low":1000,"high":1700},"competitor_steal_cost":{"low":500,"high":900}}'::jsonb,
    '{"avg_ticket":47.50,"monthly_searches":2400,"local_conversion_rate":0.032,"walk_away_rate":0.65}'::jsonb,
    CURRENT_DATE - INTERVAL '7 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

INSERT INTO public.revenue_snapshots (
    id, org_id, location_id, leak_low, leak_high, breakdown, inputs_snapshot, snapshot_date
)
SELECT
    'd5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    l.id,
    2600.00, 4400.00,
    '{"hallucination_cost":{"low":1000,"high":1700},"sov_gap_cost":{"low":1100,"high":1800},"competitor_steal_cost":{"low":500,"high":900}}'::jsonb,
    '{"avg_ticket":47.50,"monthly_searches":2400,"local_conversion_rate":0.032,"walk_away_rate":0.65}'::jsonb,
    CURRENT_DATE
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

-- ── 16. AI AUDITS (Sprint 68 — scan log entries) ─────────────────────────────
-- Two audit rows for the golden tenant: one recent (yesterday, found hallucinations)
-- and one older (7 days ago, clean scan). These populate the dashboard "Last Scan"
-- timestamp via the ai_audits.audit_date query in lib/data/dashboard.ts.
--
-- Fixed UUIDs:
--   ai_audit_1 : d6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (yesterday, hallucinations found)
--   ai_audit_2 : d7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  (7 days ago, clean scan)

-- Audit #1 — Recent scan that found hallucinations
INSERT INTO public.ai_audits (
  id, org_id, location_id,
  model_provider, prompt_type,
  is_hallucination_detected, audit_date
)
SELECT
  'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'openai-gpt4o',
  'status_check',
  true,
  NOW() - INTERVAL '1 day'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Audit #2 — Older clean scan (no hallucinations)
INSERT INTO public.ai_audits (
  id, org_id, location_id,
  model_provider, prompt_type,
  is_hallucination_detected, audit_date
)
SELECT
  'd7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'openai-gpt4o',
  'status_check',
  false,
  NOW() - INTERVAL '7 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Link existing hallucination seed rows to audit #1 (the recent scan)
UPDATE public.ai_hallucinations
SET audit_id = 'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND audit_id IS NULL;

-- ── 17. ADDITIONAL TARGET QUERIES (Sprint 70 — Schema Fix Generator) ────────
-- The FAQ schema generator needs varied query categories for rich Q&A pairs.

-- Comparison query
INSERT INTO public.target_queries (id, org_id, location_id, query_text, query_category)
SELECT
  'c8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'Charcoal N Chill vs Cloud 9 Lounge Alpharetta',
  'comparison'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Occasion query
INSERT INTO public.target_queries (id, org_id, location_id, query_text, query_category)
SELECT
  'c9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'birthday party venue Alpharetta with hookah and private rooms',
  'occasion'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 18. YELP INTEGRATION (Sprint 70 — Schema Fix Generator) ─────────────────
-- Adds a Yelp integration with listing_url so the LocalBusiness schema has
-- sameAs links.

INSERT INTO public.location_integrations (org_id, location_id, platform, status, last_sync_at, listing_url)
SELECT
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'yelp',
  'connected',
  NOW() - INTERVAL '5 hours',
  'https://www.yelp.com/biz/charcoal-n-chill-alpharetta'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (location_id, platform) DO NOTHING;

-- ── 19. VISIBILITY ANALYTICS (Sprint 72 — AI Health Score) ──────────────────
-- Adds a visibility_analytics snapshot so the AI Health Score has SOV data.
-- share_of_voice is a float 0.0–1.0 representing the aggregate SOV percentage.
--
-- Fixed UUID:
--   vis_analytics_1 : e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.42,
  0.35,
  (CURRENT_DATE - INTERVAL '1 day')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 19b. ADDITIONAL VISIBILITY ANALYTICS (Sprint 76 — Freshness Decay) ──────
-- Two older snapshots to create a 3-point declining citation_rate pattern.
-- Combined with Section 19's snapshot (1 day ago, citation_rate=0.35),
-- this gives: 0.45 → 0.42 → 0.35 — a 16.7% drop that demonstrates the trend.
--
-- Fixed UUIDs:
--   vis_analytics_2 : e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   vis_analytics_3 : e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.50,
  0.45,
  (CURRENT_DATE - INTERVAL '14 days')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.46,
  0.42,
  (CURRENT_DATE - INTERVAL '7 days')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

-- ── 20. CRAWLER HITS (Sprint 73 — AI Crawler Analytics) ─────────────────────
-- Seed rows for crawler_hits so the Bot Activity dashboard has data in local dev.
-- 6 rows: 2x GPTBot, 1x ClaudeBot, 2x Google-Extended, 1x OAI-SearchBot.
-- Leaves PerplexityBot, Meta-External, Bytespider, Amazonbot, Applebot as blind spots.
--
-- Fixed UUIDs:
--   crawler_hit g0 : g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   crawler_hit g1 : g1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   crawler_hit g2 : g2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   crawler_hit g3 : g3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   crawler_hit g4 : g4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   crawler_hit g5 : g5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.crawler_hits (id, org_id, menu_id, location_id, bot_type, user_agent, crawled_at)
SELECT
  'g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'gptbot',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  NOW() - INTERVAL '2 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crawler_hits (id, org_id, menu_id, location_id, bot_type, user_agent, crawled_at)
SELECT
  'g1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'gptbot',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)',
  NOW() - INTERVAL '5 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crawler_hits (id, org_id, menu_id, location_id, bot_type, user_agent, crawled_at)
SELECT
  'g2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'claudebot',
  'ClaudeBot/1.0',
  NOW() - INTERVAL '3 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crawler_hits (id, org_id, menu_id, location_id, bot_type, user_agent, crawled_at)
SELECT
  'g3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'google-extended',
  'Mozilla/5.0 (compatible; Google-Extended)',
  NOW() - INTERVAL '1 day'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crawler_hits (id, org_id, menu_id, location_id, bot_type, user_agent, crawled_at)
SELECT
  'g4eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'google-extended',
  'Mozilla/5.0 (compatible; Google-Extended)',
  NOW() - INTERVAL '7 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crawler_hits (id, org_id, menu_id, location_id, bot_type, user_agent, crawled_at)
SELECT
  'g5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'oai-searchbot',
  'OAI-SearchBot/1.0',
  NOW() - INTERVAL '4 days'
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- ── 21. CRON RUN LOG (Sprint 76 — System Health Dashboard) ──────────────────
-- Seed rows so the System Health page has data in local dev.
-- 4 runs: audit (success), sov (failed), citation (success), content-audit (success).
--
-- Fixed UUIDs:
--   cron_run f0 : f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   cron_run f1 : f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   cron_run f2 : f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   cron_run f3 : f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.cron_run_log (id, cron_name, started_at, completed_at, duration_ms, status, summary, error_message) VALUES
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'audit',         NOW() - INTERVAL '6 hours',  NOW() - INTERVAL '6 hours' + INTERVAL '2 minutes 30 seconds', 150000, 'success', '{"orgs_processed": 5, "hallucinations_found": 3}', NULL),
  ('f1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'sov',           NOW() - INTERVAL '2 days',   NOW() - INTERVAL '2 days' + INTERVAL '1 minute',               60000,  'failed',  NULL,                                                'Perplexity API rate limit exceeded'),
  ('f2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'citation',      NOW() - INTERVAL '25 days',  NOW() - INTERVAL '25 days' + INTERVAL '3 minutes',              180000, 'success', '{"categories_processed": 3, "citations_found": 12}', NULL),
  ('f3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'content-audit', NOW() - INTERVAL '20 days',  NOW() - INTERVAL '20 days' + INTERVAL '2 minutes',              120000, 'success', '{"pages_audited": 5, "avg_score": 72}',              NULL)
ON CONFLICT (id) DO NOTHING;

-- ── 22. PROOF TIMELINE SEED DATA (Sprint 77 — Before/After Proof Timeline) ──
-- Additional visibility_analytics rows for timeline history showing SOV progression.
-- Uses dates at -56, -49, -42, -35 days to avoid conflicts with Sprint 76's
-- snapshots at -1, -7, -14 days.
--
-- Fixed UUIDs:
--   vis_analytics_4 : h0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   vis_analytics_5 : h1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   vis_analytics_6 : h2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
--   vis_analytics_7 : h3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'h0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.12,
  0.30,
  (CURRENT_DATE - INTERVAL '56 days')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'h1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.12,
  0.32,
  (CURRENT_DATE - INTERVAL '49 days')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'h2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.17,
  0.38,
  (CURRENT_DATE - INTERVAL '42 days')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

INSERT INTO public.visibility_analytics (id, org_id, location_id, share_of_voice, citation_rate, snapshot_date)
SELECT
  'h3eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  0.19,
  0.40,
  (CURRENT_DATE - INTERVAL '35 days')::date
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id, snapshot_date) DO NOTHING;

-- ── 25. ENTITY CHECKS SEED DATA (Sprint 80) ────────────────────────────────
-- Entity Knowledge Graph Health Monitor — Charcoal N Chill has 3/6 core
-- platforms confirmed (Google KP, GBP, Yelp). TripAdvisor and Apple Maps
-- missing. Bing Places incomplete. Wikidata unchecked.
--
-- Fixed UUIDs:
--   entity_check : i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11

INSERT INTO public.entity_checks
  (id, org_id, location_id,
   google_knowledge_panel, google_business_profile, yelp,
   tripadvisor, apple_maps, bing_places, wikidata,
   entity_score, platform_metadata)
SELECT
  'i0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  l.id,
  'confirmed', 'confirmed', 'confirmed',
  'missing', 'missing', 'incomplete', 'unchecked',
  50,
  '{"google_knowledge_panel": {"place_id": "ChIJtest123"}, "bing_places": {"note": "Missing hours"}}'::jsonb
FROM public.locations l
WHERE l.org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND l.slug   = 'alpharetta'
LIMIT 1
ON CONFLICT (org_id, location_id) DO NOTHING;

-- ── 26. REVENUE CONFIG SEED DATA (Sprint 85) ───────────────────────────────
-- Revenue Impact Calculator — Set avg_customer_value and monthly_covers on
-- the Charcoal N Chill location for deterministic revenue impact tests.

UPDATE public.locations
SET avg_customer_value = 45.00,
    monthly_covers = 800
WHERE org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND slug = 'alpharetta';