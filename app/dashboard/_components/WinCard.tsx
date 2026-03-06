// ---------------------------------------------------------------------------
// WinCard — single win entry for the Wins Feed (S20, AI_RULES §220)
// ---------------------------------------------------------------------------

import { CheckCircle2 } from 'lucide-react';
import type { WinRow } from '@/lib/services/wins.service';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

export default function WinCard({ win }: { win: WinRow }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-signal-green/15 bg-signal-green/5 px-4 py-3"
      data-testid="win-card"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal-green" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">{win.title}</p>
          <span className="shrink-0 text-[10px] text-slate-500">{timeAgo(win.created_at)}</span>
        </div>
        {win.detail && (
          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{win.detail}</p>
        )}
        {win.revenue_impact && win.revenue_impact > 0 && (
          <p className="mt-1 text-[10px] font-semibold text-signal-green">
            +${Math.round(win.revenue_impact)}/mo recovered
          </p>
        )}
      </div>
    </div>
  );
}
