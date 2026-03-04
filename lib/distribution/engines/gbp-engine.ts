// ---------------------------------------------------------------------------
// lib/distribution/engines/gbp-engine.ts — Sprint 2: GBP Food Menus Push
//
// DistributionEngine adapter for Google Business Profile Food Menus API.
// Only fires if org has google_oauth_tokens + location_integrations with
// platform='google'. Fire-and-forget — never blocks publish.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type {
  DistributionEngine,
  DistributionContext,
  EngineResult,
} from '../distribution-types';
import { mapMenuToGBPFoodMenu } from '@/lib/gbp/gbp-menu-mapper';
import { pushMenuToGBP } from '@/lib/gbp/gbp-menu-client';

/**
 * Look up the GBP location resource name for this org.
 * Returns null if org has no google integration or no location linked.
 */
async function resolveGBPLocationId(
  ctx: DistributionContext,
): Promise<string | null> {
  // Check if org has a google OAuth token row
  const { data: tokenRow } = await ctx.supabase
    .from('google_oauth_tokens')
    .select('id')
    .eq('org_id', ctx.orgId)
    .single();

  if (!tokenRow) return null;

  // Find the primary location's google_location_name
  const { data: location } = await ctx.supabase
    .from('locations')
    .select('google_location_name')
    .eq('org_id', ctx.orgId)
    .not('google_location_name', 'is', null)
    .limit(1)
    .single();

  return location?.google_location_name ?? null;
}

export const gbpEngine: DistributionEngine = {
  name: 'gbp',

  async distribute(ctx: DistributionContext): Promise<EngineResult> {
    try {
      // Resolve GBP location — skip if org has no GBP integration
      const locationGBPId = await resolveGBPLocationId(ctx);
      if (!locationGBPId) {
        return {
          engine: 'gbp',
          status: 'skipped',
          message: 'No GBP integration for this org',
        };
      }

      // Map menu items → GBP Food Menu payload
      const gbpMenu = mapMenuToGBPFoodMenu(ctx.items);

      // Push to GBP API
      const result = await pushMenuToGBP(ctx.orgId, locationGBPId, gbpMenu);

      if (!result.success) {
        return {
          engine: 'gbp',
          status: 'error',
          message: result.error ?? 'GBP push failed',
        };
      }

      return { engine: 'gbp', status: 'success' };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { sprint: 'distribution-2', component: 'gbp-engine' },
        extra: { orgId: ctx.orgId, menuId: ctx.menuId },
      });
      return {
        engine: 'gbp',
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },
};
