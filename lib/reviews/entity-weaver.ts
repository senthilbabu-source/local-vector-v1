// ---------------------------------------------------------------------------
// lib/reviews/entity-weaver.ts — Entity Term Selection for Review Responses
//
// Sprint 132: Selects 2-3 entity terms for review response weaving.
// PURE FUNCTION — AI_RULES §164: MAX 3 entity terms. Never override.
// ---------------------------------------------------------------------------

export interface EntityTermSelection {
  terms: string[];      // exactly 2-3, ordered by priority
  rationale: string[];  // which slot rule was used (for debugging + tests)
}

export interface EntityWeaveInput {
  businessName: string;
  city: string;
  categories: string[] | null;     // ['NightClub', 'BarOrPub']
  signatureItems: string[];        // top 3 published menu item names
  keyAmenities: string[];          // true amenities: ['hookah', 'live music']
  reviewRating: number;
  reviewKeywords: string[];        // keywords from reviews.keywords[]
}

// Category -> human label (for slot 3 fallback)
const ENTITY_CATEGORY_LABELS: Record<string, string> = {
  'Restaurant': 'restaurant',
  'FoodEstablishment': 'restaurant',
  'BarOrPub': 'bar',
  'NightClub': 'hookah lounge',
  'Cafe': 'cafe',
  'Physician': 'medical practice',
  'Dentist': 'dental practice',
  'HairSalon': 'hair salon',
  'GymOrFitnessCenter': 'fitness center',
  'Hookah Bar': 'hookah lounge',
  'Indian Restaurant': 'Indian restaurant',
  'Fusion Restaurant': 'fusion restaurant',
  'Lounge': 'lounge',
};

/**
 * Select exactly 2-3 entity terms.
 *
 * Slot 1: businessName — always
 * Slot 2: city — always
 * Slot 3: context-aware: mentioned item > mentioned amenity > category label > first signature item
 */
export function selectEntityTerms(input: EntityWeaveInput): EntityTermSelection {
  const terms: string[] = [input.businessName, input.city];
  const rationale: string[] = ['slot1:business_name', 'slot2:city'];

  const lowerKw = input.reviewKeywords.map(k => k.toLowerCase());

  // Try: matched signature item (reviewer mentioned it)
  const matchedItem = input.signatureItems.find(item =>
    lowerKw.some(k =>
      item.toLowerCase().includes(k) ||
      k.includes(item.toLowerCase().slice(0, 5)),
    ),
  );

  // Try: matched amenity (reviewer mentioned it)
  const matchedAmenity = input.keyAmenities.find(a =>
    lowerKw.some(k => a.toLowerCase().includes(k)),
  );

  if (matchedItem) {
    terms.push(matchedItem);
    rationale.push(`slot3:matched_item:${matchedItem}`);
  } else if (matchedAmenity) {
    terms.push(matchedAmenity);
    rationale.push(`slot3:matched_amenity:${matchedAmenity}`);
  } else if (input.categories?.length) {
    const label = findCategoryLabel(input.categories);
    if (label) {
      terms.push(label);
      rationale.push(`slot3:category_label:${input.categories[0]}`);
    } else if (input.signatureItems.length > 0) {
      terms.push(input.signatureItems[0]);
      rationale.push('slot3:first_signature_item');
    }
  } else if (input.signatureItems.length > 0) {
    terms.push(input.signatureItems[0]);
    rationale.push('slot3:first_signature_item');
  }
  // If nothing fills slot 3, return 2 terms (acceptable)

  return { terms: terms.slice(0, 3), rationale };
}

/**
 * Find a human-readable label from categories array.
 */
function findCategoryLabel(categories: string[]): string | null {
  for (const cat of categories) {
    if (ENTITY_CATEGORY_LABELS[cat]) {
      return ENTITY_CATEGORY_LABELS[cat];
    }
  }
  return null;
}

/**
 * Extract human-readable names from amenities JSONB.
 * Returns only true values, underscores -> spaces, max 3.
 */
export function extractKeyAmenities(
  amenities: Record<string, boolean | null> | null,
  max = 3,
): string[] {
  if (!amenities) return [];
  return Object.entries(amenities)
    .filter(([, v]) => v === true)
    .map(([k]) => k.replace(/^(has_|is_)/, '').replace(/_/g, ' '))
    .slice(0, max);
}

/**
 * Safely extract top menu item names from magic_menus extracted_data JSONB.
 * Returns empty array if null/invalid.
 */
export function extractTopMenuItems(
  extractedData: unknown,
  count = 3,
): string[] {
  if (!extractedData || typeof extractedData !== 'object') return [];

  try {
    // extracted_data can be { sections: [{ items: [{ name }] }] } or { items: [{ name }] }
    const data = extractedData as Record<string, unknown>;

    let items: Array<{ name?: string }> = [];

    if (Array.isArray(data.sections)) {
      for (const section of data.sections) {
        const sec = section as Record<string, unknown>;
        if (Array.isArray(sec.items)) {
          items.push(...(sec.items as Array<{ name?: string }>));
        }
      }
    } else if (Array.isArray(data.items)) {
      items = data.items as Array<{ name?: string }>;
    }

    return items
      .filter(item => item.name && typeof item.name === 'string')
      .map(item => item.name!)
      .slice(0, count);
  } catch (_err) {
    return [];
  }
}
