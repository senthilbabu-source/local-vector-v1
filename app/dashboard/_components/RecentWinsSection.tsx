// ---------------------------------------------------------------------------
// RecentWinsSection — dashboard section showing last 5 wins (S20, AI_RULES §220)
// ---------------------------------------------------------------------------

import Link from 'next/link';
import type { WinRow } from '@/lib/services/wins.service';
import WinCard from './WinCard';

interface RecentWinsSectionProps {
  wins: WinRow[];
}

export default function RecentWinsSection({ wins }: RecentWinsSectionProps) {
  if (wins.length === 0) return null;

  return (
    <div data-testid="recent-wins-section">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Recent Wins</h2>
        <Link
          href="/dashboard/wins"
          className="text-xs text-slate-400 hover:text-white transition"
        >
          See all →
        </Link>
      </div>
      <div className="space-y-2">
        {wins.map((win) => (
          <WinCard key={win.id} win={win} />
        ))}
      </div>
    </div>
  );
}
