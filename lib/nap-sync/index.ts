// ---------------------------------------------------------------------------
// lib/nap-sync/index.ts — Barrel export for NAP Sync Engine
// Sprint 105
// ---------------------------------------------------------------------------

export type {
  NAPData,
  PlatformId,
  AdapterResult,
  NAPField,
  PlatformDiscrepancy,
  NAPHealthScore,
  GroundTruth,
  PlatformContext,
  NAPSyncResult,
} from './types';

export {
  detectDiscrepancies,
  diffNAPData,
  normalizePhone,
  normalizeAddress,
  computeSeverity,
  generateFixInstructions,
} from './nap-discrepancy-detector';

export { calculateNAPHealthScore } from './nap-health-score';

export { pushNAPCorrections, buildGBPPatchBody } from './nap-push-corrections';
export type { GBPUpdatePayload } from './nap-push-corrections';

export { runNAPSync, runNAPSyncForAllLocations } from './nap-sync-service';

export { GBPNAPAdapter } from './adapters/gbp-adapter';
export { YelpNAPAdapter, normalizeYelpHours } from './adapters/yelp-adapter';
export { AppleMapsNAPAdapter } from './adapters/apple-maps-adapter';
export { BingNAPAdapter, scoreAddressSimilarity } from './adapters/bing-adapter';
