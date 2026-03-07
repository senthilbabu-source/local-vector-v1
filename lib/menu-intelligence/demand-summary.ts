// ---------------------------------------------------------------------------
// lib/menu-intelligence/demand-summary.ts — S36: Menu Demand Summary
//
// Pure helper functions for surfacing top AI-mentioned menu items
// on the dashboard teaser. Builds on demand-analyzer.ts (S24).
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import { analyzeMenuDemand, type MenuDemandResult } from './demand-analyzer';

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Filters and returns the top N demand items with mention_count > 0.
 */
export function filterTopDemandItems(
  items: MenuDemandResult[],
  limit = 3,
): MenuDemandResult[] {
  return items
    .filter((i) => i.mention_count > 0)
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, limit);
}

/**
 * Formats a human-readable insight string from demand items.
 * - Single item: "Your Brisket was mentioned 47 times by AI this month"
 * - Multiple: "Your Brisket (47x), Pulled Pork (23x), and Mac & Cheese (12x) are trending in AI"
 * - Empty: ""
 */
export function formatDemandInsight(items: MenuDemandResult[]): string {
  const filtered = items.filter((i) => i.mention_count > 0);
  if (filtered.length === 0) return '';

  if (filtered.length === 1) {
    const item = filtered[0];
    return `Your ${item.item_name} was mentioned ${item.mention_count} time${item.mention_count === 1 ? '' : 's'} by AI this month`;
  }

  const parts = filtered.map((i) => `${i.item_name} (${i.mention_count}x)`);
  if (parts.length === 2) {
    return `Your ${parts[0]} and ${parts[1]} are trending in AI`;
  }
  const last = parts.pop()!;
  return `Your ${parts.join(', ')}, and ${last} are trending in AI`;
}

// ---------------------------------------------------------------------------
// I/O — Fetches top demand items for a location
// ---------------------------------------------------------------------------

/**
 * Returns the top N demand items for the dashboard teaser.
 * Never throws — returns empty array on error.
 */
export async function getTopDemandItems(
  supabase: SupabaseClient,
  locationId: string,
  orgId: string,
  limit = 3,
): Promise<MenuDemandResult[]> {
  const allItems = await analyzeMenuDemand(supabase, locationId, orgId);
  return filterTopDemandItems(allItems, limit);
}
