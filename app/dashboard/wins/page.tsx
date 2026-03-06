// ---------------------------------------------------------------------------
// /dashboard/wins — Full Wins Feed (S20, AI_RULES §220)
//
// Lists all recorded wins for the org. Wins are created automatically
// when AI mistakes are corrected.
// ---------------------------------------------------------------------------

import { redirect } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { getSafeAuthContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getRecentWins } from '@/lib/services/wins.service';
import WinCard from '@/app/dashboard/_components/WinCard';

export const metadata = { title: 'Your Wins | LocalVector.ai' };

export default async function WinsPage() {
  const ctx = await getSafeAuthContext();
  if (!ctx?.orgId) redirect('/login');

  const supabase = await createClient();
  const wins = await getRecentWins(supabase, ctx.orgId, 50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Your Wins</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Every AI mistake you fixed is a win — and a step toward being recommended first.
        </p>
      </div>

      {wins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-surface-dark px-6 py-16 text-center">
          <Trophy className="h-10 w-10 text-slate-500 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-300">No wins yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Fix your first AI mistake on the{' '}
            <a href="/dashboard/hallucinations" className="text-white underline">
              AI Mistakes
            </a>{' '}
            page to start your streak.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {wins.map((win) => (
            <WinCard key={win.id} win={win} />
          ))}
        </div>
      )}
    </div>
  );
}
