// ---------------------------------------------------------------------------
// Listings Health Utilities — Sprint 42 Step 4
//
// Pure functions for computing listing health status per platform.
// Used by PlatformRow (badge) and integrations page (summary stats).
// ---------------------------------------------------------------------------

export type ListingHealth = 'healthy' | 'stale' | 'missing_url' | 'disconnected';

/**
 * Determines the health status of a single listing/integration.
 *
 * Priority order:
 *   1. No integration row or not connected → 'disconnected'
 *   2. Connected but no listing URL → 'missing_url'
 *   3. Connected but last sync > 7 days ago → 'stale'
 *   4. Everything else → 'healthy'
 */
export function getListingHealth(integration: {
  status: string;
  listing_url: string | null;
  last_sync_at: string | null;
} | null): ListingHealth {
  if (!integration) return 'disconnected';
  if (integration.status !== 'connected') return 'disconnected';
  if (!integration.listing_url) return 'missing_url';

  if (integration.last_sync_at) {
    const daysSinceSync =
      (Date.now() - new Date(integration.last_sync_at).getTime()) / 86_400_000;
    if (daysSinceSync > 7) return 'stale';
  }

  return 'healthy';
}

/**
 * Returns a badge config (label + literal Tailwind classes) for a listing health status.
 * All classes are literal strings for JIT scanner safety (AI_RULES §12).
 */
export function healthBadge(health: ListingHealth): {
  label: string;
  classes: string;
} {
  switch (health) {
    case 'healthy':
      return {
        label: 'Healthy',
        classes: 'bg-emerald-400/10 text-emerald-400 ring-emerald-400/20',
      };
    case 'stale':
      return {
        label: 'Stale sync',
        classes: 'bg-amber-400/10 text-amber-400 ring-amber-400/20',
      };
    case 'missing_url':
      return {
        label: 'Missing URL',
        classes: 'bg-amber-400/10 text-amber-400 ring-amber-400/20',
      };
    case 'disconnected':
      return {
        label: 'Not connected',
        classes: 'bg-slate-400/10 text-slate-400 ring-slate-400/20',
      };
  }
}
