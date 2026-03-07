'use client';

import { useState } from 'react';
import { Bell, AlertTriangle, CheckCircle2, TrendingUp, BarChart3, Star, X } from 'lucide-react';
import type { Notification } from '@/lib/services/notification-feed';
import { formatTimeAgo, countUnread, getNotificationColor } from '@/lib/services/notification-feed';

// ---------------------------------------------------------------------------
// S48: NotificationBell — In-app notification center
// Shows a bell icon with unread count badge. Opens a dropdown feed.
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  notifications: Notification[];
}

const ICON_MAP: Record<string, typeof AlertTriangle> = {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Star,
};

function getIcon(type: Notification['type']) {
  const names: Record<string, string> = {
    error_detected: 'AlertTriangle',
    error_fixed: 'CheckCircle2',
    competitor_change: 'TrendingUp',
    score_change: 'BarChart3',
    win: 'Star',
  };
  return ICON_MAP[names[type]] ?? Bell;
}

export default function NotificationBell({ notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const unreadCount = countUnread(notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="relative" data-testid="notification-bell">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        data-testid="notification-bell-button"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-[#0F1629] shadow-2xl"
          data-testid="notification-dropdown"
        >
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <p className="text-sm font-semibold text-white">Notifications</p>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => {
              const Icon = getIcon(n.type);
              const colorClass = getNotificationColor(n.type);

              return (
                <a
                  key={n.id}
                  href={n.href}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 border-b border-white/5 last:border-0"
                  data-testid="notification-item"
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{n.title}</p>
                    <p className="text-xs text-slate-400 truncate">{n.description}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{formatTimeAgo(n.timestamp)}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
