// ---------------------------------------------------------------------------
// lib/relevance/types.ts — Query Relevance Filter Types
//
// Central types for the ground-truth relevance scoring system.
// Used by SOV seeding, gap display, revenue calculator, digest emails,
// and every surface that shows recommendations to the business owner.
// ---------------------------------------------------------------------------

import type { HoursData, Amenities, Categories } from '@/lib/types/ground-truth';

// ── Input Types ─────────────────────────────────────────────────────────────

export interface QueryInput {
  queryText: string;
  queryCategory: 'discovery' | 'near_me' | 'occasion' | 'comparison' | 'custom';
  occasionTag?: string | null;
}

export interface BusinessGroundTruth {
  hoursData: HoursData | null;
  amenities: Amenities | null;
  categories: Categories | null;
  operationalStatus: string | null;
}

// ── Output Types ────────────────────────────────────────────────────────────

/**
 * 'relevant'       — business has the capability, AI just doesn't know yet
 * 'not_applicable' — business cannot serve this query (wrong hours, no amenity)
 * 'aspirational'   — business could add this capability but doesn't have it yet
 */
export type RelevanceVerdict = 'relevant' | 'not_applicable' | 'aspirational';

/**
 * Suggested next action when a gap is actionable.
 */
export interface SuggestedAction {
  type: 'content_draft' | 'schema_generation' | 'listing_update' | 'faq_generation';
  label: string;
  /** Pre-fill data for the action engine (e.g., keywords for a draft). */
  prefillData?: Record<string, string>;
}

/**
 * Result of scoring a single query against business ground truth.
 */
export interface QueryRelevanceResult {
  verdict: RelevanceVerdict;
  /** Convenience boolean — true when verdict === 'relevant'. */
  relevant: boolean;
  /** Human-readable reason for the verdict. */
  reason: string;
  /**
   * How confident the filter is in its verdict.
   * 'high'   — ground truth field directly confirms/denies (e.g., amenity boolean)
   * 'medium' — hours-based inference or category matching
   * 'low'    — no matching pattern found, defaulting to relevant
   */
  confidence: 'high' | 'medium' | 'low';
  /** Which ground truth fields informed this verdict. */
  groundTruthFields: string[];
  /** Suggested action when the gap is actionable. */
  suggestedAction?: SuggestedAction;
}

// ── Keyword Pattern Types ───────────────────────────────────────────────────

export interface TimePattern {
  keywords: string[];
  /** Query requires the business to be open before this hour (24h format). */
  requiresOpenBefore?: string;
  /** Query requires the business to be open after this hour (24h format). */
  requiresOpenAfter?: string;
}

export interface AmenityPattern {
  amenityKey: keyof Amenities;
  keywords: string[];
}
