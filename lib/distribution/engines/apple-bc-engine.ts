// ---------------------------------------------------------------------------
// lib/distribution/engines/apple-bc-engine.ts — Sprint 1 (placeholder)
//
// Sprint 2 will implement real Apple Business Connect menu sync.
// ---------------------------------------------------------------------------

import type {
  DistributionEngine,
  DistributionContext,
  EngineResult,
} from '../distribution-types';

export const appleBcEngine: DistributionEngine = {
  name: 'apple_bc',

  async distribute(_ctx: DistributionContext): Promise<EngineResult> {
    return {
      engine: 'apple_bc',
      status: 'skipped',
      message: 'Apple BC menu sync not yet implemented',
    };
  },
};
