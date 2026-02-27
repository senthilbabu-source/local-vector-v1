'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateEntityStatus } from '@/app/dashboard/actions/entity-health';
import type { EntityPlatform, EntityStatus } from '@/lib/services/entity-health.service';

interface EntityStatusDropdownProps {
  platform: EntityPlatform;
  currentStatus: EntityStatus;
}

const STATUS_OPTIONS: { value: EntityStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'missing', label: 'Missing' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'unchecked', label: 'Not Checked' },
];

export default function EntityStatusDropdown({ platform, currentStatus }: EntityStatusDropdownProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as EntityStatus;
    if (newStatus === currentStatus) return;

    const formData = new FormData();
    formData.set('platform', platform);
    formData.set('status', newStatus);

    startTransition(async () => {
      await updateEntityStatus(formData);
      router.refresh();
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-white/10 bg-midnight-slate px-2 py-1 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-electric-indigo disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
