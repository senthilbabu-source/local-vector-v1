// ---------------------------------------------------------------------------
// lib/nap-sync/types.ts — NAP Sync Engine shared types
//
// Sprint 105: Cross-platform listing accuracy layer.
// All adapter implementations and the discrepancy detector import from here.
// ---------------------------------------------------------------------------

/**
 * Canonical NAP data structure — the normalized shape all adapters must return.
 * Fields are optional: adapters return only what the platform provides.
 */
export interface NAPData {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;         // E.164 format: +14705550123
  website?: string;
  hours?: Record<string, { open: string; close: string; closed: boolean }>;
  operational_status?: 'open' | 'closed_permanently' | 'closed_temporarily' | null;
}

/** Platform identifiers. */
export type PlatformId = 'google' | 'yelp' | 'apple_maps' | 'bing';

/** Result of a single adapter fetch attempt. */
export type AdapterResult =
  | { status: 'ok'; platform: PlatformId; data: NAPData; fetched_at: string }
  | { status: 'unconfigured'; platform: PlatformId; reason: string }
  | { status: 'api_error'; platform: PlatformId; message: string; http_status?: number }
  | { status: 'not_found'; platform: PlatformId };

/** A single field-level discrepancy between Ground Truth and a platform's live data. */
export interface NAPField {
  field: keyof NAPData;
  ground_truth_value: string | null;
  platform_value: string | null;
}

/** Full discrepancy report for a single platform. */
export interface PlatformDiscrepancy {
  platform: PlatformId;
  location_id: string;
  org_id: string;
  status: 'match' | 'discrepancy' | 'unconfigured' | 'api_error' | 'not_found';
  discrepant_fields: NAPField[];
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  auto_correctable: boolean;
  detected_at: string;
  fix_instructions?: string;
}

/** NAP Health Score — composite 0–100 across all platforms. */
export interface NAPHealthScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  platforms_checked: number;
  platforms_matched: number;
  critical_discrepancies: number;
  last_checked_at: string;
}

/** Ground Truth — the authoritative data from LocalVector's locations table. */
export interface GroundTruth {
  location_id: string;
  org_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  hours_data?: Record<string, { open: string; close: string; closed: boolean }>;
  operational_status?: string | null;
}

/** Platform-specific context passed to each adapter. */
export interface PlatformContext {
  gbp_location_id?: string;
  yelp_business_id?: string;
  apple_maps_id?: string;
  bing_listing_id?: string;
}

/** Result of a full sync run for one location. */
export interface NAPSyncResult {
  location_id: string;
  org_id: string;
  health_score: NAPHealthScore;
  platform_results: AdapterResult[];
  discrepancies: PlatformDiscrepancy[];
  corrections_pushed: PlatformId[];
  corrections_failed: PlatformId[];
  run_at: string;
}
