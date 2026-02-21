'use client';

import { useTransition } from 'react';
import { updateHallucinationStatus, type CorrectionStatus } from '../../actions';

const STATUS_OPTIONS: { value: CorrectionStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'verifying', label: 'Verifying' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'recurring', label: 'Recurring' },
];

interface Props {
  hallucinationId: string;
  currentStatus: CorrectionStatus;
}

export default function StatusDropdown({ hallucinationId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as CorrectionStatus;
    startTransition(async () => {
      await updateHallucinationStatus(hallucinationId, newStatus);
    });
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:cursor-wait disabled:opacity-60"
    >
      {STATUS_OPTIONS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
