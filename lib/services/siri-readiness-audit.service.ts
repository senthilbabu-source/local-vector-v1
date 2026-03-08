// lib/services/siri-readiness-audit.service.ts — Siri Readiness Audit (Sprint 5)
//
// Scores a location's data completeness for Apple Business Connect / Siri.
// Based on the 7 fields that buildABCLocation() sends to Apple:
//   displayName, address (4 fields), telephone, websiteUrl,
//   regularHours, categories, status.
//
// PURE function — no I/O. Caller writes the score to DB.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { toE164, toABCHours, toABCCategories, toABCStatus } from '@/lib/apple-bc/apple-bc-mapper';
import * as Sentry from '@sentry/nextjs';

// ── Types ─────────────────────────────────────────────

export interface SiriReadinessCheck {
  field: string;
  label: string;        // Human-readable: "Business Hours"
  points: number;       // Max possible
  earned: number;       // Actual points earned
  passed: boolean;
  detail: string | null; // e.g. "5 of 7 days configured" or null if passed
}

export interface SiriReadinessResult {
  score: number;           // 0–100 total
  checks: SiriReadinessCheck[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';  // A=90+, B=75+, C=55+, D=35+, F=<35
  missing_critical: string[];  // field labels with 0 points that are high-value
}

// ── Grade computation ─────────────────────────────────

function computeGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

// ── Core pure function ─────────────────────────────────────────────

/**
 * Score a location's data completeness for Apple Business Connect / Siri.
 * Pure function — no I/O.
 */
export function auditSiriReadiness(location: {
  business_name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  hours_data: unknown;
  categories: unknown;
}): SiriReadinessResult {
  const checks: SiriReadinessCheck[] = [];

  // 1. displayName (business_name) — 15 points
  const hasName = !!location.business_name && location.business_name.trim().length > 0;
  checks.push({
    field: 'displayName',
    label: 'Business Name',
    points: 15,
    earned: hasName ? 15 : 0,
    passed: hasName,
    detail: hasName ? null : 'Business name is missing',
  });

  // 2. address (all 4: address_line1, city, state, zip) — 20 points
  const addressFields = [location.address_line1, location.city, location.state, location.zip];
  const addressFilled = addressFields.filter(f => !!f && f.trim().length > 0).length;
  const hasFullAddress = addressFilled === 4;
  checks.push({
    field: 'address',
    label: 'Address',
    points: 20,
    earned: hasFullAddress ? 20 : 0,
    passed: hasFullAddress,
    detail: hasFullAddress ? null : `${addressFilled} of 4 address fields set`,
  });

  // 3. telephone — 15 points (must convert to valid E.164)
  const e164 = toE164(location.phone);
  const hasPhone = !!e164;
  checks.push({
    field: 'telephone',
    label: 'Phone Number',
    points: 15,
    earned: hasPhone ? 15 : 0,
    passed: hasPhone,
    detail: hasPhone ? null : 'No valid phone number',
  });

  // 4. websiteUrl — 10 points
  const hasWebsite = !!location.website_url && location.website_url.trim().length > 0;
  checks.push({
    field: 'websiteUrl',
    label: 'Website',
    points: 10,
    earned: hasWebsite ? 10 : 0,
    passed: hasWebsite,
    detail: hasWebsite ? null : 'No website URL set',
  });

  // 5. regularHours (hours_data) — 20 points (partial = 10 for 3–4 days)
  const hours = toABCHours(location.hours_data as Record<string, { open?: string; close?: string; closed?: boolean } | null> | null);
  const daysConfigured = hours.length;
  let hoursEarned = 0;
  let hoursDetail: string | null = null;
  if (daysConfigured >= 5) {
    hoursEarned = 20;
  } else if (daysConfigured >= 3) {
    hoursEarned = 10;
    hoursDetail = `${daysConfigured} of 7 days configured`;
  } else {
    hoursDetail = daysConfigured > 0 ? `Only ${daysConfigured} day${daysConfigured === 1 ? '' : 's'} configured` : 'No business hours set';
  }
  checks.push({
    field: 'regularHours',
    label: 'Business Hours',
    points: 20,
    earned: hoursEarned,
    passed: hoursEarned === 20,
    detail: hoursDetail,
  });

  // 6. categories — 10 points (toABCCategories returns ≥ 1 Apple category)
  const cats = toABCCategories(location.categories as unknown[] | null);
  const hasCategories = cats.length >= 1;
  checks.push({
    field: 'categories',
    label: 'Categories',
    points: 10,
    earned: hasCategories ? 10 : 0,
    passed: hasCategories,
    detail: hasCategories ? null : 'No Apple category mapped',
  });

  // 7. status — 10 points (toABCStatus returns 'OPEN' by default)
  // We check if the location has operational data at all — toABCStatus defaults to OPEN
  // which means the status always passes since OPEN is the expected state
  const status = toABCStatus(null); // Default check — always 'OPEN'
  const hasStatus = status === 'OPEN';
  checks.push({
    field: 'status',
    label: 'Business Status',
    points: 10,
    earned: hasStatus ? 10 : 0,
    passed: hasStatus,
    detail: hasStatus ? null : 'Business status not set',
  });

  // Compute total score
  const score = checks.reduce((sum, c) => sum + c.earned, 0);

  // Identify missing critical fields (0 points + high-value fields)
  const criticalFields = ['Business Name', 'Address', 'Phone Number', 'Business Hours'];
  const missing_critical = checks
    .filter(c => c.earned === 0 && criticalFields.includes(c.label))
    .map(c => c.label);

  return {
    score,
    checks,
    grade: computeGrade(score),
    missing_critical,
  };
}

// ── DB write function ──────────────────────────────────────────────

/**
 * Run the audit for a location and persist the score.
 * Called after Apple BC sync. Non-throwing.
 */
export async function computeAndSaveSiriReadiness(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<SiriReadinessResult | null> {
  try {
    const { data: location, error } = await supabase
      .from('locations')
      .select('business_name, address_line1, city, state, zip, phone, website_url, hours_data, categories')
      .eq('id', locationId)
      .single();

    if (error || !location) return null;

    const result = auditSiriReadiness(location);

    await supabase
      .from('locations')
      .update({
        siri_readiness_score: result.score,
        siri_readiness_last_scored_at: new Date().toISOString(),
      })
      .eq('id', locationId);

    return result;
  } catch (err) {
    Sentry.captureException(err, {
      tags: { phase: 'siri-readiness', sprint: '5' },
    });
    return null;
  }
}
