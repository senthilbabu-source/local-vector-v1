/**
 * Golden Tenant — Charcoal N Chill
 *
 * Canonical test data used across ALL test suites (Doc 11, Section 3).
 * Every test that needs a realistic business should import from here.
 * Do NOT invent ad-hoc test data.
 *
 * Phase 3 additions: MOCK_COMPETITOR and MOCK_INTERCEPT — canonical
 * competitor intercept fixture data for all Compete page tests.
 */

export const GOLDEN_TENANT = {
  org: {
    name: 'Charcoal N Chill',
    slug: 'charcoal-n-chill',
    plan: 'growth' as const,
    plan_status: 'active' as const,
    audit_frequency: 'daily',
    max_locations: 1,
    max_ai_audits_per_month: 60,
  },
  location: {
    name: 'Charcoal N Chill - Alpharetta',
    slug: 'alpharetta',
    business_name: 'Charcoal N Chill',
    address_line1: '11950 Jones Bridge Road Ste 103',
    city: 'Alpharetta',
    state: 'GA',
    zip: '30005',
    phone: '(470) 546-4866',
    website_url: 'https://charcoalnchill.com',
    operational_status: 'OPERATIONAL',
    hours_data: {
      monday: { open: '17:00', close: '23:00' },
      tuesday: { open: '17:00', close: '23:00' },
      wednesday: { open: '17:00', close: '23:00' },
      thursday: { open: '17:00', close: '00:00' },
      friday: { open: '17:00', close: '01:00' },
      saturday: { open: '17:00', close: '01:00' },
      sunday: { open: '17:00', close: '23:00' },
    },
    amenities: {
      has_outdoor_seating: true,
      serves_alcohol: true,
      has_hookah: true,
      is_kid_friendly: false,
      takes_reservations: true,
      has_live_music: true,
      has_dj: true,
      has_private_rooms: true,
    },
    categories: ['Hookah Bar', 'Indian Restaurant', 'Fusion Restaurant', 'Lounge'],
  },
  user: {
    email: 'test-owner@charcoalnchill.com',
    full_name: 'Test Owner',
    role: 'owner' as const,
  },
} as const;

/**
 * Phase 3 — Canonical competitor fixture for Charcoal N Chill.
 * UUIDs are stable and match supabase/seed.sql Section 13.
 * Use in all Competitor Intercept unit and integration tests.
 */
export const MOCK_COMPETITOR = {
  id:                 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id:             'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  competitor_name:    'Cloud 9 Lounge',
  competitor_address: '123 Main St, Alpharetta, GA 30005',
  notes:              null,
} as const;

/**
 * Phase 3 — Canonical competitor intercept result fixture.
 * Mirrors the GPT-4o-mini Intercept Analysis output shape (Doc 04, §3.2).
 * UUIDs are stable and match supabase/seed.sql Section 13.
 */
export const MOCK_INTERCEPT = {
  id:              'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id:          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  competitor_name: 'Cloud 9 Lounge',
  query_asked:     'Best hookah bar in Alpharetta GA',
  model_provider:  'openai-gpt4o-mini',
  winner:          'Cloud 9 Lounge',
  winner_reason:   'More review mentions of late-night atmosphere and happy hour deals.',
  winning_factor:  '15 more review mentions of "late night" atmosphere',
  gap_analysis:    { competitor_mentions: 15, your_mentions: 2 },
  gap_magnitude:   'high',
  suggested_action:'Ask 3 customers to mention "late night" in their reviews this week',
  action_status:   'pending',
} as const;

/**
 * Sprint 68 — Canonical ai_audits fixture for Charcoal N Chill.
 * UUID matches supabase/seed.sql Section 16 (ai_audit_1).
 * Use in all audit-cron tests that validate ai_audits INSERT behavior.
 */
export const MOCK_AI_AUDIT = {
  id: 'd6eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  location_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  model_provider: 'openai-gpt4o' as const,
  prompt_type: 'status_check' as const,
  is_hallucination_detected: true,
  audit_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
} as const;

/**
 * Rival Tenant — used exclusively for RLS isolation tests.
 * Verifies that Tenant B cannot read or mutate Tenant A's data.
 */
export const RIVAL_TENANT = {
  org: {
    name: 'Cloud 9 Lounge',
    slug: 'cloud-9-lounge',
    plan: 'starter' as const,
    plan_status: 'active' as const,
  },
  user: {
    email: 'test-rival@cloud9lounge.com',
    full_name: 'Rival Owner',
    role: 'owner' as const,
  },
} as const;
