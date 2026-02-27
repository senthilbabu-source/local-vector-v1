'use server';

import { z } from 'zod/v4';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const RevenueConfigSchema = z.object({
  locationId: z.string().uuid(),
  avgCustomerValue: z.number().min(1).max(10000),
  monthlyCovers: z.number().int().min(1).max(100000),
});

export async function updateRevenueConfig(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, error: 'Unauthorized' };

  const parsed = RevenueConfigSchema.safeParse({
    locationId: formData.get('locationId'),
    avgCustomerValue: Number(formData.get('avgCustomerValue')),
    monthlyCovers: Number(formData.get('monthlyCovers')),
  });

  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };

  const supabase = await createClient();

  // Verify location belongs to user's org (AI_RULES §18)
  const { error } = await supabase
    .from('locations')
    .update({
      avg_customer_value: parsed.data.avgCustomerValue,
      monthly_covers: parsed.data.monthlyCovers,
    })
    .eq('id', parsed.data.locationId)
    .eq('org_id', ctx.orgId);

  if (error) return { success: false, error: 'Failed to update revenue config' };

  revalidatePath('/dashboard/revenue-impact');
  return { success: true };
}
