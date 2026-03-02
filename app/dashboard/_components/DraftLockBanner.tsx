'use client';

import { useDraftLock } from '@/hooks/useDraftLock';

interface DraftLockBannerProps {
  draftId: string;
  orgId: string;
  currentUser: {
    user_id: string;
    email: string;
    full_name: string | null;
  };
}

export default function DraftLockBanner({
  draftId,
  orgId,
  currentUser,
}: DraftLockBannerProps) {
  const { othersEditing, hasConflict } = useDraftLock(draftId, orgId, currentUser);

  if (!hasConflict) return null;

  const firstName = othersEditing[0]?.user_name ?? othersEditing[0]?.user_email ?? 'Someone';
  const extraCount = othersEditing.length - 1;

  const message =
    extraCount > 0
      ? `${firstName} and ${extraCount} ${extraCount === 1 ? 'other' : 'others'} are editing this draft.`
      : `${firstName} is currently editing this draft. Your changes may conflict.`;

  return (
    <div
      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      data-testid="draft-lock-banner"
    >
      <span data-testid="draft-lock-user-name">{message}</span>
    </div>
  );
}
