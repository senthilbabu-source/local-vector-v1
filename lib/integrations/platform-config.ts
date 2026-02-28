// ---------------------------------------------------------------------------
// lib/integrations/platform-config.ts — Platform Sync Type Configuration
//
// Sprint C (C2): Single source of truth for how each Big 6 platform syncs.
// Used by PlatformRow to render honest UI states.
//
// Sync types:
//   real_oauth  — GBP: real OAuth + auto-sync via Google APIs
//   manual_url  — Yelp, TripAdvisor: user enters listing URL, no API sync
//   coming_soon — Apple, Bing, Facebook: automated sync not yet available
// ---------------------------------------------------------------------------

import type { Big6Platform } from '@/lib/schemas/integrations';

export type PlatformSyncType = 'real_oauth' | 'manual_url' | 'coming_soon';

export interface PlatformSyncConfig {
  syncType: PlatformSyncType;
  /** Human-readable description shown below platform name */
  syncDescription: string;
  /** ETA label for coming_soon platforms */
  eta?: string;
  /** External URL where users can manage their listing on this platform */
  claimUrl?: string;
  /** True if we can verify business data via read-only API (Sprint L) */
  verifiable?: boolean;
}

export const PLATFORM_SYNC_CONFIG: Record<Big6Platform, PlatformSyncConfig> = {
  google: {
    syncType: 'real_oauth',
    syncDescription: 'Syncs automatically when connected via OAuth',
  },
  yelp: {
    syncType: 'manual_url',
    syncDescription: 'Manual URL tracking — data verification available',
    claimUrl: 'https://biz.yelp.com',
    verifiable: true,
  },
  tripadvisor: {
    syncType: 'manual_url',
    syncDescription: 'Manual URL tracking — automated sync coming soon',
    claimUrl: 'https://www.tripadvisor.com/Owners',
  },
  apple: {
    syncType: 'coming_soon',
    syncDescription: 'Automated sync coming Q2 2026',
    eta: 'Q2 2026',
  },
  bing: {
    syncType: 'manual_url',
    syncDescription: 'Manual URL tracking — data verification available',
    claimUrl: 'https://www.bingplaces.com',
    verifiable: true,
  },
  facebook: {
    syncType: 'coming_soon',
    syncDescription: 'Automated sync coming Q3 2026',
    eta: 'Q3 2026',
  },
};
