// ---------------------------------------------------------------------------
// lib/nap-sync/adapters/base-adapter.ts — Abstract NAP adapter base class
//
// Sprint 105: All platform adapters extend this and implement fetchNAP().
// ---------------------------------------------------------------------------

import type { PlatformId, AdapterResult, PlatformContext } from '../types';

/**
 * Abstract base class for all NAP platform adapters.
 * Each platform adapter extends this and implements fetchNAP().
 */
export abstract class NAPAdapter {
  abstract readonly platformId: PlatformId;

  /**
   * Fetch live NAP data for a given location from this platform.
   * Must NEVER throw — catch all errors and return AdapterResult with
   * status 'api_error' or 'unconfigured'.
   */
  abstract fetchNAP(
    locationId: string,
    orgId: string,
    context: PlatformContext,
  ): Promise<AdapterResult>;
}
