// ---------------------------------------------------------------------------
// lib/llms-txt/llms-txt-generator.ts — Dynamic llms.txt Generator
//
// Pure function. No I/O, no DB calls, no API calls.
//
// Takes an org's ground truth data and returns a formatted llms.txt string
// containing verified business info, hours, amenities, menu highlights,
// and hallucination corrections.
//
// Sprint 97 — Gap #62 (Dynamic llms.txt 30% -> 100%)
// AI_RULES §50: This is the ONLY place that constructs org-level llms.txt content.
// ---------------------------------------------------------------------------

import type { HoursData, DayOfWeek, DayHours, Amenities } from '@/lib/types/ground-truth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMsTxtInputData {
  org: {
    name: string;
    plan: string;
  };
  location: {
    name: string;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    website_url: string | null;
    categories: string[] | null;
    hours_data: HoursData | null;
    amenities: Partial<Amenities> | null;
    operational_status: string | null;
  };
  menuHighlights: Array<{
    name: string;
    description: string | null;
    price: number | null;
    category: string | null;
  }>;
  corrections: Array<{
    claim_text: string;
    expected_truth: string | null;
    model_provider: string;
    resolved_at: string | null;
  }>;
  publicMenuUrl: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDERED_DAYS: DayOfWeek[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
};

const AMENITY_LABELS: Record<string, string> = {
  has_outdoor_seating: 'Outdoor Seating',
  serves_alcohol:      'Full Bar / Alcohol Service',
  has_hookah:          'Hookah Lounge',
  is_kid_friendly:     'Kid-Friendly',
  takes_reservations:  'Reservations Accepted',
  has_live_music:      'Live Music',
  has_dj:              'DJ / Music Events',
  has_private_rooms:   'Private Rooms Available',
};

const MAX_CORRECTIONS = 10;
const MAX_MENU_HIGHLIGHTS = 5;
const MAX_CORRECTION_LENGTH = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a 24h time string to HH:MM display.
 */
function formatTime(time: string): string {
  const [h, m] = time.split(':');
  return `${h ?? '00'}:${m ?? '00'}`;
}

/**
 * Maps operational_status to a human-readable string.
 */
function formatStatus(status: string | null): string {
  if (!status) return 'Open';
  const s = status.toLowerCase();
  if (s === 'operational' || s === 'open') return 'Open';
  if (s === 'closed_permanently' || s === 'closed permanently') return 'Closed Permanently';
  if (s === 'closed_temporarily' || s === 'closed temporarily') return 'Closed Temporarily';
  return status;
}

/**
 * Truncates a string to maxLen chars with ellipsis.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Formats a price as "$18.00".
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generates a complete llms.txt document for the given business.
 * Returns a plain-text string ready to serve as the HTTP response body.
 *
 * All sections are conditional: omitted if the underlying data is null/empty.
 * The only guaranteed sections are the header and Business Identity.
 */
export function generateLLMsTxt(data: LLMsTxtInputData): string {
  const { location, menuHighlights, corrections, publicMenuUrl } = data;
  const businessName = location.name;
  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────
  lines.push(`# ${businessName} — AI Visibility File`);
  lines.push(`> This file provides verified, structured information about ${businessName}`);
  lines.push(`> for use by AI language models, search engines, and automated agents.`);
  lines.push(`> Last updated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // ── Business Identity ───────────────────────────────────────────────────
  lines.push('## Business Identity');

  lines.push(`- Name: ${businessName}`);

  if (location.categories && location.categories.length > 0) {
    lines.push(`- Category: ${location.categories.join(', ')}`);
  }

  const addressParts = [
    location.address_line1,
    [location.city, location.state].filter(Boolean).join(', '),
    location.zip,
  ].filter(Boolean);
  if (addressParts.length > 0) {
    lines.push(`- Address: ${addressParts.join(', ')}`);
  }

  if (location.phone) {
    lines.push(`- Phone: ${location.phone}`);
  }

  if (location.website_url) {
    lines.push(`- Website: ${location.website_url}`);
  }

  lines.push(`- Operational Status: ${formatStatus(location.operational_status)}`);
  lines.push('');

  // ── Hours of Operation ──────────────────────────────────────────────────
  if (location.hours_data) {
    try {
      lines.push('## Hours of Operation');
      for (const day of ORDERED_DAYS) {
        const h = location.hours_data[day];
        let display: string;
        if (!h) {
          display = 'Closed';
        } else if (h === 'closed') {
          display = 'Closed';
        } else {
          const dayHours = h as DayHours;
          display = `${formatTime(dayHours.open)}\u2013${formatTime(dayHours.close)}`;
        }
        lines.push(`- ${DAY_LABELS[day]}: ${display}`);
      }
      lines.push('');
    } catch {
      // Malformed hours_data — omit section entirely
    }
  }

  // ── Amenities & Features ────────────────────────────────────────────────
  if (location.amenities) {
    const trueAmenities = Object.entries(location.amenities)
      .filter(([, value]) => value === true)
      .map(([key]) => AMENITY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^(has|is|serves) /, ''));

    if (trueAmenities.length > 0) {
      lines.push('## Amenities & Features');
      for (const amenity of trueAmenities) {
        lines.push(`- ${amenity}: Yes`);
      }
      lines.push('');
    }
  }

  // ── Menu Highlights ─────────────────────────────────────────────────────
  const highlights = menuHighlights.slice(0, MAX_MENU_HIGHLIGHTS);
  if (highlights.length > 0) {
    lines.push('## Menu Highlights');
    for (const item of highlights) {
      lines.push(`### ${item.name}`);
      if (item.category) {
        lines.push(`- Category: ${item.category}`);
      }
      if (item.price !== null) {
        lines.push(`- Price: ${formatPrice(item.price)}`);
      }
      if (item.description) {
        lines.push(`- Description: ${item.description}`);
      }
    }
    lines.push('');
  }

  // ── Verified Corrections ────────────────────────────────────────────────
  const recentCorrections = corrections.slice(0, MAX_CORRECTIONS);
  if (recentCorrections.length > 0) {
    lines.push('## Verified Corrections');
    lines.push('The following facts have been verified and corrected from AI model responses:');
    for (const c of recentCorrections) {
      const claimDisplay = truncate(c.claim_text, MAX_CORRECTION_LENGTH);
      const modelDisplay = c.model_provider;
      const verifiedDate = c.resolved_at
        ? c.resolved_at.slice(0, 10)
        : 'pending';

      lines.push(`- INCORRECT: "${claimDisplay}" (as stated by ${modelDisplay})`);

      if (c.expected_truth) {
        const truthDisplay = truncate(c.expected_truth, MAX_CORRECTION_LENGTH);
        lines.push(`  CORRECT: "${truthDisplay}" (verified ${verifiedDate})`);
      }
    }
    lines.push('');
  }

  // ── Public AI-Optimized Menu Page ───────────────────────────────────────
  if (publicMenuUrl) {
    lines.push('## Public AI-Optimized Menu Page');
    lines.push(publicMenuUrl);
    lines.push('This page provides JSON-LD structured data optimized for AI model consumption.');
    lines.push('');
  }

  // ── Data Freshness ──────────────────────────────────────────────────────
  lines.push('## Data Freshness');
  lines.push('This file is auto-generated from verified business data.');
  lines.push('Corrections reflect hallucinations detected and verified in production.');

  return lines.join('\n');
}
