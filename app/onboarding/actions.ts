'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { z } from 'zod';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import { seedSOVQueries } from '@/lib/services/sov-seed';
import type { Json } from '@/lib/supabase/database.types';
import { processOrgAudit } from '@/lib/inngest/functions/audit-cron';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// Doc 03 §15.1: A day is either { open, close } or the string "closed".
// A missing key means "hours unknown" — always send "closed" explicitly.
const DayHoursSchema = z.union([
  z.literal('closed'),
  z.object({
    open:  z.string().regex(/^\d{2}:\d{2}$/, 'Open time must be HH:MM'),
    close: z.string().regex(/^\d{2}:\d{2}$/, 'Close time must be HH:MM'),
  }),
]);

const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

// Doc 03 §15.2: All 6 core amenity keys are required.
const AmenitiesSchema = z.object({
  has_outdoor_seating: z.boolean(),
  serves_alcohol:      z.boolean(),
  has_hookah:          z.boolean(),
  is_kid_friendly:     z.boolean(),
  takes_reservations:  z.boolean(),
  has_live_music:      z.boolean(),
});

// Build an optional-key object so z.infer produces Partial<Record<DayOfWeek, …>>
// (matching the canonical HoursData type from ground-truth.ts).
// z.record(z.enum(…)) infers a full Record (all keys required), which mismatches.
const HoursDataSchema = z.object(
  Object.fromEntries(DAYS.map((d) => [d, DayHoursSchema.optional()])) as {
    [K in (typeof DAYS)[number]]: z.ZodOptional<typeof DayHoursSchema>;
  },
);

const SaveGroundTruthSchema = z.object({
  location_id:  z.string().uuid('Invalid location ID'),
  business_name: z.string().min(1, 'Business name is required').max(255),
  amenities:    AmenitiesSchema,
  hours_data:   HoursDataSchema,
});

export type SaveGroundTruthInput = z.infer<typeof SaveGroundTruthSchema>;
export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// saveGroundTruth — Server Action
//
// Flow:
//  1. Authenticate — org_id always derived server-side from getSafeAuthContext()
//  2. Validate input via Zod against the canonical ground-truth schemas
//     (Doc 03 §15.1 for hours_data, §15.2 for amenities)
//  3. Persist with a dual-filter UPDATE (.eq id + org_id) — belt-and-suspenders
//     alongside the RLS org_isolation_update policy on locations
//  4. revalidatePath('/dashboard') so the Server Component refreshes on next visit
//
// Hours data format (Doc 03 §15.1):
//   Closed days  → "closed" string (NOT omitted — missing key = "unknown")
//   Open days    → { open: "HH:MM", close: "HH:MM" }
// ---------------------------------------------------------------------------

export async function saveGroundTruth(
  input: SaveGroundTruthInput
): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = SaveGroundTruthSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const { location_id, business_name, amenities, hours_data } = parsed.data;

  // Cast to canonical types — validation above guarantees correctness.
  const hoursPayload = hours_data as HoursData;
  const amenitiesPayload = amenities as Amenities;

  const supabase = await createClient();

  // ── Persist ───────────────────────────────────────────────────────────────
  // org_id filter is belt-and-suspenders: RLS org_isolation_update already
  // enforces this, but the explicit .eq('org_id', ...) makes the intent clear
  // and prevents any future RLS misconfiguration from being exploitable.
  const { error } = await supabase
    .from('locations')
    .update({
      business_name,
      hours_data:   hoursPayload as unknown as Json,
      amenities:    amenitiesPayload as unknown as Json,
    })
    .eq('id', location_id)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  // ── Seed SOV queries (best-effort) ────────────────────────────────────
  // Fetch full location data for seeding (need city, state, categories).
  // This runs after ground truth is saved — the location is now complete.
  try {
    const { data: fullLocation } = await supabase
      .from('locations')
      .select('id, business_name, city, state, categories')
      .eq('id', location_id)
      .eq('org_id', ctx.orgId)
      .single();

    if (fullLocation) {
      await seedSOVQueries(
        {
          ...fullLocation,
          org_id: ctx.orgId,
          categories: fullLocation.categories as string[] | null,
        },
        [],  // No competitors on day 1
        supabase,
      );
    }
  } catch (seedErr) {
    // Log but don't fail onboarding — seeding is non-critical
    console.warn('[onboarding] SOV seed failed:', seedErr);
  }

  revalidatePath('/dashboard');
  return { success: true };
}

// ---------------------------------------------------------------------------
// seedOnboardingCompetitors — Sprint 91
//
// Inserts 1–5 competitor names for the authenticated user's org during
// onboarding. Duplicates (case-insensitive) are silently skipped.
// ---------------------------------------------------------------------------

const CompetitorNamesSchema = z
  .array(z.string().trim().min(1).max(255))
  .min(0)
  .max(5, 'Maximum 5 competitors allowed');

