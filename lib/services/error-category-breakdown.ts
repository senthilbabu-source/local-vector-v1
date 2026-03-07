// ---------------------------------------------------------------------------
// lib/services/error-category-breakdown.ts — S56: AI Error Category Breakdown
//
// Pure functions for grouping hallucinations by category.
// No I/O — callers pass pre-fetched data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryCount {
  category: string;
  count: number;
  percentage: number;
}

export interface CategoryBreakdown {
  categories: CategoryCount[];
  total: number;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Builds a category breakdown from hallucination rows.
 * Groups by category, sorts by count descending.
 */
export function buildCategoryBreakdown(
  rows: Array<{ category: string | null }>,
): CategoryBreakdown {
  const total = rows.length;
  if (total === 0) return { categories: [], total: 0 };

  const counts = new Map<string, number>();
  for (const row of rows) {
    const cat = row.category ?? 'uncategorized';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const categories: CategoryCount[] = Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  return { categories, total };
}

/**
 * Returns a human-readable label for a hallucination category.
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    hours: 'Wrong Hours',
    address: 'Wrong Address',
    phone: 'Wrong Phone',
    menu: 'Menu Errors',
    pricing: 'Wrong Prices',
    cuisine: 'Wrong Cuisine Type',
    status: 'Business Status',
    attributes: 'Wrong Attributes',
    uncategorized: 'Other',
  };
  return labels[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Returns a color class for a category (for chart rendering).
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    hours: '#ef4444',      // red
    address: '#f97316',    // orange
    phone: '#f59e0b',      // amber
    menu: '#8b5cf6',       // violet
    pricing: '#6366f1',    // indigo
    cuisine: '#06b6d4',    // cyan
    status: '#ec4899',     // pink
    attributes: '#14b8a6', // teal
    uncategorized: '#64748b', // slate
  };
  return colors[category] ?? '#64748b';
}

/**
 * Returns the top N categories with the rest grouped as "Other".
 */
export function getTopCategories(
  breakdown: CategoryBreakdown,
  topN = 5,
): CategoryCount[] {
  if (breakdown.categories.length <= topN) return breakdown.categories;

  const top = breakdown.categories.slice(0, topN);
  const rest = breakdown.categories.slice(topN);
  const otherCount = rest.reduce((sum, c) => sum + c.count, 0);
  const otherPct = Math.round((otherCount / breakdown.total) * 100);

  return [
    ...top,
    { category: 'other', count: otherCount, percentage: otherPct },
  ];
}
