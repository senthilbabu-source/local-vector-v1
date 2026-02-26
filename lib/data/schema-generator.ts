// ---------------------------------------------------------------------------
// lib/data/schema-generator.ts — Data layer for Schema Fix Generator
//
// Sprint 70: Fetches all data needed for schema generation in one parallel
// batch. Casts JSONB columns to ground-truth types (AI_RULES §2, §9, §38.4).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { HoursData, Amenities, Categories } from '@/lib/types/ground-truth';
import type {
  SchemaLocationInput,
  SchemaQueryInput,
  SchemaIntegrationInput,
} from '@/lib/schema-generator/types';

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface SchemaGeneratorData {
  location: SchemaLocationInput | null;
  queries: SchemaQueryInput[];
  integrations: SchemaIntegrationInput[];
}

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

export async function fetchSchemaGeneratorData(
  orgId: string,
  supabase: SupabaseClient<Database>,
): Promise<SchemaGeneratorData> {
  const [locResult, queryResult, integResult] = await Promise.all([
    supabase
      .from('locations')
      .select(
        'business_name, address_line1, city, state, zip, country, phone, website_url, hours_data, amenities, categories, google_place_id',
      )
      .eq('org_id', orgId)
      .eq('is_primary', true)
      .maybeSingle(),

    supabase
      .from('target_queries')
      .select('query_text, query_category')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
      .limit(20),

    supabase
      .from('location_integrations')
      .select('platform, listing_url')
      .eq('org_id', orgId),
  ]);

  const loc = locResult.data;

  return {
    location: loc
      ? {
          business_name: loc.business_name,
          address_line1: loc.address_line1,
          city: loc.city,
          state: loc.state,
          zip: loc.zip,
          country: (loc.country as string) ?? 'US',
          phone: loc.phone,
          website_url: loc.website_url,
          hours_data: loc.hours_data as HoursData | null,
          amenities: loc.amenities as Amenities | null,
          categories: loc.categories as Categories | null,
          google_place_id: loc.google_place_id,
        }
      : null,
    queries: (queryResult.data ?? []).map((q) => ({
      query_text: q.query_text,
      query_category: q.query_category,
    })),
    integrations: (integResult.data ?? []).map((i) => ({
      platform: i.platform,
      listing_url: i.listing_url,
    })),
  };
}
