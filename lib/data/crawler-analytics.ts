/**
 * lib/data/crawler-analytics.ts — Crawler analytics data fetching layer
 *
 * Fetches aggregated crawler data for the dashboard.
 * Same service-injection pattern as lib/data/dashboard.ts (Sprint 64).
 *
 * Sprint 73 — AI Crawler Analytics.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getAllTrackedBots } from '@/lib/crawler/bot-detector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CrawlerSummary {
  /** Per-bot visit count (last 30 days) */
  bots: BotActivity[];
  /** Total visits across all bots (last 30 days) */
  totalVisits: number;
  /** Bots with 0 visits — "blind spots" */
  blindSpots: BlindSpot[];
  /** Total number of blind spots */
  blindSpotCount: number;
}

export interface BotActivity {
  botType: string;
  label: string;
  engine: string;
  description: string;
  /** Visit count in the last 30 days */
  visitCount: number;
  /** Most recent visit timestamp, or null if never visited */
  lastVisitAt: string | null;
  /** Status derived from visitCount */
  status: 'active' | 'low' | 'blind_spot';
}

export interface BlindSpot {
  botType: string;
  label: string;
  engine: string;
  /** Human-readable fix recommendation */
  fixRecommendation: string;
}

// ---------------------------------------------------------------------------
// Fix recommendations (static per engine)
// ---------------------------------------------------------------------------

const BLIND_SPOT_FIXES: Record<string, string> = {
  'gptbot':            'Ensure your robots.txt allows GPTBot. Submit your menu URL to ChatGPT via chat.',
  'oai-searchbot':     'OAI-SearchBot follows GPTBot rules. Allow GPTBot in robots.txt to enable ChatGPT Search.',
  'chatgpt-user':      'ChatGPT browsing requires GPTBot access. Check robots.txt and ensure your site loads without JavaScript.',
  'claudebot':         'Allow ClaudeBot in robots.txt. Claude indexes pages linked from structured data and sitemaps.',
  'google-extended':   'Google-Extended is controlled in Google Search Console. Ensure it\'s not blocked in robots.txt.',
  'perplexitybot':     'Allow PerplexityBot in robots.txt. Submit your URL to Perplexity via their web interface.',
  'meta-external':     'Allow meta-externalagent in robots.txt. Ensure your Facebook/Instagram business profiles link to your website.',
  'bytespider':        'Bytespider crawls pages linked from TikTok. Ensure your TikTok profile links to your menu page.',
  'amazonbot':         'Allow Amazonbot in robots.txt. Ensure your business is listed on Amazon/Alexa.',
  'applebot-extended': 'Allow Applebot-Extended in robots.txt. Register your business on Apple Maps Connect.',
};

// ---------------------------------------------------------------------------
// Status thresholds
// ---------------------------------------------------------------------------

function deriveStatus(visitCount: number): 'active' | 'low' | 'blind_spot' {
  if (visitCount >= 5) return 'active';
  if (visitCount >= 1) return 'low';
  return 'blind_spot';
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetches crawler analytics for an org.
 * Queries crawler_hits for the last 30 days, aggregates by bot_type.
 * Cross-references with AI_BOT_REGISTRY to detect blind spots.
 */
export async function fetchCrawlerAnalytics(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<CrawlerSummary> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: hits } = await supabase
    .from('crawler_hits')
    .select('bot_type, crawled_at')
    .eq('org_id', orgId)
    .gte('crawled_at', thirtyDaysAgo.toISOString());

  // Aggregate by bot_type: count + max crawled_at
  const agg = new Map<string, { count: number; maxAt: string | null }>();
  for (const hit of hits ?? []) {
    const existing = agg.get(hit.bot_type);
    if (existing) {
      existing.count++;
      if (hit.crawled_at && (!existing.maxAt || hit.crawled_at > existing.maxAt)) {
        existing.maxAt = hit.crawled_at;
      }
    } else {
      agg.set(hit.bot_type, { count: 1, maxAt: hit.crawled_at });
    }
  }

  // Cross-reference with full registry
  const allBots = getAllTrackedBots();
  const bots: BotActivity[] = allBots.map((bot) => {
    const stats = agg.get(bot.botType);
    const visitCount = stats?.count ?? 0;
    return {
      botType: bot.botType,
      label: bot.label,
      engine: bot.engine,
      description: bot.description,
      visitCount,
      lastVisitAt: stats?.maxAt ?? null,
      status: deriveStatus(visitCount),
    };
  });

  // Sort by visitCount descending
  bots.sort((a, b) => b.visitCount - a.visitCount);

  // Blind spots: bots with 0 visits
  const blindSpots: BlindSpot[] = bots
    .filter((b) => b.status === 'blind_spot')
    .map((b) => ({
      botType: b.botType,
      label: b.label,
      engine: b.engine,
      fixRecommendation: BLIND_SPOT_FIXES[b.botType] ?? 'Check your robots.txt configuration.',
    }));

  const totalVisits = bots.reduce((sum, b) => sum + b.visitCount, 0);

  return {
    bots,
    totalVisits,
    blindSpots,
    blindSpotCount: blindSpots.length,
  };
}
