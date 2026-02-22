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
