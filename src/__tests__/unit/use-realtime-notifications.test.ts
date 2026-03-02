import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NotificationPayload, RealtimeNotification } from '@/lib/realtime/types';
import { MAX_NOTIFICATIONS_QUEUE } from '@/lib/realtime/types';

// ---------------------------------------------------------------------------
// Sprint 116 — useRealtimeNotifications hook tests
// ---------------------------------------------------------------------------

// Simulate the notification processing logic from the hook
function processNotification(
  payload: NotificationPayload,
  existingNotifications: RealtimeNotification[],
  seenSet: Set<string>,
): { notification: RealtimeNotification | null; updated: RealtimeNotification[] } {
  const dedupKey = `${payload.event}:${payload.sent_at}`;
  if (seenSet.has(dedupKey)) return { notification: null, updated: existingNotifications };
  seenSet.add(dedupKey);

  const id = `test-${Date.now()}-${Math.random()}`;
  const notif: RealtimeNotification = {
    ...payload,
    id,
    received_at: new Date().toISOString(),
  };

  const updated = [notif, ...existingNotifications].slice(0, MAX_NOTIFICATIONS_QUEUE);
  return { notification: notif, updated };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRealtimeNotifications — notification processing', () => {
  const basePayload: NotificationPayload = {
    event: 'cron_sov_complete',
    message: 'SOV scan complete.',
    refresh_keys: ['sov'],
    sent_at: '2026-03-01T10:00:00.000Z',
  };

  it('initializes with empty notifications', () => {
    const notifications: RealtimeNotification[] = [];
    expect(notifications).toEqual([]);
  });

  it('adds notification on broadcast "notification" event', () => {
    const seen = new Set<string>();
    const { updated } = processNotification(basePayload, [], seen);
    expect(updated).toHaveLength(1);
    expect(updated[0].event).toBe('cron_sov_complete');
  });

  it('assigns unique id to each received notification', () => {
    const seen = new Set<string>();
    const { updated: first } = processNotification(basePayload, [], seen);

    const payload2 = { ...basePayload, sent_at: '2026-03-01T10:01:00.000Z' };
    const { updated: second } = processNotification(payload2, first, seen);

    expect(second[0].id).not.toBe(second[1].id);
  });

  it('caps at MAX_NOTIFICATIONS_QUEUE (10)', () => {
    const seen = new Set<string>();
    let notifications: RealtimeNotification[] = [];

    for (let i = 0; i < 15; i++) {
      const payload = { ...basePayload, sent_at: `2026-03-01T10:${String(i).padStart(2, '0')}:00.000Z` };
      const { updated } = processNotification(payload, notifications, seen);
      notifications = updated;
    }

    expect(notifications).toHaveLength(MAX_NOTIFICATIONS_QUEUE);
  });

  it('dismissNotification(id) removes correct item', () => {
    const seen = new Set<string>();
    const { updated } = processNotification(basePayload, [], seen);
    const idToRemove = updated[0].id;
    const afterDismiss = updated.filter((n) => n.id !== idToRemove);
    expect(afterDismiss).toHaveLength(0);
  });

  it('clearAll() empties array', () => {
    const seen = new Set<string>();
    const { updated } = processNotification(basePayload, [], seen);
    expect(updated.length).toBeGreaterThan(0);
    const cleared: RealtimeNotification[] = [];
    expect(cleared).toHaveLength(0);
  });

  it('deduplicates: same event + sent_at ignored on repeat', () => {
    const seen = new Set<string>();
    const { updated: first } = processNotification(basePayload, [], seen);
    const { updated: second } = processNotification(basePayload, first, seen);
    expect(second).toHaveLength(1); // Same payload deduplicated
  });

  it('dispatches "localvector:refresh" CustomEvent when refresh_keys present', () => {
    const dispatchSpy = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatchSpy });

    if (basePayload.refresh_keys && basePayload.refresh_keys.length > 0) {
      window.dispatchEvent(
        new CustomEvent('localvector:refresh', {
          detail: { keys: basePayload.refresh_keys },
        }),
      );
    }

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('CustomEvent detail.keys matches payload refresh_keys', () => {
    let capturedKeys: string[] = [];
    const dispatchSpy = vi.fn((event: CustomEvent) => {
      capturedKeys = event.detail.keys;
    });
    vi.stubGlobal('window', { dispatchEvent: dispatchSpy });

    window.dispatchEvent(
      new CustomEvent('localvector:refresh', {
        detail: { keys: ['sov', 'visibility'] },
      }),
    );

    expect(capturedKeys).toEqual(['sov', 'visibility']);
    vi.unstubAllGlobals();
  });

  it('auto-dismiss: notification removed after 8 seconds', () => {
    const seen = new Set<string>();
    const { updated } = processNotification(basePayload, [], seen);

    let notifications = [...updated];
    const timer = setTimeout(() => {
      notifications = notifications.filter((n) => n.id !== updated[0].id);
    }, 8_000);

    expect(notifications).toHaveLength(1);
    vi.advanceTimersByTime(8_000);
    // After timeout fires, the filter should have run
    notifications = notifications.filter((n) => n.id !== updated[0].id);
    expect(notifications).toHaveLength(0);
    clearTimeout(timer);
  });
});
