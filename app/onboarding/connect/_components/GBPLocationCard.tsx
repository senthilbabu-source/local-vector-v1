'use client';

// ---------------------------------------------------------------------------
// GBPLocationCard — Displays a single GBP location in the picker (Sprint 89)
// ---------------------------------------------------------------------------

import { useTransition } from 'react';
import type { GBPLocation } from '@/lib/types/gbp';

interface Props {
  location: GBPLocation;
  index: number;
  onSelect: (index: number) => void;
}

function formatAddress(loc: GBPLocation): string | null {
  const addr = loc.storefrontAddress;
  if (!addr) return null;

  const parts: string[] = [];
  if (addr.addressLines?.length) parts.push(addr.addressLines.join(', '));
  if (addr.locality) parts.push(addr.locality);
  if (addr.administrativeArea) parts.push(addr.administrativeArea);
  if (addr.postalCode) parts.push(addr.postalCode);
  return parts.length > 0 ? parts.join(', ') : null;
}

function summarizeHours(loc: GBPLocation): string {
  if (!loc.regularHours?.periods?.length) return 'Hours not listed';
  const days = new Set(loc.regularHours.periods.map((p) => p.openDay));
  if (days.size === 7) return 'Open 7 days';
  return `Open ${days.size} day${days.size === 1 ? '' : 's'}`;
}

export default function GBPLocationCard({ location, index, onSelect }: Props) {
  const [isPending, startTransition] = useTransition();
  const address = formatAddress(location);

  return (
    <div className="rounded-xl border border-white/10 bg-surface-dark p-5">
      <h3 className="text-lg font-semibold text-white">{location.title}</h3>

      <div className="mt-2 space-y-1 text-sm text-slate-400">
        {address && <p>{address}</p>}
        {location.primaryPhone && <p>{location.primaryPhone}</p>}
        <p>{summarizeHours(location)}</p>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => onSelect(index))}
        className="mt-4 w-full rounded-lg bg-signal-green px-4 py-2.5 text-sm font-semibold text-midnight-slate transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? 'Importing...' : 'Select This Location'}
      </button>
    </div>
  );
}
