'use server';

// ---------------------------------------------------------------------------
// app/dashboard/settings/revenue/actions.ts — Revenue Config Server Action
//
// Upserts revenue_config for the logged-in user's org + first location.
// Uses getSafeAuthContext() (AI_RULES §11), Zod v4 (issues[0].message).
// ---------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';

export type ActionResult = { success: true } | { success: false; error: string };

// Form sends percentage values (e.g. 3.2 for 3.2%); we validate as % then
// convert to decimals before saving to DB.
const RevenueConfigSchema = z.object({
  avg_ticket: z
    .number()
    .min(1, 'Average ticket must be at least $1')
    .max(10000, 'Average ticket must be $10,000 or less'),
  monthly_searches: z
    .number()
    .int('Monthly searches must be a whole number')
    .min(0, 'Monthly searches cannot be negative')
    .max(1000000, 'Monthly searches must be 1,000,000 or less'),
  local_conversion_rate_pct: z
    .number()
    .min(0.1, 'Conversion rate must be at least 0.1%')
    .max(100, 'Conversion rate cannot exceed 100%'),
  walk_away_rate_pct: z
    .number()
    .min(1, 'Walk-away rate must be at least 1%')
    .max(100, 'Walk-away rate cannot exceed 100%'),
});

export async function saveRevenueConfig(formData: FormData): Promise<ActionResult> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) {
    return { success: false, error: 'Unauthorized' };
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const parsed = RevenueConfigSchema.safeParse({
    avg_ticket:                Number(formData.get('avg_ticket')),
    monthly_searches:          Number(formData.get('monthly_searches')),
    local_conversion_rate_pct: Number(formData.get('local_conversion_rate')),
    walk_away_rate_pct:        Number(formData.get('walk_away_rate')),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  // ── Fetch first location for this org ─────────────────────────────────────
  const supabase = await createClient();
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('org_id', ctx.orgId)
    .limit(1)
    .single();

  if (locError || !location) {
    return { success: false, error: 'No location found. Complete onboarding first.' };
  }

  // ── Upsert ────────────────────────────────────────────────────────────────
  const { error } = await supabase
    .from('revenue_config')
    .upsert(
      {
        org_id: ctx.orgId,
        location_id: location.id,
        avg_ticket: parsed.data.avg_ticket,
        monthly_searches: parsed.data.monthly_searches,
        local_conversion_rate: Math.round(parsed.data.local_conversion_rate_pct * 10) / 1000,
        walk_away_rate: Math.round(parsed.data.walk_away_rate_pct * 100) / 10000,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,location_id' },
    );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings/revenue');
  return { success: true };
}
