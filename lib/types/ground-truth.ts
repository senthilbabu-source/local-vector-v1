// ---------------------------------------------------------------------------
// Ground Truth — Canonical TypeScript interfaces for JSONB columns
//
// SOURCE OF TRUTH: Doc 03, Section 15.
// All code that reads or writes JSONB columns on the `locations` table
// MUST import from here. Do NOT invent ad-hoc shapes.
// ---------------------------------------------------------------------------

// ── 15.1 locations.hours_data ───────────────────────────────────────────────

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface DayHours {
  open: string;   // 24h format: "17:00"
  close: string;  // 24h format: "23:00" or "01:00" (next day)
}

/**
 * A missing day key means "hours unknown" (not closed).
 * Use the string literal `"closed"` explicitly for days the venue is closed.
 *
 * @example
 * {
 *   monday: { open: "17:00", close: "23:00" },
 *   tuesday: "closed",
 * }
 */
export type HoursData = Partial<Record<DayOfWeek, DayHours | 'closed'>>;

// ── 15.2 locations.amenities ────────────────────────────────────────────────

/**
 * Core amenities are required (first 6).
 * Additional amenities use the same `has_` or `is_` prefix convention.
 * The Fear Engine checks against these keys.
 */
export interface Amenities {
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

// ── 15.3 locations.categories ───────────────────────────────────────────────

export type Categories = string[];

// ── 15.4 locations.attributes ───────────────────────────────────────────────

export interface Attributes {
  price_range?: '$' | '$$' | '$$$' | '$$$$';
  vibe?: string;
  music?: string;
  [key: string]: string | undefined;
}

// ── 15.5 competitor_intercepts.gap_analysis ──────────────────────────────────

/**
 * Quantified gap between the user's business and a competitor, as produced by
 * the GPT-4o-mini Intercept Analysis prompt (Doc 04, Section 3.2).
 *
 * Stored in `competitor_intercepts.gap_analysis` (JSONB).
 * All code that reads or writes this column MUST import this type.
 */
export interface GapAnalysis {
  /** Number of times the competitor was mentioned for the winning factor. */
  competitor_mentions: number;
  /** Number of times the user's business was mentioned for the same factor. */
  your_mentions: number;
}
