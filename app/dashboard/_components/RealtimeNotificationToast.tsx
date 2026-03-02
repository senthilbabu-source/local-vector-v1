'use client';

import Link from 'next/link';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import type { NotificationEventType } from '@/lib/realtime/types';

const EVENT_ICONS: Record<string, string> = {
  cron_sov_complete: '\uD83D\uDD04',
  cron_audit_complete: '\uD83D\uDD04',
  cron_content_audit_complete: '\uD83D\uDD04',
  member_joined: '\uD83D\uDC4B',
  member_removed: '\uD83D\uDC4B',
  hallucination_detected: '\u26A0\uFE0F',
  draft_published: '\u2705',
};

function getIcon(event: NotificationEventType): string {
  return EVENT_ICONS[event] ?? '\uD83D\uDD14';
}

interface RealtimeNotificationToastProps {
  orgId: string;
}

export default function RealtimeNotificationToast({ orgId }: RealtimeNotificationToastProps) {
  const { notifications, dismissNotification } = useRealtimeNotifications(orgId);

  const visible = notifications.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80"
      data-testid="notification-toast-container"
    >
      {visible.map((notif) => (
        <div
          key={notif.id}
          className="rounded-lg border border-slate-700 bg-slate-800 p-4 shadow-lg text-sm text-slate-200 animate-in fade-in slide-in-from-right-5 duration-200"
          data-testid={`notification-toast-${notif.id}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0">{getIcon(notif.event)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200">{notif.message}</p>
              {notif.action_url && notif.action_label && (
                <Link
                  href={notif.action_url}
                  className="mt-1 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  onClick={() => dismissNotification(notif.id)}
                  data-testid={`notification-toast-action-${notif.id}`}
                >
                  {notif.action_label} &rarr;
                </Link>
              )}
            </div>
            <button
              type="button"
              className="flex-shrink-0 text-slate-500 hover:text-slate-300"
              onClick={() => dismissNotification(notif.id)}
              data-testid={`notification-toast-dismiss-${notif.id}`}
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
