// ---------------------------------------------------------------------------
// lib/distribution/verification-service.ts — DIST-4: Verification Pipeline
//
// Automated verification that menu distribution actually worked:
// 1. Crawl detection — check crawler_hits for bot visits
// 2. Citation matching — check SOV evaluation answers for menu item names
//
// Non-critical: never throws from public API. Errors captured via Sentry.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuExtractedData, PropagationEvent } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrawlDetectionResult {
  hasCrawlHits: boolean;
  botTypes: string[];
  latestCrawlAt: string | null;
  alreadyRecorded: boolean;
}

export interface CitationMatchInput {
  menuItemNames: string[];
  sovResponses: Array<{ rawResponse: string | null }>;
}

export interface CitationMatchResult {
  isLiveInAI: boolean;
  matchedItems: string[];
  matchCount: number;
  alreadyRecorded: boolean;
}

export interface VerificationResult {
  crawl: CrawlDetectionResult;
  citation: CitationMatchResult;
  eventsAdded: PropagationEvent['event'][];
}

export interface DistributionHealthStats {
  totalOrgsWithPublishedMenus: number;
  orgsDistributed: number;
  orgsCrawled: number;
  orgsLiveInAI: number;
  pctDistributed: number;
  pctCrawled: number;
  pctLiveInAI: number;
}

// ---------------------------------------------------------------------------
// Pure functions (no I/O — fully testable)
// ---------------------------------------------------------------------------

/** Check if 'crawled' event already exists in propagation_events. */
export function hasCrawledEvent(events: PropagationEvent[]): boolean {
  return events.some((e) => e.event === 'crawled');
}

/** Check if 'live_in_ai' event already exists in propagation_events. */
export function hasLiveInAIEvent(events: PropagationEvent[]): boolean {
  return events.some((e) => e.event === 'live_in_ai');
}

/**
 * Case-insensitive substring match of menu item names against SOV raw_response
 * text. Skips names < 3 chars to avoid false positives ("Tea", "Dip").
 *
 * Follows the same pattern as sov-engine.service.ts business name matching.
 * 1+ matches → menu is "live in AI".
 */
export function matchMenuItemsInResponses(input: CitationMatchInput): Omit<CitationMatchResult, 'alreadyRecorded'> {
  const matchedItems: string[] = [];

  for (const itemName of input.menuItemNames) {
    if (!itemName || itemName.length < 3) continue;
    const lowerName = itemName.toLowerCase();

    const found = input.sovResponses.some((resp) => {
      if (!resp.rawResponse) return false;
      return resp.rawResponse.toLowerCase().includes(lowerName);
    });

    if (found) {
      matchedItems.push(itemName);
    }
  }

  return {
    isLiveInAI: matchedItems.length > 0,
    matchedItems,
    matchCount: matchedItems.length,
  };
}

// ---------------------------------------------------------------------------
// I/O functions (Supabase queries)
// ---------------------------------------------------------------------------

/**
 * Check crawler_hits for recent bot visits to a specific menu.
 * Uses idx_crawler_hits_menu_bot index.
 */
export async function detectCrawlHits(
  supabase: SupabaseClient,
  menuId: string,
  existingEvents: PropagationEvent[],
): Promise<CrawlDetectionResult> {
  const alreadyRecorded = hasCrawledEvent(existingEvents);

  const { data: hits } = await supabase
    .from('crawler_hits')
    .select('bot_type, crawled_at')
    .eq('menu_id', menuId)
    .order('crawled_at', { ascending: false })
    .limit(20);

  const botTypes = [...new Set((hits ?? []).map((h) => h.bot_type as string))];
  const latestCrawlAt = (hits?.[0]?.crawled_at as string) ?? null;

  return {
    hasCrawlHits: botTypes.length > 0,
    botTypes,
    latestCrawlAt,
    alreadyRecorded,
  };
}

/**
 * Fetch latest SOV evaluation raw_responses for an org (last 7 days),
 * then run pure citation matching against menu item names.
 */