export async function seedOnboardingCompetitors(
  competitorNames: string[],
): Promise<{ success: true; seeded: number } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CompetitorNamesSchema.safeParse(competitorNames);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const names = parsed.data;
  if (names.length === 0) {
    return { success: true, seeded: 0 };
  }

  const supabase = await createClient();

  // Fetch primary location for location_id
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  // Fetch existing competitors for dedup
  const { data: existing } = await supabase
    .from('competitors')
    .select('competitor_name')
    .eq('org_id', ctx.orgId);

  const existingLower = new Set(
    (existing ?? []).map((c) => c.competitor_name.toLowerCase()),
  );

  const newNames = names.filter((n) => !existingLower.has(n.toLowerCase()));
  if (newNames.length === 0) {
    return { success: true, seeded: 0 };
  }

  const rows = newNames.map((name) => ({
    org_id: ctx.orgId!,
    location_id: location?.id ?? null,
    competitor_name: name,
    notes: 'Added during onboarding',
  }));

  const { error } = await supabase.from('competitors').insert(rows);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, seeded: newNames.length };
}

// ---------------------------------------------------------------------------
// addCustomSOVQuery — Sprint 91
//
// Inserts a single custom SOV query into target_queries during onboarding.
// Uses upsert with ignoreDuplicates to handle re-submissions gracefully.
// ---------------------------------------------------------------------------

const CustomQuerySchema = z.object({
  query_text: z.string().trim().min(3, 'Query must be at least 3 characters').max(500),
});

export async function addCustomSOVQuery(
  queryText: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CustomQuerySchema.safeParse({ query_text: queryText });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid query' };
  }

  const supabase = await createClient();

  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return { success: false, error: 'No primary location found' };
  }

  const { error } = await supabase
    .from('target_queries')
    .upsert(
      {
        org_id: ctx.orgId,
        location_id: location.id,
        query_text: parsed.data.query_text,
        query_category: 'custom',
      },
      { onConflict: 'location_id,query_text', ignoreDuplicates: true },
    );

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// deleteCustomSOVQuery — Sprint 91
//
// Deletes a custom query by ID. Only custom queries (query_category='custom')
// owned by the authenticated user's org can be deleted.
// ---------------------------------------------------------------------------

export async function deleteCustomSOVQuery(
  queryId: string,
): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!z.string().uuid().safeParse(queryId).success) {
    return { success: false, error: 'Invalid query ID' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('target_queries')
    .delete()
    .eq('id', queryId)
    .eq('org_id', ctx.orgId)
    .eq('query_category', 'custom');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// getSeededQueries — Sprint 91
//
// Fetches all active target_queries for the authenticated user's org.
// Used by Step 4 of the onboarding wizard to display auto-seeded queries.
// ---------------------------------------------------------------------------

export type TargetQueryRow = {
  id: string;
  query_text: string;
  query_category: string;
};

export async function getSeededQueries(): Promise<
  { success: true; queries: TargetQueryRow[] } | { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('target_queries')
    .select('id, query_text, query_category')
    .eq('org_id', ctx.orgId)
    .eq('is_active', true)
    .order('created_at');

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, queries: (data ?? []) as TargetQueryRow[] };
}

// ---------------------------------------------------------------------------
// triggerFirstAudit — Sprint 91
//
// Triggers the first Fear Engine hallucination audit for a new org during
// onboarding. Calls processOrgAudit() directly (not via Inngest event —
// the Inngest event fans out to ALL orgs; this targets a single org).
//
// Non-blocking: failure NEVER prevents onboarding from completing.
// ---------------------------------------------------------------------------

export async function triggerFirstAudit(): Promise<
  { success: true; auditId: string | null } | { success: false; error: string }
> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const result = await processOrgAudit({
      id: ctx.orgId,
      name: ctx.orgName ?? 'Unknown',
    });
    return { success: true, auditId: result.auditId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[onboarding] First audit trigger failed:', msg);
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// completeOnboarding — Sprint 91
//
// Marks onboarding as complete for the authenticated user's org.
// Sets onboarding_completed = true on the organizations table.
// Idempotent: safe to call if already completed.
// Safety net: seeds SOV queries if none exist for the org.
// ---------------------------------------------------------------------------

export async function completeOnboarding(): Promise<ActionResult> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Use service role to bypass RLS on organizations table
  const serviceRole = createServiceRoleClient();

  const { error } = await serviceRole
    .from('organizations')
    .update({ onboarding_completed: true })
    .eq('id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Safety net: seed SOV queries if none exist
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('target_queries')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.orgId);

    if (count === 0) {
      const { data: location } = await supabase
        .from('locations')
        .select('id, business_name, city, state, categories')
        .eq('org_id', ctx.orgId)
        .eq('is_primary', true)
        .maybeSingle();

      if (location) {
        await seedSOVQueries(
          {
            ...location,
            org_id: ctx.orgId,
            categories: location.categories as string[] | null,
          },
          [],
          supabase,
        );
      }
    }
  } catch (seedErr) {
    console.warn('[onboarding] Safety-net SOV seed failed:', seedErr);
  }

  revalidatePath('/dashboard');
  revalidatePath('/onboarding');
  return { success: true };
}
