// ---------------------------------------------------------------------------
// lib/services/sov-seed.ts — SOV Query Seeder
//
// Surgery 2: Generates system-default target queries for a location.
// Called during onboarding after a location is created.
//
// Spec: docs/04c-SOV-ENGINE.md §3 — Query Taxonomy
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationForSeed {
  id: string;
  org_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  categories: string[] | null;
}

export interface CompetitorForSeed {
  competitor_name: string;
}

// ---------------------------------------------------------------------------
// Template definitions — Doc 04c §3.1
// ---------------------------------------------------------------------------

export function discoveryQueries(category: string, city: string, state: string): string[] {
  return [
    `best ${category} in ${city} ${state}`,
    `top ${category} near ${city}`,
    `best ${category} ${city}`,
    `${category} recommendations ${city} ${state}`,
  ];
}

export function nearMeQueries(category: string, city: string): string[] {
  return [
    `${category} near me ${city}`,
    `best ${category} near me`,
    `${category} open now ${city}`,
  ];
}

export const HOSPITALITY_CATEGORIES = [
  'restaurant', 'bar', 'lounge', 'hookah', 'cafe', 'bistro',
  'pub', 'grill', 'diner', 'eatery', 'steakhouse', 'pizzeria',
  'sushi', 'thai', 'indian', 'mexican', 'italian', 'bbq',
  'seafood', 'brunch', 'bakery', 'food', 'dining',
];

export function isHospitalityCategory(categories: string[]): boolean {
  return categories.some((cat) =>
    HOSPITALITY_CATEGORIES.some((h) => cat.toLowerCase().includes(h))
  );
}

export function occasionQueries(city: string): string[] {
  return [
    `best place for date night ${city}`,
    `birthday dinner ${city}`,
    `bachelorette party venue ${city}`,
    `girls night out ${city}`,
    `romantic restaurant ${city}`,
  ];
}

export function comparisonQueries(
  category: string,
  city: string,
  myBusiness: string,
  competitors: CompetitorForSeed[],
): string[] {
  return competitors.slice(0, 3).map(
    (c) => `best ${category} in ${city}: ${myBusiness} vs ${c.competitor_name}`,
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate and insert system-default SOV target queries for a location.
 *
 * Follows Doc 04c §3.1 template taxonomy:
 *   Tier 1: Discovery (4 queries)
 *   Tier 2: Near Me (3 queries)
 *   Tier 3: Occasion (5 queries, hospitality only)
 *   Tier 4: Comparison (1 per competitor, max 3)
 *
 * Total: 12-15 queries per location depending on category and competitors.
 *
 * Idempotent: uses ON CONFLICT DO NOTHING via ignoreDuplicates.
 */
export async function seedSOVQueries(
  location: LocationForSeed,
  competitors: CompetitorForSeed[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ seeded: number }> {
  const city = location.city ?? 'local area';
  const state = location.state ?? '';
  const categories = location.categories ?? ['restaurant'];
  const primaryCategory = categories[0] ?? 'restaurant';

  // Each entry tracks query text + its category for proper First Mover filtering
  const tagged: { text: string; category: string; occasion_tag?: string }[] = [];

  // Tier 1 — Discovery (always)
  for (const q of discoveryQueries(primaryCategory, city, state)) {
    tagged.push({ text: q, category: 'discovery' });
  }

  // Tier 2 — Near Me (always)
  for (const q of nearMeQueries(primaryCategory, city)) {
    tagged.push({ text: q, category: 'near_me' });
  }

  // Tier 3 — Occasion (hospitality categories only)
  if (isHospitalityCategory(categories)) {
    const occasionTags = ['date_night', 'birthday', 'bachelorette', 'girls_night', 'romantic'];
    const occasionTexts = occasionQueries(city);
    for (let i = 0; i < occasionTexts.length; i++) {
      tagged.push({ text: occasionTexts[i], category: 'occasion', occasion_tag: occasionTags[i] });
    }
  }

  // Tier 4 — Comparison (max 3 competitors)
  if (competitors.length > 0) {
    for (const q of comparisonQueries(primaryCategory, city, location.business_name, competitors)) {
      tagged.push({ text: q, category: 'comparison' });
    }
  }

  // Dedupe by text (keep first occurrence — preserves category assignment)
  const seen = new Set<string>();
  const unique = tagged.filter((t) => {
    const key = t.text.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Insert all queries (idempotent via unique constraint on location_id + query_text)
  const rows = unique.map((entry) => ({
    org_id: location.org_id,
    location_id: location.id,
    query_text: entry.text.trim(),
    query_category: entry.category,
    ...(entry.occasion_tag ? { occasion_tag: entry.occasion_tag } : {}),
  }));

  if (rows.length === 0) return { seeded: 0 };

  const { error } = await supabase
    .from('target_queries')
    .insert(rows)
    .select('id');

  if (error) {
    // Unique constraint violations are expected on re-seed — log but don't throw
    console.warn(`[sov-seed] Insert warning for location ${location.id}: ${error.message}`);
  }

  return { seeded: rows.length };
}
