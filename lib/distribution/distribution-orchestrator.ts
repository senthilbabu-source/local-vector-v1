// ---------------------------------------------------------------------------
// lib/distribution/distribution-orchestrator.ts — Sprint 1
//
// Core orchestrator: fetch menu → compute hash → compare → distribute → persist.
// Non-critical: errors captured via Sentry, never thrown.
// ---------------------------------------------------------------------------

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuExtractedData, PropagationEvent } from '@/lib/types/menu';
import type {
  DistributionResult,
  DistributionEngine,
  DistributionContext,
  EngineResult,
} from './distribution-types';
import { computeMenuHash } from './content-hasher';
import { indexNowEngine } from './engines/indexnow-engine';
import { gbpEngine } from './engines/gbp-engine';
import { appleBcEngine } from './engines/apple-bc-engine';

/** Default engine registry — Sprint 2 will activate GBP and Apple BC */
const DEFAULT_ENGINES: DistributionEngine[] = [
  indexNowEngine,
  gbpEngine,
  appleBcEngine,
];

/**
 * Distribute a published menu to AI engine adapters.
 *
 * Steps:
 * 1. Fetch menu's extracted_data, content_hash, public_slug from DB
 * 2. Compute new hash from items
 * 3. If hash matches stored → return {status: 'no_changes'}
 * 4. Call each engine adapter via Promise.all
 * 5. Record propagation events for successful engines
 * 6. Update content_hash + last_distributed_at in DB
 *
 * Non-critical: never throws. Errors captured via Sentry.
 */
export async function distributeMenu(
  supabase: SupabaseClient,
  menuId: string,
  orgId: string,
  engines: DistributionEngine[] = DEFAULT_ENGINES,
): Promise<DistributionResult> {
  try {
    // Step 1: Fetch menu
    const { data: menu, error: fetchError } = await supabase
      .from('magic_menus')
      .select('extracted_data, content_hash, public_slug, propagation_events')
      .eq('id', menuId)
      .single();

    if (fetchError || !menu) {
      return { status: 'error', engineResults: [], contentHash: null, distributedAt: null };
    }

    const extractedData = menu.extracted_data as MenuExtractedData | null;
    if (!extractedData?.items?.length) {
      return { status: 'error', engineResults: [], contentHash: null, distributedAt: null };
    }

    const publicSlug = menu.public_slug as string | null;
    if (!publicSlug) {
      return { status: 'error', engineResults: [], contentHash: null, distributedAt: null };
    }

    // Step 2: Compute hash
    const newHash = computeMenuHash(extractedData.items);
    const storedHash = (menu.content_hash as string) ?? null;

    // Step 3: Compare
    if (storedHash === newHash) {
      return {
        status: 'no_changes',
        engineResults: [],
        contentHash: newHash,
        distributedAt: null,
      };
    }

    // Step 4: Call each engine
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.localvector.ai';
    const ctx: DistributionContext = { menuId, orgId, publicSlug, appUrl };

    const engineResults: EngineResult[] = await Promise.all(
      engines.map((engine) => engine.distribute(ctx)),
    );

    // Step 5: Build propagation events for successful engines
    const existingEvents = (menu.propagation_events as PropagationEvent[]) ?? [];
    const now = new Date().toISOString();
    const newEvents: PropagationEvent[] = [...existingEvents];

    for (const result of engineResults) {
      if (result.status === 'success') {
        const eventName = engineToEventName(result.engine);
        if (eventName) {
          newEvents.push({ event: eventName, date: now });
        }
      }
    }

    // Step 6: Persist hash + timestamp + events
    await supabase
      .from('magic_menus')
      .update({
        content_hash: newHash,
        last_distributed_at: now,
        propagation_events: newEvents,
      })
      .eq('id', menuId);

    return {
      status: 'distributed',
      engineResults,
      contentHash: newHash,
      distributedAt: now,
    };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { sprint: 'distribution-1', component: 'distribution-orchestrator' },
      extra: { menuId, orgId },
    });
    return { status: 'error', engineResults: [], contentHash: null, distributedAt: null };
  }
}

/** Map engine name to PropagationEvent.event */
function engineToEventName(engine: string): PropagationEvent['event'] | null {
  switch (engine) {
    case 'indexnow':
      return 'indexnow_pinged';
    case 'gbp':
      return 'gbp_menu_pushed';
    case 'apple_bc':
      return 'apple_bc_synced';
    default:
      return null;
  }
}
