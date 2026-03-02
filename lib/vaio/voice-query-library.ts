// ---------------------------------------------------------------------------
// lib/vaio/voice-query-library.ts — Voice query taxonomy + seeding
//
// The canonical voice query template library. Voice queries are full-sentence,
// conversational, and action/intent-oriented — distinct from typed SOV queries.
//
// Sprint 109: VAIO
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { VoiceQueryTemplate, VoiceQueryCategory, VoiceQuery, GroundTruthForVAIO } from './types';
import { planSatisfies } from '@/lib/plan-enforcer';

// ---------------------------------------------------------------------------
// Template Library
// ---------------------------------------------------------------------------

export const VOICE_QUERY_TEMPLATES: VoiceQueryTemplate[] = [
  // DISCOVERY — "find me something" intent
  { template: "What's a good {category} near {city}?",
    category: 'discovery', priority: 1, intent: 'find' },
  { template: "Find me a {category} near {city} that's open right now",
    category: 'discovery', priority: 1, intent: 'find' },
  { template: "Is there a {category} in {city} with live entertainment?",
    category: 'discovery', priority: 1, intent: 'find' },
  { template: "What {category}s are near {city}?",
    category: 'discovery', priority: 2, intent: 'find' },
  { template: "Best {category} in the {city} area for a night out",
    category: 'discovery', priority: 2, intent: 'find' },
  { template: "Where can I find a {category} near {city} with good food?",
    category: 'discovery', priority: 2, intent: 'find' },

  // ACTION — "I want to do something" intent
  { template: "Where can I make a reservation at a {category} in {city}?",
    category: 'action', priority: 1, intent: 'reserve' },
  { template: "How do I book a private event at {businessName}?",
    category: 'action', priority: 1, intent: 'reserve' },
  { template: "Where can I go for a birthday party with hookah in {city}?",
    category: 'action', priority: 1, intent: 'reserve' },
  { template: "How do I get to {businessName} in {city}?",
    category: 'action', priority: 2, intent: 'find' },
  { template: "Where can I get hookah and dinner tonight near {city}?",
    category: 'action', priority: 2, intent: 'find' },
  { template: "Is {businessName} taking walk-ins tonight?",
    category: 'action', priority: 2, intent: 'confirm' },

  // COMPARISON — "which is better" intent
  { template: "Is {businessName} good for a date night in {city}?",
    category: 'comparison', priority: 1, intent: 'compare' },
  { template: "What's the best {category} in {city} for groups?",
    category: 'comparison', priority: 1, intent: 'compare' },
  { template: "Tell me about {businessName} in {city}",
    category: 'comparison', priority: 2, intent: 'compare' },
  { template: "What makes {businessName} different from other {category}s in {city}?",
    category: 'comparison', priority: 2, intent: 'compare' },

  // INFORMATION — "tell me the facts" intent
  { template: "What time does {businessName} close tonight?",
    category: 'information', priority: 1, intent: 'confirm' },
  { template: "What are {businessName}'s hours on Friday?",
    category: 'information', priority: 1, intent: 'confirm' },
  { template: "Does {businessName} in {city} have parking?",
    category: 'information', priority: 2, intent: 'confirm' },
  { template: "What food does {businessName} serve?",
    category: 'information', priority: 2, intent: 'confirm' },
  { template: "How many hookah flavors does {businessName} have?",
    category: 'information', priority: 2, intent: 'confirm' },
  { template: "What is the dress code at {businessName}?",
    category: 'information', priority: 3, intent: 'confirm' },
  { template: "Is {businessName} in {city} good for bachelorette parties?",
    category: 'information', priority: 2, intent: 'compare' },
  { template: "Does {businessName} allow kids or is it adults only?",
    category: 'information', priority: 3, intent: 'confirm' },
];

// ---------------------------------------------------------------------------
// Template Instantiation
// ---------------------------------------------------------------------------

export function instantiateVoiceTemplate(
  template: VoiceQueryTemplate,
  businessName: string,
  category: string,
  city: string,
): string {
  return template.template
    .replace(/\{businessName\}/g, businessName)
    .replace(/\{category\}/g, category)
    .replace(/\{city\}/g, city);
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export async function seedVoiceQueriesForLocation(
  supabase: SupabaseClient<Database>,
  groundTruth: GroundTruthForVAIO,
  locationId: string,
  orgId: string,
  planTier: string,
): Promise<{ seeded: number; skipped_dedup: number }> {
  const category = groundTruth.categories[0] ?? 'restaurant';

  // Starter: priority 1 only (max 8). Growth+: priority 1 + 2.
  const maxPriority = planSatisfies(planTier, 'growth') ? 2 : 1;
  const templates = VOICE_QUERY_TEMPLATES.filter((t) => t.priority <= maxPriority);

  const queries = templates.map((t) => ({
    query_text: instantiateVoiceTemplate(t, groundTruth.name, category, groundTruth.city),
    query_category: t.category as string,
  }));

  // Deduplicate by query_text
  const unique = new Map<string, { query_text: string; query_category: string }>();
  for (const q of queries) {
    if (!unique.has(q.query_text)) {
      unique.set(q.query_text, q);
    }
  }

  const rows = Array.from(unique.values()).map((q) => ({
    location_id: locationId,
    org_id: orgId,
    query_text: q.query_text,
    query_category: q.query_category,
    query_mode: 'voice' as const,
    is_active: true,
    is_system_seeded: true,
  }));

  if (rows.length === 0) return { seeded: 0, skipped_dedup: 0 };

  // Use upsert with ON CONFLICT DO NOTHING (existing unique constraint on location_id+query_text)
  const { data, error } = await supabase
    .from('target_queries')
    .upsert(rows, { onConflict: 'location_id,query_text', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[vaio/voice-query-library] Seed failed:', error.message);
    return { seeded: 0, skipped_dedup: 0 };
  }

  const seeded = data?.length ?? 0;
  return { seeded, skipped_dedup: rows.length - seeded };
}

// ---------------------------------------------------------------------------
// Query fetching
// ---------------------------------------------------------------------------

export async function getVoiceQueriesForLocation(
  supabase: SupabaseClient<Database>,
  locationId: string,
): Promise<VoiceQuery[]> {
  const { data, error } = await supabase
    .from('target_queries')
    .select('id, location_id, org_id, query_text, query_category, query_mode, is_active, citation_rate, last_run_at, is_system_seeded')
    .eq('location_id', locationId)
    .eq('query_mode', 'voice')
    .eq('is_active', true)
    .order('query_category');

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    location_id: row.location_id,
    org_id: row.org_id,
    query_text: row.query_text,
    query_category: row.query_category as VoiceQueryCategory,
    query_mode: 'voice' as const,
    is_active: row.is_active,
    citation_rate: row.citation_rate,
    last_run_at: row.last_run_at,
    is_system_seeded: row.is_system_seeded,
  }));
}
