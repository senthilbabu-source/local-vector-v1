/**
 * LastScanPanel — "when did we last check? when's the next check?"
 *
 * Answers the silent user anxiety: "is this thing actually running?"
 *
 * Sprint G — Human-Readable Dashboard.
 */

import { Clock, AlertTriangle } from 'lucide-react';
import { formatRelativeTime, nextSundayLabel } from '../scan-health-utils';

interface LastScanPanelProps {
  lastScanAt: string | null;
}

export default function LastScanPanel({ lastScanAt }: LastScanPanelProps) {
  const now = Date.now();
  const scanDate = lastScanAt ? new Date(lastScanAt) : null;
  const daysSinceScan = scanDate
    ? Math.floor((now - scanDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysSinceScan !== null && daysSinceScan > 14;

  // Compute next scan: lastScanAt + 7 days, or next Sunday for new users
  let nextScanText: string;
  if (scanDate) {
    const nextScan = new Date(scanDate);
    nextScan.setDate(nextScan.getDate() + 7);
    const daysUntilNext = Math.max(
      0,
      Math.ceil((nextScan.getTime() - now) / (1000 * 60 * 60 * 24)),
    );
    nextScanText =
      daysUntilNext === 0
        ? 'Next scan: today'
        : daysUntilNext === 1
          ? 'Next scan: tomorrow'
          : `Next scan in ${daysUntilNext} days`;
  } else {
    nextScanText = `First scan runs Sunday, ${nextSundayLabel()}`;
  }

  return (
    <div
      className="rounded-xl border border-white/5 bg-surface-dark p-5"
      data-testid="last-scan-panel"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Scan Status
        </h3>
        {isStale && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-alert-amber/10 px-2 py-0.5 text-[10px] font-medium text-alert-amber"
            data-testid="last-scan-warning"
          >
            <AlertTriangle className="h-3 w-3" />
            Overdue
          </span>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-electric-indigo/10">
          <Clock className="h-4 w-4 text-electric-indigo" />
        </div>
        <div>
          <p
            className="text-sm font-medium text-white"
            data-testid="last-scan-time"
          >
            {lastScanAt
              ? `Last scan: ${formatRelativeTime(lastScanAt)}`
              : 'No scans yet'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500" data-testid="next-scan-time">
            {nextScanText}
          </p>
        </div>
      </div>
    </div>
  );
}
