// ---------------------------------------------------------------------------
// lib/data/correction-generator.ts
//
// Sprint 75 — Data fetcher for hallucination correction packages.
// Queries Supabase for hallucination + location ground truth, then delegates
// to the pure correction generator service (AI_RULES §39).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { HoursData, Amenities } from '@/lib/types/ground-truth';
import {
  generateCorrectionPackage,
  type CorrectionInput,
  type CorrectionPackage,
} from '@/lib/services/correction-generator.service';

/**
 * Fetches hallucination + location ground truth, generates correction package.
 * Belt-and-suspenders: scopes all queries by org_id (AI_RULES §18).
 */
export async function fetchCorrectionPackage(
  supabase: SupabaseClient<Database>,
  hallId: string,
  orgId: string,
): Promise<CorrectionPackage | null> {
  // 1. Fetch hallucination by id + org_id
  const { data: hall } = await supabase
    .from('ai_hallucinations')
    .select('id, claim_text, expected_truth, category, severity, model_provider')
    .eq('id', hallId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!hall) return null;

  // 2. Fetch primary location with ground truth
  const { data: location } = await supabase
    .from('locations')
    .select(
      'business_name, address_line1, city, state, zip, phone, website_url, hours_data, amenities, categories, operational_status',
    )
    .eq('org_id', orgId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) return null;

  // 3. Cast JSONB columns per AI_RULES §38.4
  const input: CorrectionInput = {
    hallucination: {
      id: hall.id,
      claim_text: hall.claim_text,
      expected_truth: hall.expected_truth,
      category: hall.category,
      severity: hall.severity ?? 'high',
      model_provider: hall.model_provider,
    },
    location: {
      business_name: location.business_name,
      address_line1: location.address_line1 ?? '',
      city: location.city ?? '',
      state: location.state ?? '',
      zip: location.zip ?? '',
      phone: location.phone ?? null,
      website_url: location.website_url ?? null,
      hours_data: location.hours_data as HoursData | null,
      amenities: location.amenities as Amenities | null,
      categories: location.categories as string[] | null,
      operational_status: location.operational_status ?? null,
    },
  };

  return generateCorrectionPackage(input);
}
