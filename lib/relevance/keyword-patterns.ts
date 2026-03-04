// ---------------------------------------------------------------------------
// lib/relevance/keyword-patterns.ts — Query ↔ Ground Truth Keyword Mapping
//
// Maps query keywords to the ground truth fields that determine relevance.
// Pure data — no logic. Consumed by scoreQueryRelevance().
//
// MAINTENANCE: When a new amenity is added to lib/types/ground-truth.ts,
// add a corresponding entry to AMENITY_PATTERNS below.
// ---------------------------------------------------------------------------

import type { TimePattern, AmenityPattern } from './types';

// ── Time-of-Day Patterns ────────────────────────────────────────────────────
// If a query mentions these keywords, the business must be open during
// the specified window on at least one day to be considered relevant.

export const TIME_PATTERNS: TimePattern[] = [
  {
    keywords: ['breakfast', 'morning'],
    requiresOpenBefore: '10:00',
  },
  {
    keywords: ['brunch'],
    requiresOpenBefore: '12:00',
  },
  {
    keywords: ['lunch', 'midday', 'noon'],
    requiresOpenBefore: '13:00',
  },
  {
    keywords: ['late night', 'after midnight', 'late-night'],
    requiresOpenAfter: '23:00',
  },
];

// ── Amenity Patterns ────────────────────────────────────────────────────────
// If a query mentions these keywords, the corresponding amenity boolean
// must be true for the business to be considered relevant.

export const AMENITY_PATTERNS: AmenityPattern[] = [
  {
    amenityKey: 'has_outdoor_seating',
    keywords: ['outdoor seating', 'patio', 'outdoor dining', 'al fresco', 'terrace', 'rooftop'],
  },
  {
    amenityKey: 'has_hookah',
    keywords: ['hookah', 'shisha', 'narghile', 'hookah bar', 'hookah lounge'],
  },
  {
    amenityKey: 'has_live_music',
    keywords: ['live music', 'live band', 'live entertainment', 'live jazz', 'live performance'],
  },
  {
    amenityKey: 'has_private_rooms',
    keywords: [
      'private room', 'private dining', 'private event', 'private party',
      'private events', 'private venue', 'event space', 'event venue',
    ],
  },
  {
    amenityKey: 'is_kid_friendly',
    keywords: [
      'kid friendly', 'family friendly', 'kids menu', 'family dining',
      'child friendly', 'family restaurant', 'children',
    ],
  },
  {
    amenityKey: 'takes_reservations',
    keywords: ['reservation', 'book a table', 'make a reservation'],
  },
  {
    amenityKey: 'serves_alcohol',
    keywords: ['cocktail bar', 'wine bar', 'craft beer', 'happy hour', 'full bar'],
  },
  {
    amenityKey: 'has_dj',
    keywords: ['dj night', 'dj set', 'club night', 'nightclub'],
  },
];

// ── Service Patterns ────────────────────────────────────────────────────────
// Queries about services the business may or may not offer.
// These map to categories or are flagged as aspirational when no match found.

export const SERVICE_KEYWORDS: { keyword: string; categoryHints: string[] }[] = [
  {
    keyword: 'catering',
    categoryHints: ['catering', 'caterer', 'event catering'],
  },
  {
    keyword: 'delivery',
    categoryHints: ['delivery', 'food delivery'],
  },
  {
    keyword: 'takeout',
    categoryHints: ['takeout', 'take-out', 'to-go'],
  },
  {
    keyword: 'drive-through',
    categoryHints: ['drive-through', 'drive-thru', 'fast food'],
  },
];
