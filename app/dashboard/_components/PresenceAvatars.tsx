'use client';

import { usePresence } from '@/hooks/usePresence';
import type { PresenceUser } from '@/lib/realtime/types';
import { MAX_VISIBLE_PRESENCE_AVATARS } from '@/lib/realtime/types';

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
];

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name[0].toUpperCase();
  }
  return email[0].toUpperCase();
}

function getColor(userId: string): string {
  let sum = 0;
  for (let i = 0; i < userId.length; i++) {
    sum += userId.charCodeAt(i);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

interface PresenceAvatarsProps {
  orgId: string;
  currentUser: PresenceUser;
}

export default function PresenceAvatars({ orgId, currentUser }: PresenceAvatarsProps) {
  const { onlineUsers } = usePresence(orgId, currentUser);

  if (onlineUsers.length === 0) return null;

  const visible = onlineUsers.slice(0, MAX_VISIBLE_PRESENCE_AVATARS);
  const overflow = onlineUsers.length - MAX_VISIBLE_PRESENCE_AVATARS;

  return (
    <div className="flex items-center -space-x-2" data-testid="presence-avatars">
      {visible.map((user) => (
        <div
          key={user.user_id}
          className={`${getColor(user.user_id)} w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white ring-2 ring-midnight-slate`}
          title={`${user.full_name ?? user.email} (${user.role})`}
          data-testid={`presence-avatar-${user.user_id}`}
        >
          {getInitials(user.full_name, user.email)}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="bg-slate-600 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white ring-2 ring-midnight-slate"
          data-testid="presence-overflow-count"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
