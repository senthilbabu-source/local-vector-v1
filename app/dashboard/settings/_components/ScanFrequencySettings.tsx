'use client';

// ---------------------------------------------------------------------------
// ScanFrequencySettings — Sprint 121: Scan frequency radio selector
// Auto-saves on selection (no separate save button).
// ---------------------------------------------------------------------------

import { useState, useTransition } from 'react';
import type { ScanFrequency } from '@/lib/settings/types';
import { SCAN_FREQUENCY_DAYS } from '@/lib/settings/types';

interface ScanFrequencySettingsProps {
  currentFrequency: ScanFrequency;
}

const LABELS: Record<ScanFrequency, string> = {
  'weekly': 'Weekly',
  'bi-weekly': 'Bi-weekly',
  'monthly': 'Monthly',
};

export default function ScanFrequencySettings({ currentFrequency }: ScanFrequencySettingsProps) {
  const [frequency, setFrequency] = useState<ScanFrequency>(currentFrequency);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: ScanFrequency) {
    setFrequency(value);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scan_frequency: value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? 'Save failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setFrequency(currentFrequency); // revert
      }
    });
  }

  const days = SCAN_FREQUENCY_DAYS[frequency];
  const nextScan = new Date(Date.now() + days * 86_400_000);

  return (
    <div className="space-y-3" data-testid="scan-frequency-select">
      <h3 className="text-sm font-semibold text-white">How Often We Check AI for You</h3>
      <p className="text-xs text-slate-400">
        Choose how often we check what AI apps say about your business.
      </p>

      <div className="flex gap-3">
        {(['weekly', 'bi-weekly', 'monthly'] as ScanFrequency[]).map((opt) => (
          <label
            key={opt}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition-colors ${
              frequency === opt
                ? 'border-primary bg-primary/10 text-white'
                : 'border-white/10 text-slate-400 hover:border-white/20'
            }`}
            data-testid={`scan-frequency-${opt}`}
          >
            <input
              type="radio"
              name="scan_frequency"
              value={opt}
              checked={frequency === opt}
              onChange={() => handleChange(opt)}
              className="sr-only"
            />
            {LABELS[opt]}
          </label>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        {isPending
          ? 'Saving...'
          : `Estimated next scan: ${nextScan.toLocaleDateString()}`}
      </p>

      {error && <p className="text-xs text-alert-crimson">{error}</p>}
    </div>
  );
}
