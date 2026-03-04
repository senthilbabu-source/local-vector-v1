// ---------------------------------------------------------------------------
// lib/distribution/engines/gbp-engine.ts — Sprint 1 (placeholder)
//
// Sprint 2 will implement real GBP Food Menus API push.
// ---------------------------------------------------------------------------

import type {
  DistributionEngine,
  DistributionContext,
  EngineResult,
} from '../distribution-types';

export const gbpEngine: DistributionEngine = {
  name: 'gbp',

  async distribute(_ctx: DistributionContext): Promise<EngineResult> {
    return {
      engine: 'gbp',
      status: 'skipped',
      message: 'GBP Food Menus push not yet implemented',
    };
  },
};
