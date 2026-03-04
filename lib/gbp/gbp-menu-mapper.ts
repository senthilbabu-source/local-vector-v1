// ---------------------------------------------------------------------------
// lib/gbp/gbp-menu-mapper.ts — Sprint 2: GBP Food Menus Push
//
// Pure function: MenuExtractedItem[] → GBPFoodMenu.
// Groups items by category, maps price strings to GBPMoneyAmount,
// handles missing descriptions/prices gracefully.
// ---------------------------------------------------------------------------

import type { MenuExtractedItem } from '@/lib/types/menu';
import type { GBPFoodMenu, GBPMenuItem, GBPMoneyAmount } from './gbp-menu-types';

/**
 * Parse a price string like "$12.50", "12.50", "$8", "8" into GBPMoneyAmount.
 * Returns undefined for unparseable or missing prices.
 */
export function parsePriceToMoney(
  price: string | undefined,
  currencyCode = 'USD',
): GBPMoneyAmount | undefined {
  if (!price) return undefined;

  // Strip currency symbols, whitespace, commas
  const cleaned = price.replace(/[$€£¥,\s]/g, '');
  if (!cleaned) return undefined;

  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return undefined;

  const units = Math.floor(num).toString();
  // Round to avoid floating point issues: (12.50 - 12) * 1e9 = 500000000
  const nanos = Math.round((num - Math.floor(num)) * 1e9);

  return { currencyCode, units, nanos };
}

/**
 * Convert a list of MenuExtractedItem[] into a GBPFoodMenu payload.
 *
 * - Groups items by `category`
 * - Sorts sections alphabetically by category name
 * - Maps price strings → GBPMoneyAmount (omitted if unparseable)
 * - Omits description if empty/undefined
 * - Returns a single-menu structure with menuName = "Full Menu"
 */
export function mapMenuToGBPFoodMenu(items: MenuExtractedItem[]): GBPFoodMenu {
  if (!items.length) {
    return { menus: [{ menuName: 'Full Menu', sections: [] }] };
  }

  // Group by category
  const grouped = new Map<string, GBPMenuItem[]>();

  for (const item of items) {
    const category = item.category || 'Other';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }

    const gbpItem: GBPMenuItem = { name: item.name };

    const money = parsePriceToMoney(item.price);
    if (money) {
      gbpItem.price = money;
    }

    if (item.description) {
      gbpItem.description = item.description;
    }

    grouped.get(category)!.push(gbpItem);
  }

  // Sort sections alphabetically
  const sortedCategories = [...grouped.keys()].sort();

  const sections = sortedCategories.map((category) => ({
    name: category,
    items: grouped.get(category)!,
  }));

  return {
    menus: [{ menuName: 'Full Menu', sections }],
  };
}