export async function detectCitationMatches(
  supabase: SupabaseClient,
  orgId: string,
  menuItemNames: string[],
  existingEvents: PropagationEvent[],
): Promise<CitationMatchResult> {
  const alreadyRecorded = hasLiveInAIEvent(existingEvents);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: evals } = await supabase
    .from('sov_evaluations')
    .select('raw_response')
    .eq('org_id', orgId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  const sovResponses = (evals ?? []).map((e) => ({
    rawResponse: e.raw_response as string | null,
  }));

  const result = matchMenuItemsInResponses({ menuItemNames, sovResponses });

  return { ...result, alreadyRecorded };
}

/**
 * Main verification entry point: runs crawl + citation checks for a published
 * menu, then appends new propagation events if detected and not already recorded.
 *
 * Non-critical: never throws. Errors captured via Sentry.
 * Returns null for non-published or missing menus.
 */
export async function verifyMenuPropagation(
  supabase: SupabaseClient,
  menuId: string,
  orgId: string,
): Promise<VerificationResult | null> {
  try {
    // 1. Fetch menu
    const { data: menu, error } = await supabase
      .from('magic_menus')
      .select('extracted_data, propagation_events')
      .eq('id', menuId)
      .eq('is_published', true)
      .single();

    if (error || !menu) return null;

    const extractedData = menu.extracted_data as MenuExtractedData | null;
    const existingEvents = (menu.propagation_events as PropagationEvent[]) ?? [];
    const menuItemNames = (extractedData?.items ?? []).map((i) => i.name);

    // 2. Crawl detection
    const crawl = await detectCrawlHits(supabase, menuId, existingEvents);

    // 3. Citation matching
    const citation = await detectCitationMatches(supabase, orgId, menuItemNames, existingEvents);

    // 4. Build new events (dedup: skip if already recorded)
    const eventsAdded: PropagationEvent['event'][] = [];
    const newEvents: PropagationEvent[] = [...existingEvents];
    const now = new Date().toISOString();

    if (crawl.hasCrawlHits && !crawl.alreadyRecorded) {
      newEvents.push({ event: 'crawled', date: now });
      eventsAdded.push('crawled');
    }

    if (citation.isLiveInAI && !citation.alreadyRecorded) {
      newEvents.push({ event: 'live_in_ai', date: now });
      eventsAdded.push('live_in_ai');
    }

    // 5. Persist if any new events
    if (eventsAdded.length > 0) {
      await supabase
        .from('magic_menus')
        .update({ propagation_events: newEvents })
        .eq('id', menuId);
    }

    return { crawl, citation, eventsAdded };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: 'DIST-4', component: 'verification-service' },
      extra: { menuId, orgId },
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate distribution health stats across all published menus.
 * Requires service-role client (admin context).
 */
export async function getDistributionHealthStats(
  supabase: SupabaseClient,
): Promise<DistributionHealthStats> {
  const { data: menus } = await supabase
    .from('magic_menus')
    .select('org_id, propagation_events, last_distributed_at')
    .eq('is_published', true);

  const menuList = menus ?? [];
  const orgMenus = new Map<string, typeof menuList>();

  for (const menu of menuList) {
    const existing = orgMenus.get(menu.org_id as string) ?? [];
    existing.push(menu);
    orgMenus.set(menu.org_id as string, existing);
  }

  const totalOrgsWithPublishedMenus = orgMenus.size;
  let orgsDistributed = 0;
  let orgsCrawled = 0;
  let orgsLiveInAI = 0;

  for (const [, orgMenuList] of orgMenus) {
    const anyDistributed = orgMenuList.some((m) => m.last_distributed_at !== null);
    const events = orgMenuList.flatMap(
      (m) => (m.propagation_events as PropagationEvent[]) ?? [],
    );
    const anyCrawled = events.some((e) => e.event === 'crawled');
    const anyLiveInAI = events.some((e) => e.event === 'live_in_ai');

    if (anyDistributed) orgsDistributed++;
    if (anyCrawled) orgsCrawled++;
    if (anyLiveInAI) orgsLiveInAI++;
  }

  const pct = (n: number) =>
    totalOrgsWithPublishedMenus > 0
      ? Math.round((n / totalOrgsWithPublishedMenus) * 100)
      : 0;

  return {
    totalOrgsWithPublishedMenus,
    orgsDistributed,
    orgsCrawled,
    orgsLiveInAI,
    pctDistributed: pct(orgsDistributed),
    pctCrawled: pct(orgsCrawled),
    pctLiveInAI: pct(orgsLiveInAI),
  };
}
