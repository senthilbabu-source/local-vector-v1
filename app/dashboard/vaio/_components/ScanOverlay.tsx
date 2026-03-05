'use client';

// ---------------------------------------------------------------------------
// ScanOverlay — Full-screen progress overlay shown during "Run Voice Check"
//
// Sprint §210: Live Scan Experience
// Displays three sequential scan stages with spinner → checkmark transitions.
// ---------------------------------------------------------------------------

import { Loader2, Check } from 'lucide-react';

export const SCAN_STAGES = [
  'Checking AI crawler access…',
  'Reading your voice queries…',
  'Scoring your content…',
] as const;

interface ScanOverlayProps {
  /** Active stage index (0–2), or null to hide the overlay */
  scanPhase: number | null;
}

export function ScanOverlay({ scanPhase }: ScanOverlayProps) {
  if (scanPhase === null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      data-testid="scan-overlay"
      role="status"
      aria-label="Voice check in progress"
    >
      <div className="w-80 rounded-2xl border border-white/10 bg-surface-dark p-8 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-2.5">
          <Loader2 className="h-5 w-5 animate-spin text-electric-indigo" />
          <h2 className="text-sm font-semibold text-white">Running Voice Check</h2>
        </div>

        {/* Stage list */}
        <ol className="space-y-4" data-testid="scan-stage-list">
          {SCAN_STAGES.map((label, i) => {
            const isDone = i < scanPhase;
            const isCurrent = i === scanPhase;

            return (
              <li key={label} className="flex items-center gap-3">
                {/* Stage indicator icon */}
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                    isDone
                      ? 'bg-green-500/20'
                      : isCurrent
                        ? 'bg-electric-indigo/20'
                        : 'bg-white/5'
                  }`}
                  data-testid={
                    isDone ? 'stage-done' : isCurrent ? 'stage-current' : 'stage-pending'
                  }
                >
                  {isDone ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3 w-3 animate-spin text-electric-indigo" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  )}
                </span>

                {/* Stage label */}
                <span
                  className={`text-sm ${
                    isDone
                      ? 'text-slate-500 line-through decoration-slate-600'
                      : isCurrent
                        ? 'text-white'
                        : 'text-slate-600'
                  }`}
                  data-testid={`stage-label-${i}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
