-- ---------------------------------------------------------------------------
-- Migration: 20260226000005_seed_occasions_phase2.sql
-- Sprint 56C: Expand local_occasions from 20 to 32 occasions.
--
-- Adds 12 new occasions across all 4 types:
--   holiday:     Easter, Halloween, July 4th, Labor Day
--   celebration: Reunion Party, Retirement Celebration
--   recurring:   Date Night, Business Lunch, Sunday Brunch
--   seasonal:    Patio Season, Football Season, Prom/Formal Season
--
-- ON CONFLICT (name) DO NOTHING — safe for re-runs.
-- ---------------------------------------------------------------------------

INSERT INTO public.local_occasions (
  id, name, occasion_type, trigger_days_before, annual_date,
  peak_query_patterns, relevant_categories, is_active
) VALUES
-- Tier 5 — Additional Holidays
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
