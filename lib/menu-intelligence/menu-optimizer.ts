// ---------------------------------------------------------------------------
// lib/menu-intelligence/menu-optimizer.ts — S43: AI Menu Optimizer
//
// Pure functions that analyze menu completeness and generate actionable
// suggestions. No AI calls — pure analysis of existing data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MenuItemData {
  name: string;
  description?: string | null;
  price?: number | null;
  dietary_tags?: string[] | null;
  category?: string | null;
}

export interface MenuCompleteness {
  totalItems: number;
  itemsWithDescription: number;
  itemsWithPrice: number;
  itemsWithDietary: number;
  descriptionPercent: number;
  pricePercent: number;
  dietaryPercent: number;
}

export interface MenuSuggestion {
  title: string;
  description: string;
  impact: 'high' | 'medium';
  effort: string;
  category: 'description' | 'price' | 'dietary' | 'demand' | 'general';
}

export interface DemandItem {
  item_name: string;
  mention_count: number;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Analyzes menu item completeness.
 */
export function analyzeMenuCompleteness(items: MenuItemData[]): MenuCompleteness {
  const totalItems = items.length;
  if (totalItems === 0) {
    return { totalItems: 0, itemsWithDescription: 0, itemsWithPrice: 0, itemsWithDietary: 0, descriptionPercent: 0, pricePercent: 0, dietaryPercent: 0 };
  }

  const itemsWithDescription = items.filter(i => i.description && i.description.trim().length > 0).length;
  const itemsWithPrice = items.filter(i => i.price !== null && i.price !== undefined && i.price > 0).length;
  const itemsWithDietary = items.filter(i => i.dietary_tags && i.dietary_tags.length > 0).length;

  return {
    totalItems,
    itemsWithDescription,
    itemsWithPrice,
    itemsWithDietary,
    descriptionPercent: Math.round((itemsWithDescription / totalItems) * 100),
    pricePercent: Math.round((itemsWithPrice / totalItems) * 100),
    dietaryPercent: Math.round((itemsWithDietary / totalItems) * 100),
  };
}

/**
 * Generates up to 5 actionable suggestions based on menu analysis.
 * Priority: demand items missing data > generic completeness > competitive gaps.
 */
export function generateMenuSuggestions(
  completeness: MenuCompleteness,
  demandItems?: DemandItem[],
  items?: MenuItemData[],
): MenuSuggestion[] {
  const suggestions: MenuSuggestion[] = [];

  if (completeness.totalItems === 0) {
    suggestions.push({
      title: 'Upload your menu',
      description: 'AI cannot recommend your dishes without a menu. Upload yours to get started.',
      impact: 'high',
      effort: '~10 min',
      category: 'general',
    });
    return suggestions;
  }

  // 1. High-demand items without descriptions
  if (demandItems && items) {
    const itemsByName = new Map(items.map(i => [i.name.toLowerCase(), i]));
    for (const demand of demandItems.slice(0, 3)) {
      const item = itemsByName.get(demand.item_name.toLowerCase());
      if (item && (!item.description || item.description.trim().length === 0)) {
        suggestions.push({
          title: `Add description to "${demand.item_name}"`,
          description: `This item was mentioned ${demand.mention_count} times by AI. A description helps AI cite it more accurately.`,
          impact: 'high',
          effort: '~2 min',
          category: 'demand',
        });
      }
      if (suggestions.length >= 5) return suggestions;
    }
  }

  // 2. Low description coverage
  if (completeness.descriptionPercent < 50) {
    const missing = completeness.totalItems - completeness.itemsWithDescription;
    suggestions.push({
      title: `Add descriptions to ${missing} items`,
      description: 'AI mentions items with descriptions 3x more than items without them.',
      impact: 'high',
      effort: `~${Math.ceil(missing * 0.5)} min`,
      category: 'description',
    });
  }

  // 3. Low price coverage
  if (completeness.pricePercent < 50) {
    const missing = completeness.totalItems - completeness.itemsWithPrice;
    suggestions.push({
      title: `Add prices to ${missing} items`,
      description: 'Price information improves AI accuracy when customers ask about costs.',
      impact: 'medium',
      effort: `~${Math.ceil(missing * 0.3)} min`,
      category: 'price',
    });
  }

  // 4. No dietary tags
  if (completeness.dietaryPercent === 0 && completeness.totalItems > 0) {
    suggestions.push({
      title: 'Tag dietary info (gluten-free, vegan)',
      description: '23% of AI food queries include dietary filters. Tagging items helps AI recommend you.',
      impact: 'medium',
      effort: '~5 min',
      category: 'dietary',
    });
  }

  // 5. Low dietary coverage (but not zero)
  if (completeness.dietaryPercent > 0 && completeness.dietaryPercent < 30) {
    const missing = completeness.totalItems - completeness.itemsWithDietary;
    suggestions.push({
      title: `Add dietary tags to ${missing} more items`,
      description: 'More dietary tags mean more visibility in dietary-filtered AI searches.',
      impact: 'medium',
      effort: `~${Math.ceil(missing * 0.3)} min`,
      category: 'dietary',
    });
  }

  return suggestions.slice(0, 5);
}
