// ---------------------------------------------------------------------------
// lib/menu-intelligence/demand-analyzer.ts — S24: Menu Intelligence
//
// Analyzes how often AI search responses mention each menu item.
// Pure extraction logic + I/O layer for Supabase queries.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MenuDemandResult {
  item_id: string;
  item_name: string;
  mention_count: number;
}

export interface MenuDemandResultWithCategory extends MenuDemandResult {
  category_name: string | null;
}

// ---------------------------------------------------------------------------
// Pure analysis functions
// ---------------------------------------------------------------------------

/**
 * Counts case-insensitive occurrences of itemName across rawResponses.
 * Skips items with name.length < 3 (too short for meaningful matching).
 */
export function countItemMentions(itemName: string, rawResponses: string[]): number {
  if (itemName.length < 3) return 0;

  const needle = itemName.toLowerCase();
  let count = 0;

  for (const response of rawResponses) {
    const lower = response.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(needle, idx)) !== -1) {
      count++;
      idx += needle.length;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// I/O — Menu demand analysis
// ---------------------------------------------------------------------------

/**
 * Fetches menu items for a location and counts how many times each appears
 * in the last 90 days of SOV evaluation raw_response texts.
 *
 * Returns items sorted by mention_count DESC.
 * Never throws — returns empty array on error.
 */
export async function analyzeMenuDemand(
  supabase: SupabaseClient,
  locationId: string,
  orgId: string,
): Promise<MenuDemandResult[]> {
  try {
    // Fetch menu items for this location
    const { data: menus } = await supabase
      .from('magic_menus')
      .select('id')
      .eq('location_id', locationId)
      .limit(10);

    if (!menus || menus.length === 0) return [];

    const menuIds = menus.map((m) => m.id);
    const { data: categories } = await supabase
      .from('menu_categories')
      .select('id')
      .in('menu_id', menuIds);

    if (!categories || categories.length === 0) return [];

    const categoryIds = categories.map((c) => c.id);
    const { data: items } = await supabase
      .from('menu_items')
      .select('id, name')
      .in('category_id', categoryIds);

    if (!items || items.length === 0) return [];

    // Fetch last 90 days of raw_response text
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: evaluations } = await supabase
      .from('sov_evaluations')
      .select('raw_response')
      .eq('org_id', orgId)
      .gte('created_at', ninetyDaysAgo)
      .not('raw_response', 'is', null)
      .limit(500);

    const rawResponses = (evaluations ?? [])
      .map((e) => e.raw_response)
      .filter((r): r is string => typeof r === 'string' && r.length > 0);

    if (rawResponses.length === 0) {
      return items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        mention_count: 0,
      }));
    }

    // Count mentions per item
    const results: MenuDemandResult[] = items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      mention_count: countItemMentions(item.name, rawResponses),
    }));

    // Sort by mention_count DESC
    results.sort((a, b) => b.mention_count - a.mention_count);

    return results;
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'demand-analyzer', sprint: 'S24' } });
    return [];
  }
}

// ---------------------------------------------------------------------------
// I/O — Aggregate demand analysis (all menus for a location, with categories)
// ---------------------------------------------------------------------------

/**
 * Like analyzeMenuDemand but includes category_name for each item.
 * Used on the main Magic Menu page to show "What AI Is Talking About".
 * Never throws — returns empty array on error.
 */
export async function analyzeMenuDemandWithCategories(
  supabase: SupabaseClient,
  locationId: string,
  orgId: string,
): Promise<MenuDemandResultWithCategory[]> {
  try {
    const { data: menus } = await supabase
      .from('magic_menus')
      .select('id')
      .eq('location_id', locationId)
      .limit(10);

    if (!menus || menus.length === 0) return [];

    const menuIds = menus.map((m) => m.id);
    const { data: categories } = await supabase
      .from('menu_categories')
      .select('id, name')
      .in('menu_id', menuIds);

    if (!categories || categories.length === 0) return [];

    const categoryMap = new Map(categories.map((c) => [c.id, c.name as string | null]));
    const categoryIds = categories.map((c) => c.id);

    const { data: items } = await supabase
      .from('menu_items')
      .select('id, name, category_id')
      .in('category_id', categoryIds);

    if (!items || items.length === 0) return [];

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: evaluations } = await supabase
      .from('sov_evaluations')
      .select('raw_response')
      .eq('org_id', orgId)
      .gte('created_at', ninetyDaysAgo)
      .not('raw_response', 'is', null)
      .limit(500);

    const rawResponses = (evaluations ?? [])
      .map((e) => e.raw_response)
      .filter((r): r is string => typeof r === 'string' && r.length > 0);

    const results: MenuDemandResultWithCategory[] = items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      category_name: categoryMap.get(item.category_id) ?? null,
      mention_count: rawResponses.length > 0
        ? countItemMentions(item.name, rawResponses)
        : 0,
    }));

    results.sort((a, b) => b.mention_count - a.mention_count);
    return results;
  } catch (err) {
    Sentry.captureException(err, { tags: { service: 'demand-analyzer', sprint: 'S24' } });
    return [];
  }
}
