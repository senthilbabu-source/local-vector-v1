/**
 * Golden Tenant — Charcoal N Chill
 *
 * Canonical test data used across ALL test suites (Doc 11, Section 3).
 * Every test that needs a realistic business should import from here.
 * Do NOT invent ad-hoc test data.
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
