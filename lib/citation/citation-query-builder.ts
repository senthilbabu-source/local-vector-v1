// ---------------------------------------------------------------------------
// lib/citation/citation-query-builder.ts — Tenant-Derived Citation Query Builder
//
// Pure functions. No I/O, no DB calls, no API calls.
//
// Builds Perplexity search queries from a tenant's real business category
// and location (city/state), replacing the hardcoded TRACKED_CATEGORIES
// and TRACKED_METROS arrays.
//
// Sprint 97 — Gap #60 (Citation Intelligence Cron 40% -> 100%)
// AI_RULES §50: This is the ONLY place citation queries are constructed.
// ---------------------------------------------------------------------------

/**
 * State abbreviation map for common US states.
 * Used by buildMetroVariants to expand state codes to full names.
 */
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

/**
 * Normalizes a GBP category string to a short, search-friendly label.
 *
 * "Restaurant > Hookah Bar" -> "hookah bar"
 * "food_service > indian_restaurant" -> "indian restaurant"
 * "Hookah Bar" -> "hookah bar"
 * "" / null -> "business"
 *
 * Truncates to 100 chars max to avoid query string issues.
 */
export function normalizeCategoryLabel(rawCategory: string | null | undefined): string {
  if (!rawCategory || rawCategory.trim() === '') return 'business';

  // Take last segment after ">" or "/" separators (most specific category)
  const segments = rawCategory.split(/[>/]/);
  const lastSegment = segments[segments.length - 1] ?? rawCategory;

  const normalized = lastSegment
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')      // "indian_restaurant" -> "indian restaurant"
    .replace(/\s+/g, ' ');   // collapse whitespace

  if (normalized === '') return 'business';

  return normalized.slice(0, 100);
}

/**
 * Returns metro variants for a city+state combination.
 * Produces at least 2 unique variants to broaden query coverage.
 *
 * "Alpharetta", "GA" -> ["Alpharetta Georgia", "Alpharetta GA"]
 * "North Atlanta", "GA" -> ["North Atlanta Georgia", "North Atlanta GA"]
 */
export function buildMetroVariants(city: string, state: string): string[] {
  const trimCity = city.trim();
  const trimState = state.trim().toUpperCase();
  const variants = new Set<string>();

  // Variant 1: City + full state name
  const fullStateName = STATE_NAMES[trimState];
  if (fullStateName) {
    variants.add(`${trimCity} ${fullStateName}`);
  }

  // Variant 2: City + state abbreviation
  variants.add(`${trimCity} ${trimState}`);

  // Variant 3: If state was a full name, also add abbreviation form
  if (!fullStateName) {
    // State might already be a full name — add as-is
    variants.add(`${trimCity} ${trimState}`);
  }

  // Ensure at least 2 variants
  if (variants.size < 2) {
    variants.add(`${trimCity} ${state.trim()}`);
  }

  return Array.from(variants).filter((v) => v.trim() !== '');
}

/**
 * Builds Perplexity queries to discover which sources AI cites
 * when answering questions about a given business category in a given metro.
 *
 * Returns at least 4 unique query strings.
 *
 * @example
 * buildCitationQueries("hookah lounge", "Alpharetta", "GA")
 * // [
 * //   "best hookah lounge in Alpharetta Georgia",
 * //   "hookah lounge Alpharetta GA recommendations",
 * //   "top rated hookah lounge near Alpharetta Georgia",
 * //   "where to find hookah lounge in Alpharetta GA",
 * //   "hookah lounge near Alpharetta GA",
 * // ]
 */
export function buildCitationQueries(
  category: string,
  city: string,
  state: string,
): string[] {
  const label = normalizeCategoryLabel(category);
  const variants = buildMetroVariants(city, state);
  const primary = variants[0] ?? `${city} ${state}`;
  const secondary = variants[1] ?? primary;

  const queries = new Set<string>();

  // Template 1: "best [category] in [metro]"
  queries.add(`best ${label} in ${primary}`);

  // Template 2: "[category] [metro] recommendations"
  queries.add(`${label} ${secondary} recommendations`);

  // Template 3: "top rated [category] near [metro]"
  queries.add(`top rated ${label} near ${primary}`);

  // Template 4: "where to find [category] in [metro]"
  queries.add(`where to find ${label} in ${secondary}`);

  // Template 5: "[category] near [metro]"
  queries.add(`${label} near ${secondary}`);

  return Array.from(queries);
}
