'use server';

// ---------------------------------------------------------------------------
// app/dashboard/page-audits/schema-actions.ts — Schema Fix Generator Action
//
// Sprint 70: Orchestrates fetch → generate → return for schema fixes.
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

  const faqSchema = generateFAQPageSchema(data.location, data.queries);
  if (faqSchema) schemas.push(faqSchema);

  const hoursSchema = generateOpeningHoursSchema(data.location);
  if (hoursSchema) schemas.push(hoursSchema);

  const businessSchema = generateLocalBusinessSchema(data.location, data.integrations);
  schemas.push(businessSchema);

  return { success: true, schemas };
}
