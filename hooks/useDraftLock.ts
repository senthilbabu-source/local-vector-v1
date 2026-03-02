'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { DraftLock } from '@/lib/realtime/types';
import { DRAFT_LOCK_HEARTBEAT_INTERVAL_MS, DRAFT_LOCK_TTL_SECONDS } from '@/lib/realtime/types';
import { createClient } from '@/lib/supabase/client';
import { useOrgChannel } from './useOrgChannel';

interface DraftLockUser {
  user_id: string;
  email: string;
  full_name: string | null;
}

export function useDraftLock(
  draftId: string,
  orgId: string,
  currentUser: DraftLockUser,
): {
  activeLocks: DraftLock[];
  othersEditing: DraftLock[];
  hasConflict: boolean;
  acquireLock: () => Promise<void>;
  releaseLock: () => Promise<void>;
} {
  const channel = useOrgChannel(orgId);
  const [activeLocks, setActiveLocks] = useState<DraftLock[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLocks = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('draft_locks')
        .select('*')
        .eq('draft_id', draftId)
        .gt('expires_at', new Date().toISOString());
      setActiveLocks((data as DraftLock[]) ?? []);
    } catch {
      // Lock fetch failure is non-critical
    }
  }, [draftId]);

  const acquireLock = useCallback(async () => {
    try {
      const supabase = createClient();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + DRAFT_LOCK_TTL_SECONDS * 1000);

      await supabase
        .from('draft_locks')
        .upsert(
          {
            draft_id: draftId,
            org_id: orgId,
            user_id: currentUser.user_id,
            user_email: currentUser.email,
            user_name: currentUser.full_name,
            locked_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          },
          { onConflict: 'draft_id,user_id' },
        );
    } catch (err) {
      console.warn('[draft-lock] Acquire failed (advisory):', err);
    }
  }, [draftId, orgId, currentUser.user_id, currentUser.email, currentUser.full_name]);

  const releaseLock = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase
        .from('draft_locks')
        .delete()
        .eq('draft_id', draftId)
        .eq('user_id', currentUser.user_id);
    } catch (err) {
      console.warn('[draft-lock] Release failed:', err);
    }
  }, [draftId, currentUser.user_id]);

  // Acquire on mount, heartbeat, release on unmount
  useEffect(() => {
    acquireLock();
    fetchLocks();

    intervalRef.current = setInterval(() => {
      acquireLock();
    }, DRAFT_LOCK_HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      releaseLock();
    };
  }, [acquireLock, releaseLock, fetchLocks]);

  // Listen for Postgres Changes on draft_locks
  useEffect(() => {
    if (!channel) return;

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'draft_locks',
        filter: `draft_id=eq.${draftId}`,
      },
      () => {
        fetchLocks();
      },
    );
  }, [channel, draftId, fetchLocks]);

  const othersEditing = activeLocks.filter(
    (l) => l.user_id !== currentUser.user_id,
  );

  return {
    activeLocks,
    othersEditing,
    hasConflict: othersEditing.length > 0,
    acquireLock,
    releaseLock,
  };
}
