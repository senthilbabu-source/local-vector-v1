// ---------------------------------------------------------------------------
// generateMenuJsonLd.test.ts — Unit tests for the Schema.org JSON-LD generator
//
// Covers:
//   - Restaurant top-level structure (@context, @type, name, address, telephone, url)
//   - Menu sections grouped by category, insertion-order preserved
//   - MenuItem.image from image_url
//   - Offer.price normalised from "$22.00" → "22.00"
//   - suitableForDiet from DIETARY_TAG_MAP — string (CSV path) + array (POS path)
//   - Unmapped / duplicate dietary tags handled correctly
//   - subjectOf AI agent link → llms.txt
//
// Run: npx vitest run src/__tests__/unit/generateMenuJsonLd.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { generateMenuJsonLd, type LocationInfo } from '@/lib/utils/generateMenuJsonLd';
import type { MenuExtractedData, MenuExtractedItem } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_LOCATION: LocationInfo = {
  business_name:  'Charcoal N Chill',
  address_line1:  '11950 Jones Bridge Rd',
  city:           'Alpharetta',
  state:          'GA',
  zip:            '30005',
  phone:          '(470) 546-4866',
  website_url:    'https://charcoalnchill.com',
  slug:           'charcoal-n-chill',
};

const BASE_ITEM: MenuExtractedItem = {
  id:          'csv-1',
  name:        'Brisket Plate',
  description: 'Slow-smoked beef brisket',
  price:       '$22.00',
  category:    'BBQ Plates',
  confidence:  1,
  image_url:   'https://example.com/brisket.jpg',
};

const BASE_MENU: MenuExtractedData = {
  items: [
    BASE_ITEM,
    {
      id:       'csv-2',
      name:     'Mac & Cheese',
      price:    '$8.00',
      category: 'Sides',
      confidence: 1,
    },
  ],
  extracted_at: '2026-02-22T12:00:00.000Z',
};

/** Helper: cast the opaque `object` return value for assertion access */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ld = Record<string, any>;

function ld(location = BASE_LOCATION, menu = BASE_MENU): Ld {
  return generateMenuJsonLd(location, menu) as Ld;
}

// ---------------------------------------------------------------------------
// Top-level Restaurant structure
// ---------------------------------------------------------------------------

