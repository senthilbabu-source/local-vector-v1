// ---------------------------------------------------------------------------
// generateMenuJsonLd.ts — Schema.org Menu / MenuItem JSON-LD generator
//
// SOURCE OF TRUTH: Doc 04b §7.1, Doc 04 §4.3
//
// Converts a published MenuExtractedData + location info into a Schema.org
// JSON-LD object. The output is:
//   1. Stored in magic_menus.json_ld_schema (JSONB) on publish.
//   2. Embedded in a <script type="application/ld+json"> on the public
//      menu page at menu.localvector.ai/{slug}.
//
// Key AEO features:
//   - MenuItem.image  → populated from MenuExtractedItem.image_url
//   - suitableForDiet → free-text dietary tags mapped to Schema.org URIs
//     via DIETARY_TAG_MAP (schemaOrg.ts). Unmapped tags are omitted.
// ---------------------------------------------------------------------------

import type { MenuExtractedData, MenuExtractedItem } from '@/lib/types/menu';
import {
  mapDietaryTagsToSchemaUris,
  parsePipeSeparatedTags,
} from './schemaOrg';

// ---------------------------------------------------------------------------
// LocationInfo — minimal shape required by the generator.
// Populated from the `locations` table row at publish time.
// ---------------------------------------------------------------------------

export interface LocationInfo {
  business_name:  string;
  address_line1?: string | null;
  city?:          string | null;
  state?:         string | null;
  zip?:           string | null;
  phone?:         string | null;
  website_url?:   string | null;
  slug:           string;   // used for Magic Menu + llms.txt URLs
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Groups MenuExtractedItems by their `category` field, preserving insertion
 * order of first occurrence.
 */
function groupByCategory(
  items: MenuExtractedItem[],
): { category: string; items: MenuExtractedItem[] }[] {
  const order: string[] = [];
  const map: Record<string, MenuExtractedItem[]> = {};

  for (const item of items) {
    const cat = item.category || 'Other';
    if (!map[cat]) {
      order.push(cat);
      map[cat] = [];
    }
    map[cat].push(item);
  }

  return order.map((cat) => ({ category: cat, items: map[cat] }));
}

/**
 * Resolves dietary tags for a menu item.
 *
 * The `dietary_tags` on a MenuExtractedItem come in two forms:
 *   - CSV upload: stored as a pipe-separated string in a temporary field
 *     (the CSV column "Dietary_Tags" is normalised here).
 *   - POS / OCR: GPT-4o emits them as an array of strings (the POS mapper
 *     prompt asks for a "dietary_tags" string array per item).
 *
 * We accept both and normalise to string[].
 */
function resolveDietaryTags(item: MenuExtractedItem): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (item as any).dietary_tags;
  if (Array.isArray(raw))  return raw as string[];
  if (typeof raw === 'string') return parsePipeSeparatedTags(raw);
  return [];
}

/**
 * Strips currency symbols and returns a numeric string for Schema.org Offer.price.
 * "$22.00" → "22.00"
 */
function normalisePrice(price: string): string {
  return price.replace(/[^0-9.]/g, '');
}

// ---------------------------------------------------------------------------
// generateMenuJsonLd
// ---------------------------------------------------------------------------

/**
 * Returns a Schema.org Restaurant + Menu JSON-LD object (not stringified).
 * Stringify with JSON.stringify() before embedding in <script> tags or storing.
 *
 * @param location - Minimal location data from the `locations` table.
 * @param data     - Validated MenuExtractedData from magic_menus.extracted_data.
 */
export function generateMenuJsonLd(
  location: LocationInfo,
  data:     MenuExtractedData,
): object {
  const magicMenuUrl = `https://menu.localvector.ai/${location.slug}`;
  const llmsTxtUrl   = `${magicMenuUrl}/llms.txt`;

  const sections = groupByCategory(data.items);

  return {
    '@context': 'https://schema.org',
    '@type':    'Restaurant',
    name:       location.business_name,

    // Address — omit the whole block if no address data is present
    ...(location.address_line1 && {
      address: {
        '@type':         'PostalAddress',
        streetAddress:   location.address_line1,
        ...(location.city  && { addressLocality: location.city  }),
        ...(location.state && { addressRegion:   location.state }),
        ...(location.zip   && { postalCode:      location.zip   }),
        addressCountry: 'US',
      },
    }),

    ...(location.phone       && { telephone: location.phone       }),
    ...(location.website_url && { url:       location.website_url }),

    hasMenu: {
      '@type': 'Menu',
      name:    `${location.business_name} Menu`,
      url:     magicMenuUrl,

      hasMenuSection: sections.map((section) => ({
        '@type': 'MenuSection',
        name:    section.category,

        hasMenuItem: section.items.map((item): object => {
          const dietaryUris = mapDietaryTagsToSchemaUris(resolveDietaryTags(item));

          return {
            '@type':       'MenuItem',
            name:          item.name,
            ...(item.description && { description: item.description }),
            ...(item.image_url   && { image: item.image_url }),

            // Offer block — only emit when a price is available
            ...(item.price && {
              offers: {
                '@type':       'Offer',
                price:         normalisePrice(item.price),
                priceCurrency: 'USD',
              },
            }),

            // suitableForDiet — only emit when at least one Schema.org URI matched
            ...(dietaryUris.length > 0 && { suitableForDiet: dietaryUris }),
          };
        }),
      })),
    },

    // AI agent profile — links crawlers to the llms.txt for structured ingestion
    subjectOf: {
      '@type':         'DigitalDocument',
      url:             llmsTxtUrl,
      encodingFormat:  'text/markdown',
      description:     `AI-readable menu and entity profile for ${location.business_name}`,
    },
  };
}
