// ---------------------------------------------------------------------------
// schemaOrg.ts — Schema.org RestrictedDiet enumeration helpers
//
// SOURCE OF TRUTH: Doc 04b §7.1.1
//
// The public Magic Menu page emits MenuItem.suitableForDiet using formal
// Schema.org URIs. This file is the single point of translation between
// free-text dietary tags (stored in menu_items.dietary_tags or entered via
// the LocalVector CSV Image_URL column) and the formal enum values.
//
// Tags that don't map to a Schema.org URI (e.g., "Spicy", "Organic") are
// stored for display purposes only and are NOT emitted in JSON-LD.
// ---------------------------------------------------------------------------

/**
 * Maps normalised free-text dietary tag strings to Schema.org RestrictedDiet
 * URIs. All keys are lowercase; the lookup is performed after lowercasing and
 * trimming the raw input tag.
 *
 * Doc 04b §7.1.1 — full enumeration table.
 */
export const DIETARY_TAG_MAP: Record<string, string> = {
  // Vegan
  'vegan':               'https://schema.org/VeganDiet',

  // Vegetarian
  'vegetarian':          'https://schema.org/VegetarianDiet',

  // Gluten-free
  'gluten-free':         'https://schema.org/GlutenFreeDiet',
  'gluten free':         'https://schema.org/GlutenFreeDiet',
  'gluten_free':         'https://schema.org/GlutenFreeDiet',

  // Halal
  'halal':               'https://schema.org/HalalDiet',

  // Kosher
  'kosher':              'https://schema.org/KosherDiet',

  // Diabetic
  'diabetic':            'https://schema.org/DiabeticDiet',
  'diabetic friendly':   'https://schema.org/DiabeticDiet',
  'diabetic-friendly':   'https://schema.org/DiabeticDiet',

  // Low calorie
  'low-calorie':         'https://schema.org/LowCalorieDiet',
  'low calorie':         'https://schema.org/LowCalorieDiet',

  // Low fat
  'low-fat':             'https://schema.org/LowFatDiet',
  'low fat':             'https://schema.org/LowFatDiet',

  // Low lactose / lactose-free
  'low-lactose':         'https://schema.org/LowLactoseDiet',
  'low lactose':         'https://schema.org/LowLactoseDiet',
  'lactose-free':        'https://schema.org/LowLactoseDiet',
  'lactose free':        'https://schema.org/LowLactoseDiet',

  // Low salt / sodium
  'low-salt':            'https://schema.org/LowSaltDiet',
  'low salt':            'https://schema.org/LowSaltDiet',
  'low-sodium':          'https://schema.org/LowSaltDiet',
  'low sodium':          'https://schema.org/LowSaltDiet',
};

/**
 * Converts an array of free-text dietary tag strings to Schema.org
 * RestrictedDiet URI strings.
 *
 * Tags that don't map to a known Schema.org URI are silently dropped.
 * The returned array contains no duplicates and no undefined values.
 *
 * @example
 * mapDietaryTagsToSchemaUris(['Gluten-Free', 'Vegan', 'Spicy'])
 * // → ['https://schema.org/GlutenFreeDiet', 'https://schema.org/VeganDiet']
 * // 'Spicy' is dropped — no Schema.org mapping
 */
export function mapDietaryTagsToSchemaUris(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const uris: string[] = [];

  for (const tag of rawTags) {
    const normalised = tag.toLowerCase().trim();
    const uri = DIETARY_TAG_MAP[normalised];
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      uris.push(uri);
    }
  }

  return uris;
}

/**
 * Parses a pipe-separated dietary tag string from the LocalVector CSV column.
 * Returns an empty array for blank or missing values.
 *
 * @example
 * parsePipeSeparatedTags('Gluten-Free|Vegan|Spicy')
 * // → ['Gluten-Free', 'Vegan', 'Spicy']
 */
export function parsePipeSeparatedTags(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split('|')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}
