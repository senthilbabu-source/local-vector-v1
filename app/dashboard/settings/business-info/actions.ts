'use server';

// ---------------------------------------------------------------------------
// app/dashboard/settings/business-info/actions.ts — Sprint 93
//
// Server action for saving ALL location ground-truth and basic info fields.
// Includes Zod validation matching the canonical schemas from Doc 03 §15.
//
// NOTE: Compare with app/onboarding/actions.ts:saveGroundTruth() which handles
// only business_name, hours_data, amenities and includes onboarding-specific
// side effects (SOV query seeding). These two actions have different scopes —
// this one covers the full location edit surface for post-onboarding users.
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { z } from 'zod';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import type { Json } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Schemas (replicated from onboarding/actions.ts for independence)
// ---------------------------------------------------------------------------

// Doc 03 §15.1: A day is either { open, close } or the string "closed".
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

const HoursDataSchema = z.object(
  Object.fromEntries(DAYS.map((d) => [d, DayHoursSchema.optional()])) as {
    [K in (typeof DAYS)[number]]: z.ZodOptional<typeof DayHoursSchema>;
  },
);

const SaveBusinessInfoSchema = z.object({
  location_id:        z.string().uuid('Invalid location ID'),
  business_name:      z.string().min(1, 'Business name is required').max(255),
  phone:              z.string().max(50).nullable().optional(),
  website_url:        z.string().max(2000).nullable().optional(),
  address_line1:      z.string().max(255).nullable().optional(),
  city:               z.string().max(100).nullable().optional(),
  state:              z.string().max(50).nullable().optional(),
  zip:                z.string().max(20).nullable().optional(),
  primary_category:   z.string().max(100).nullable().optional(),
  operational_status: z.string().max(50).optional(),
  amenities:          AmenitiesSchema,
  hours_data:         HoursDataSchema,
});

export type SaveBusinessInfoInput = z.infer<typeof SaveBusinessInfoSchema>;
export type ActionResult = { success: true } | { success: false; error: string };

// ---------------------------------------------------------------------------
// saveBusinessInfo — Server Action (Sprint 93)
//
// Persists all location fields (basic info + hours + amenities) in one UPDATE.
// Belt-and-suspenders: org_id filter on top of RLS.
// ---------------------------------------------------------------------------

export async function saveBusinessInfo(
  input: SaveBusinessInfoInput
): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = SaveBusinessInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const {
    location_id,
    business_name,
    phone,
    website_url,
    address_line1,
    city,
    state,
    zip,
    primary_category,
    operational_status,
    amenities,
    hours_data,
  } = parsed.data;

  // Cast to canonical types — validation above guarantees correctness.
  const hoursPayload = hours_data as HoursData;
  const amenitiesPayload = amenities as Amenities;

  // Normalize empty strings to null for nullable DB columns.
  const normalizeEmpty = (v: string | null | undefined): string | null =>
    v === '' || v === undefined ? null : v;

  // Map primary_category to categories JSONB array.
  const categories = primary_category ? [primary_category] : null;

  const supabase = await createClient();

  // ── Persist ───────────────────────────────────────────────────────────────
  const { error } = await supabase
    .from('locations')
    .update({
      business_name,
      phone:              normalizeEmpty(phone),
      website_url:        normalizeEmpty(website_url),
      address_line1:      normalizeEmpty(address_line1),
      city:               normalizeEmpty(city),
      state:              normalizeEmpty(state),
      zip:                normalizeEmpty(zip),
      categories:         categories as unknown as Json,
      operational_status: operational_status ?? 'OPERATIONAL',
      hours_data:         hoursPayload as unknown as Json,
      amenities:          amenitiesPayload as unknown as Json,
    })
    .eq('id', location_id)
    .eq('org_id', ctx.orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/business-info');
  return { success: true };
}
