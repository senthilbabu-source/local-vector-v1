// ---------------------------------------------------------------------------
// lib/distribution/distribution-engines-config.ts — DIST-3: Distribution UI
//
// SSOT for engine display metadata used by the DistributionPanel.
// Maps engine names to display labels, propagation events, and bot types.
// ---------------------------------------------------------------------------

import type { PropagationEvent } from '@/lib/types/menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionEngineConfig {
  /** Matches DistributionEngine.name or a logical grouping key */
  id: string;
  /** Human-readable label for the engine row */
  label: string;
  /** Short description of the distribution method */
  description: string;
  /** active = we push data; passive = bot crawls our page */
  type: 'active' | 'passive';
  /** Which PropagationEvent.event to check for last activity (null for passive) */
  propagationEvent: PropagationEvent['event'] | null;
  /** bot_type keys from AI_BOT_REGISTRY for crawler activity matching */
  botTypes: string[];
}

// ---------------------------------------------------------------------------
// Engine registry
// ---------------------------------------------------------------------------

export const DISTRIBUTION_ENGINES: DistributionEngineConfig[] = [
  {
    id: 'gbp',
    label: 'Google (GBP)',
    description: 'Menu pushed via Food Menus API',
    type: 'active',
    propagationEvent: 'gbp_menu_pushed',
    botTypes: ['google-extended'],
  },
  {
    id: 'indexnow',
    label: 'Bing / Copilot',
    description: 'IndexNow ping for fast re-indexing',
    type: 'active',
    propagationEvent: 'indexnow_pinged',
    botTypes: [],
  },
  {
    id: 'apple_bc',
    label: 'Apple / Siri',
    description: 'Business Connect menu sync',
    type: 'active',
    propagationEvent: 'apple_bc_synced',
    botTypes: ['applebot-extended'],
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    description: 'Crawled by GPTBot',
    type: 'passive',
    propagationEvent: null,
    botTypes: ['gptbot', 'oai-searchbot', 'chatgpt-user'],
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    description: 'Crawled by PerplexityBot',
    type: 'passive',
    propagationEvent: null,
    botTypes: ['perplexitybot'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'Fed via Google indexing',
    type: 'passive',
    propagationEvent: null,
    botTypes: ['google-extended'],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ISO timestamp of the most recent matching propagation event
 * for an active engine. Returns null if no matching event found or engine
 * is passive (no propagation event to check).
 */
export function getEngineLastActivity(
  engine: DistributionEngineConfig,
  propagationEvents: PropagationEvent[],
): string | null {
  if (!engine.propagationEvent) return null;

  let latest: string | null = null;
  for (const ev of propagationEvents) {
    if (ev.event === engine.propagationEvent) {
      if (!latest || ev.date > latest) {
        latest = ev.date;
      }
    }
  }
  return latest;
}