describe('generateMenuJsonLd — Restaurant structure', () => {
  it('emits @context and @type: Restaurant with the business name', () => {
    const out = ld();
    expect(out['@context']).toBe('https://schema.org');
    expect(out['@type']).toBe('Restaurant');
    expect(out.name).toBe('Charcoal N Chill');
  });

  it('includes a PostalAddress block when address_line1 is provided', () => {
    const out = ld();
    expect(out.address).toBeDefined();
    expect(out.address['@type']).toBe('PostalAddress');
    expect(out.address.streetAddress).toBe('11950 Jones Bridge Rd');
    expect(out.address.addressLocality).toBe('Alpharetta');
    expect(out.address.addressRegion).toBe('GA');
    expect(out.address.postalCode).toBe('30005');
    expect(out.address.addressCountry).toBe('US');
  });

  it('omits the address block entirely when address_line1 is null', () => {
    const out = ld({ ...BASE_LOCATION, address_line1: null });
    expect(out.address).toBeUndefined();
  });

  it('includes telephone and url when both are present', () => {
    const out = ld();
    expect(out.telephone).toBe('(470) 546-4866');
    expect(out.url).toBe('https://charcoalnchill.com');
  });

  it('omits telephone when phone is null', () => {
    const out = ld({ ...BASE_LOCATION, phone: null });
    expect(out.telephone).toBeUndefined();
  });

  it('omits url when website_url is null', () => {
    const out = ld({ ...BASE_LOCATION, website_url: null });
    expect(out.url).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Menu sections — grouping and ordering
// ---------------------------------------------------------------------------

describe('generateMenuJsonLd — Menu sections', () => {
  it('groups items into MenuSections by category', () => {
    const sections = ld().hasMenu.hasMenuSection;
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe('BBQ Plates');
    expect(sections[0]['@type']).toBe('MenuSection');
    expect(sections[0].hasMenuItem).toHaveLength(1);
    expect(sections[1].name).toBe('Sides');
    expect(sections[1].hasMenuItem).toHaveLength(1);
  });

  it('preserves insertion order of the first category occurrence', () => {
    const menu: MenuExtractedData = {
      ...BASE_MENU,
      items: [
        { id: '1', name: 'Item A', category: 'Z-Category', confidence: 1 },
        { id: '2', name: 'Item B', category: 'A-Category', confidence: 1 },
        { id: '3', name: 'Item C', category: 'Z-Category', confidence: 1 },
      ],
    };
    const sections = ld(BASE_LOCATION, menu).hasMenu.hasMenuSection;
    // Z-Category first (appeared first), A-Category second
    expect(sections[0].name).toBe('Z-Category');
    expect(sections[0].hasMenuItem).toHaveLength(2); // Item A + Item C
    expect(sections[1].name).toBe('A-Category');
    expect(sections[1].hasMenuItem).toHaveLength(1);
  });

  it('uses the slug to build the hasMenu.url', () => {
    const out = ld();
    expect(out.hasMenu.url).toBe('https://menu.localvector.ai/charcoal-n-chill');
    expect(out.hasMenu.name).toBe('Charcoal N Chill Menu');
  });
});

// ---------------------------------------------------------------------------
// MenuItem fields
// ---------------------------------------------------------------------------

describe('generateMenuJsonLd — MenuItem', () => {
  it('sets MenuItem.@type and name', () => {
    const item = ld().hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item['@type']).toBe('MenuItem');
    expect(item.name).toBe('Brisket Plate');
  });

  it('maps image_url to MenuItem.image', () => {
    const item = ld().hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.image).toBe('https://example.com/brisket.jpg');
  });

  it('omits image when image_url is absent', () => {
    // Second item (Mac & Cheese) has no image_url
    const item = ld().hasMenu.hasMenuSection[1].hasMenuItem[0];
    expect(item.image).toBeUndefined();
  });

  it('includes description when present', () => {
    const item = ld().hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.description).toBe('Slow-smoked beef brisket');
  });

  it('omits description when absent', () => {
    const item = ld().hasMenu.hasMenuSection[1].hasMenuItem[0];
    expect(item.description).toBeUndefined();
  });

  it('normalises "$22.00" to "22.00" in Offer.price', () => {
    const item = ld().hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.offers).toBeDefined();
    expect(item.offers['@type']).toBe('Offer');
    expect(item.offers.price).toBe('22.00');
    expect(item.offers.priceCurrency).toBe('USD');
  });

  it('normalises "$8.00" correctly (no leading dollar sign in output)', () => {
    const item = ld().hasMenu.hasMenuSection[1].hasMenuItem[0];
    expect(item.offers.price).toBe('8.00');
  });

  it('omits the Offer block when price is absent', () => {
    const menu: MenuExtractedData = {
      ...BASE_MENU,
      items: [{ id: '1', name: 'Free Water', category: 'Drinks', confidence: 1 }],
    };
    const item = ld(BASE_LOCATION, menu).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.offers).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Dietary tags — Schema.org RestrictedDiet mapping
// ---------------------------------------------------------------------------

describe('generateMenuJsonLd — suitableForDiet', () => {
  /** Build a single-item menu with the given dietary_tags value (string or array) */
  function menuWithTags(tags: string | string[]): MenuExtractedData {
    return {
      ...BASE_MENU,
      items: [
        // Cast to any to attach the non-typed dietary_tags field
        {
          id: '1', name: 'Test Item', category: 'Mains', confidence: 1,
          ...({ dietary_tags: tags } as object),
        } as MenuExtractedItem,
      ],
    };
  }

  it('maps "Gluten-Free" (pipe-separated string, CSV path) to GlutenFreeDiet URI', () => {
    const item = ld(BASE_LOCATION, menuWithTags('Gluten-Free')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toContain('https://schema.org/GlutenFreeDiet');
  });

  it('maps "Vegan" to VeganDiet URI', () => {
    const item = ld(BASE_LOCATION, menuWithTags('Vegan')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toContain('https://schema.org/VeganDiet');
  });

  it('maps "Vegetarian" to VegetarianDiet URI', () => {
    const item = ld(BASE_LOCATION, menuWithTags('Vegetarian')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toContain('https://schema.org/VegetarianDiet');
  });

  it('maps multiple pipe-separated tags (CSV path) to multiple URIs', () => {
    const item = ld(BASE_LOCATION, menuWithTags('Vegan|Gluten-Free')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toContain('https://schema.org/VeganDiet');
    expect(item.suitableForDiet).toContain('https://schema.org/GlutenFreeDiet');
    expect(item.suitableForDiet).toHaveLength(2);
  });

  it('maps an array of tags (POS path) to Schema.org URIs', () => {
    const item = ld(BASE_LOCATION, menuWithTags(['Kosher', 'Halal'])).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toContain('https://schema.org/KosherDiet');
    expect(item.suitableForDiet).toContain('https://schema.org/HalalDiet');
  });

  it('drops unmapped tags (e.g. "Spicy") without crashing', () => {
    const item = ld(BASE_LOCATION, menuWithTags('Spicy')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    // No valid Schema.org URI → suitableForDiet block is NOT emitted
    expect(item.suitableForDiet).toBeUndefined();
  });

  it('drops unmapped tags and keeps valid ones in a mixed list', () => {
    const item = ld(BASE_LOCATION, menuWithTags('Vegan|Spicy|Organic')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toEqual(['https://schema.org/VeganDiet']);
  });

  it('deduplicates repeated dietary tag URIs', () => {
    // 'Vegan' and 'vegan' both map to the same URI
    const item = ld(BASE_LOCATION, menuWithTags('Vegan|vegan')).hasMenu.hasMenuSection[0].hasMenuItem[0];
    const veganUris = item.suitableForDiet.filter(
      (u: string) => u === 'https://schema.org/VeganDiet',
    );
    expect(veganUris).toHaveLength(1);
  });

  it('omits suitableForDiet entirely when dietary_tags is absent', () => {
    // BASE_MENU items have no dietary_tags
    const item = ld().hasMenu.hasMenuSection[0].hasMenuItem[0];
    expect(item.suitableForDiet).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// subjectOf — AI agent profile link
// ---------------------------------------------------------------------------

describe('generateMenuJsonLd — subjectOf', () => {
  it('includes subjectOf.url pointing to llms.txt for the slug', () => {
    const out = ld();
    expect(out.subjectOf).toBeDefined();
    expect(out.subjectOf.url).toBe('https://menu.localvector.ai/charcoal-n-chill/llms.txt');
  });

  it('sets encodingFormat to "text/markdown"', () => {
    const out = ld();
    expect(out.subjectOf.encodingFormat).toBe('text/markdown');
  });

  it('includes a description that mentions the business name', () => {
    const out = ld();
    expect(out.subjectOf.description).toContain('Charcoal N Chill');
  });

  it('sets subjectOf.@type to "DigitalDocument"', () => {
    const out = ld();
    expect(out.subjectOf['@type']).toBe('DigitalDocument');
  });
});
