'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { z } from 'zod';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import { seedSOVQueries } from '@/lib/services/sov-seed';

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

const SaveGroundTruthSchema = z.object({
  location_id:  z.string().uuid('Invalid location ID'),
  business_name: z.string().min(1, 'Business name is required').max(255),
  amenities:    AmenitiesSchema,
  hours_data:   z.record(z.enum(DAYS), DayHoursSchema),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // ── Persist ───────────────────────────────────────────────────────────────
  // org_id filter is belt-and-suspenders: RLS org_isolation_update already
  // enforces this, but the explicit .eq('org_id', ...) makes the intent clear
  // and prevents any future RLS misconfiguration from being exploitable.
  const { error } = await supabase
    .from('locations')
    .update({
      business_name,
      hours_data:   hoursPayload,
      amenities:    amenitiesPayload,
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
        { ...fullLocation, org_id: ctx.orgId },
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
