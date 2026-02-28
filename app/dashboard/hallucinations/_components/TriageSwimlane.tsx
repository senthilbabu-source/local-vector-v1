// ---------------------------------------------------------------------------
// TriageSwimlane — Sprint H: One column of the hallucination triage board.
// ---------------------------------------------------------------------------

import type { HallucinationRow } from '@/lib/data/dashboard';
import AlertCard from './AlertCard';

interface TriageSwimlaneProps {
  title: string;
  count: number;
  alerts: HallucinationRow[];
  emptyMessage: string;
  'data-testid': string;
}

export default function TriageSwimlane({
  title,
  count,
  alerts,
  emptyMessage,
  'data-testid': testId,
}: TriageSwimlaneProps) {
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-white/10 p-4 text-center"
          data-testid={`${testId}-empty`}
        >
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
