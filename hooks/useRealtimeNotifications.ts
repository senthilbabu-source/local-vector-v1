'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { RealtimeNotification, NotificationPayload } from '@/lib/realtime/types';
import { MAX_NOTIFICATIONS_QUEUE } from '@/lib/realtime/types';
import { useOrgChannel } from './useOrgChannel';

const AUTO_DISMISS_MS = 8_000;

export function useRealtimeNotifications(orgId: string): {
  notifications: RealtimeNotification[];
  dismissNotification: (id: string) => void;
  clearAll: () => void;
} {
  const channel = useOrgChannel(orgId);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const seenRef = useRef(new Set<string>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!channel) return;

    channel.on('broadcast', { event: 'notification' }, (msg) => {
      const payload = msg.payload as NotificationPayload;
      const dedupKey = `${payload.event}:${payload.sent_at}`;
      if (seenRef.current.has(dedupKey)) return;
      seenRef.current.add(dedupKey);

      const id = crypto.randomUUID();
      const notif: RealtimeNotification = {
        ...payload,
        id,
        received_at: new Date().toISOString(),
      };

      setNotifications((prev) =>
        [notif, ...prev].slice(0, MAX_NOTIFICATIONS_QUEUE),
      );

      // Dispatch refresh event if refresh_keys present
      if (payload.refresh_keys && payload.refresh_keys.length > 0) {
        window.dispatchEvent(
          new CustomEvent('localvector:refresh', {
            detail: { keys: payload.refresh_keys },
          }),
        );
      }

      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        timersRef.current.delete(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    });

    return () => {
      // Cleanup timers on unmount
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, [channel]);

  return { notifications, dismissNotification, clearAll };
}
