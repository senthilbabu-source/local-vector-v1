'use client';

// ---------------------------------------------------------------------------
// LocationPicker — Client wrapper for GBP location selection (Sprint 89)
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GBPLocation } from '@/lib/types/gbp';
import GBPLocationCard from '../_components/GBPLocationCard';
import { importGBPLocation } from '../actions';

interface Props {
  locations: GBPLocation[];
}

export default function LocationPicker({ locations }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(index: number) {
    setError(null);
    const result = await importGBPLocation(index);
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-alert-amber/30 bg-alert-amber/10 px-4 py-3 text-sm text-alert-amber">
          {error}
        </div>
      )}

      {locations.map((loc, i) => (
        <GBPLocationCard
          key={loc.name}
          location={loc}
          index={i}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
