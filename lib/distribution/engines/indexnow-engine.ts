// ---------------------------------------------------------------------------
// lib/distribution/engines/indexnow-engine.ts — Sprint 1
//
// DistributionEngine adapter for IndexNow.
// Wraps existing lib/indexnow.ts pingIndexNow().
// ---------------------------------------------------------------------------

import { pingIndexNow } from '@/lib/indexnow';
import type {
  DistributionEngine,
  DistributionContext,
  EngineResult,
} from '../distribution-types';

export const indexNowEngine: DistributionEngine = {
  name: 'indexnow',

  async distribute(ctx: DistributionContext): Promise<EngineResult> {
    if (!process.env.INDEXNOW_API_KEY) {
      return {
        engine: 'indexnow',
        status: 'skipped',
        message: 'INDEXNOW_API_KEY not configured',
      };
    }

    const menuUrl = `${ctx.appUrl}/m/${ctx.publicSlug}`;

    try {
      const ok = await pingIndexNow([menuUrl]);
      return ok
        ? { engine: 'indexnow', status: 'success' }
        : { engine: 'indexnow', status: 'error', message: 'IndexNow returned non-200/202' };
    } catch (err) {
      // pingIndexNow already captures to Sentry; return error status
      return {
        engine: 'indexnow',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },
};
