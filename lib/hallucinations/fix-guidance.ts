// ---------------------------------------------------------------------------
// lib/hallucinations/fix-guidance.ts — S14 (Wave 1, AI_RULES §214)
//
// Category-specific fix guidance SSOT.
// Each entry provides numbered steps, external platform links, estimated fix
// time, and an optional urgency note.
//
// Used by FixGuidancePanel.tsx in AlertCard for open/verifying alerts.
// ---------------------------------------------------------------------------

export interface FixGuidance {
  category: string;
  title: string;
  steps: string[];
  platforms: { name: string; url: string }[];
  estimatedDays: number;
  urgencyNote?: string;
}

export const FIX_GUIDANCE: Record<string, FixGuidance> = {
  hours: {
    category: 'hours',
    title: 'Update your business hours',
    steps: [
      'Log into Google Business Profile and update your hours',
      'Update hours on Yelp (business.yelp.com)',
      'Update hours on TripAdvisor if listed',
      'Submit our correction and we will re-verify in ~12 days',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 12,
    urgencyNote: 'Hours errors cause the highest walk-away rate — customers leave immediately',
  },

  closed: {
    category: 'closed',
    title: 'Tell AI you are open for business',
    steps: [
      'Log into Google Business Profile',
      'Verify your status is NOT marked as "Permanently Closed"',
      'Post a recent update (photo or announcement) to show activity',
      'Verify your hours are current — stale hours signal inactivity to AI',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
    ],
    estimatedDays: 7,
    urgencyNote: 'CRITICAL — AI recommending you as closed sends customers elsewhere immediately',
  },

  address: {
    category: 'address',
    title: 'Correct your address across all platforms',
    steps: [
      'Update address in Google Business Profile',
      'Update on Yelp — go to business.yelp.com → Location',
      'Submit correction to Apple Business Connect',
      'Update on TripAdvisor if listed',
      'Check your own website footer and contact page',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
      { name: 'Apple Business Connect', url: 'https://businessconnect.apple.com' },
    ],
    estimatedDays: 14,
  },

  phone: {
    category: 'phone',
    title: 'Update your phone number',
    steps: [
      'Update in Google Business Profile',
      'Update on Yelp',
      'Check your own website — header and contact page',
      'Update on any delivery apps (DoorDash, Uber Eats) if applicable',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 10,
  },

  menu: {
    category: 'menu',
    title: 'Correct your menu information',
    steps: [
      'Update your menu in LocalVector — changes distribute automatically',
      'Update prices on Google Business Profile Food Menus',
      'Update on Yelp menu section',
      'Update on any delivery apps if prices differ',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
    ],
    estimatedDays: 7,
  },

  cuisine: {
    category: 'cuisine',
    title: 'Correct your cuisine type',
    steps: [
      'Update your primary category in Google Business Profile',
      'Update on Yelp — Categories section',
      'Review your website homepage — does it clearly state your cuisine?',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 18,
  },

  status: {
    category: 'status',
    title: 'Correct your business status',
    steps: [
      'Log into Google Business Profile and verify you are NOT marked as "Permanently Closed" or "Temporarily Closed"',
      'Post a recent update or photo to show your business is active',
      'Verify your hours are current — stale hours signal inactivity to AI',
      'Check Yelp and TripAdvisor for the same "closed" status and correct it',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 7,
    urgencyNote: 'CRITICAL — AI telling customers you are closed sends them to competitors immediately',
  },

  amenity: {
    category: 'amenity',
    title: 'Correct your amenity information',
    steps: [
      'Log into Google Business Profile → Edit profile → More → Amenities',
      'Update incorrect amenity details (outdoor seating, parking, Wi-Fi, etc.)',
      'Check Yelp "Amenities and More" section and update if needed',
      'Update your own website to match — AI cross-references multiple sources',
    ],
    platforms: [
      { name: 'Google Business Profile', url: 'https://business.google.com' },
      { name: 'Yelp for Business', url: 'https://biz.yelp.com' },
    ],
    estimatedDays: 10,
  },
};

/**
 * Returns fix guidance for a given category key, or null if not found.
 * Case-insensitive match.
 */
export function getFixGuidance(category: string | null | undefined): FixGuidance | null {
  if (!category) return null;
  return FIX_GUIDANCE[category.toLowerCase()] ?? null;
}

/**
 * Revenue impact estimate per severity level (USD/month).
 * Used to snapshot revenue_recovered_monthly at fix time.
 */
export const SEVERITY_REVENUE_IMPACT: Record<string, number> = {
  critical: 180,
  high: 100,
  medium: 50,
  low: 20,
};

export function getRevenueImpactBySeverity(severity: string | null | undefined): number {
  if (!severity) return 0;
  return SEVERITY_REVENUE_IMPACT[severity.toLowerCase()] ?? 0;
}
