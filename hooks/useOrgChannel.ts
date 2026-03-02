'use client';

import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { acquireOrgChannel, releaseOrgChannel } from '@/lib/realtime/channel-manager';

/**
 * Base hook that manages channel lifecycle for a single org.
 * All other realtime hooks call this hook.
 *
 * Returns the channel or null if orgId is null or channel errored.
 */
export function useOrgChannel(orgId: string | null): RealtimeChannel | null {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!orgId) {
      setChannel(null);
      return;
    }

    const supabase = createClient();
    const ch = acquireOrgChannel(supabase, orgId);
    setChannel(ch);

    return () => {
      releaseOrgChannel(supabase, orgId);
      setChannel(null);
    };
  }, [orgId]);

  return channel;
}
