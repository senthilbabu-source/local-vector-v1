'use client';

import { useEffect, useState } from 'react';
import type { PresenceUser } from '@/lib/realtime/types';
import { useOrgChannel } from './useOrgChannel';

/**
 * Deduplicate presence state: one entry per user_id, latest online_at wins.
 * Excludes the given excludeUserId. Sorted by online_at ASC.
 * Exported for testing.
 */
export function deduplicatePresenceUsers(
  state: Record<string, PresenceUser[]>,
  excludeUserId: string,
): PresenceUser[] {
  const byUserId = new Map<string, PresenceUser>();

  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p.user_id === excludeUserId) continue;
      const existing = byUserId.get(p.user_id);
      if (!existing || p.online_at > existing.online_at) {
        byUserId.set(p.user_id, p);
      }
    }
  }

  return Array.from(byUserId.values()).sort(
    (a, b) => a.online_at.localeCompare(b.online_at),
  );
}

export function usePresence(
  orgId: string,
  currentUser: PresenceUser,
): {
  onlineUsers: PresenceUser[];
  isSubscribed: boolean;
} {
  const channel = useOrgChannel(orgId);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!channel) {
      setIsSubscribed(false);
      setOnlineUsers([]);
      return;
    }

    channel.track(currentUser);
    setIsSubscribed(true);

    const handleSync = () => {
      const state = channel.presenceState<PresenceUser>();
      setOnlineUsers(deduplicatePresenceUsers(state, currentUser.user_id));
    };

    channel.on('presence', { event: 'sync' }, handleSync);
    channel.on('presence', { event: 'join' }, handleSync);
    channel.on('presence', { event: 'leave' }, handleSync);

    return () => {
      channel.untrack();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, currentUser.user_id]);

  return { onlineUsers, isSubscribed };
}
