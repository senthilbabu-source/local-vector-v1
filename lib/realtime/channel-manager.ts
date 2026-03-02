'use client';

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { buildOrgChannelName } from './types';

/**
 * Singleton channel registry for the browser.
 * Ensures one Supabase Realtime channel per org per browser tab.
 * Prevents duplicate subscriptions when multiple hooks mount.
 *
 * Module-level state (Map) — shared across all imports in one browser tab.
 * This is intentional and correct for Next.js App Router client components.
 */

const channels = new Map<string, RealtimeChannel>();
const refCounts = new Map<string, number>();

export function acquireOrgChannel(
  supabase: SupabaseClient,
  orgId: string,
): RealtimeChannel {
  const name = buildOrgChannelName(orgId);
  const existing = channels.get(name);

  if (existing) {
    refCounts.set(name, (refCounts.get(name) ?? 0) + 1);
    return existing;
  }

  const channel = supabase.channel(name, {
    config: {
      presence: { key: orgId },
      broadcast: { self: false },
    },
  });

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      console.warn(`[realtime] Channel ${name} error`);
    }
  });

  channels.set(name, channel);
  refCounts.set(name, 1);

  return channel;
}

export function releaseOrgChannel(
  supabase: SupabaseClient,
  orgId: string,
): void {
  const name = buildOrgChannelName(orgId);
  const count = (refCounts.get(name) ?? 0) - 1;

  if (count <= 0) {
    const channel = channels.get(name);
    if (channel) {
      supabase.removeChannel(channel);
    }
    channels.delete(name);
    refCounts.delete(name);
  } else {
    refCounts.set(name, count);
  }
}

export function getOrgChannel(orgId: string): RealtimeChannel | undefined {
  return channels.get(buildOrgChannelName(orgId));
}
