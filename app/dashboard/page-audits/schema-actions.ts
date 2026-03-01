'use server';

// ---------------------------------------------------------------------------
// app/dashboard/page-audits/schema-actions.ts — Schema Fix Generator Action
//
// Sprint 70: Orchestrates fetch → generate → return for schema fixes.
// Sprint 104: Wires AI FAQ generator when faqSchemaPresent === false.
// Triggered by user click, not on page load (AI_RULES §5).
// ---------------------------------------------------------------------------

import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchSchemaGeneratorData } from '@/lib/data/schema-generator';
import {
  generateFAQPageSchema,
  generateOpeningHoursSchema,
  generateLocalBusinessSchema,
  type GeneratedSchema,
} from '@/lib/schema-generator';
import { generateAiFaqSet } from '@/lib/page-audit/faq-generator';

export async function generateSchemaFixes(): Promise<{
  success: boolean;
  schemas: GeneratedSchema[];
  error?: string;
}> {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) return { success: false, schemas: [], error: 'Unauthorized' };

  const supabase = await createClient();
  const data = await fetchSchemaGeneratorData(ctx.orgId, supabase);

  if (!data.location) {
    return {
      success: false,
      schemas: [],
      error: 'No primary location found. Complete onboarding first.',
    };
  }

  const schemas: GeneratedSchema[] = [];

  // Sprint 104: Check if FAQ schema is missing from most recent audit
  const { data: recentAudit } = await supabase
    .from('page_audits')
    .select('faq_schema_present, location_id, page_type, page_url')
    .eq('org_id', ctx.orgId)
    .order('last_audited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentAudit?.faq_schema_present === false && recentAudit.location_id) {
    // Fetch location context for the AI generator
    const { data: location } = await supabase
      .from('locations')
      .select('business_name, city, state, categories, amenities')
      .eq('id', recentAudit.location_id)
      .maybeSingle();

    if (location) {
      const aiSchema = await generateAiFaqSet({
        location: {
          business_name: location.business_name,
          city: location.city,
          state: location.state,
          categories: location.categories as string[] | null,
          amenities: location.amenities as Record<string, boolean | undefined> | null,
        },
        pageType: recentAudit.page_type,
      });
      // Prepend AI FAQ (more specific) before static FAQ
      schemas.push(aiSchema);
    }
  }

  const faqSchema = generateFAQPageSchema(data.location, data.queries);
  if (faqSchema) schemas.push(faqSchema);

  const hoursSchema = generateOpeningHoursSchema(data.location);
  if (hoursSchema) schemas.push(hoursSchema);

  const businessSchema = generateLocalBusinessSchema(data.location, data.integrations);
  schemas.push(businessSchema);

  // Deduplicate: keep first occurrence of each schemaType
  const seen = new Set<string>();
  const dedupedSchemas = schemas.filter((s) => {
    if (seen.has(s.schemaType)) return false;
    seen.add(s.schemaType);
    return true;
  });

  return { success: true, schemas: dedupedSchemas };
}
