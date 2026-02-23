'use client';

import { useTransition, useState } from 'react';
import { X } from 'lucide-react';
import { deleteCompetitor } from '@/app/dashboard/compete/actions';

interface CompetitorChipProps {
  competitor: {
    id:                 string;
    competitor_name:    string;
    competitor_address: string | null;
  };
}

export default function CompetitorChip({ competitor }: CompetitorChipProps) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming]  = useState(false);

  function handleDeleteClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      await deleteCompetitor(competitor.id);
      setConfirming(false);
    });
  }

  return (
    <div
      data-testid="competitor-chip"
      className="flex items-center gap-2 rounded-full border border-white/10 bg-midnight-slate px-3 py-1.5"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{competitor.competitor_name}</p>
        {competitor.competitor_address && (
          <p className="text-xs text-slate-500 truncate">{competitor.competitor_address}</p>
        )}
      </div>

      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-red-400">Delete?</span>
          <button
            onClick={handleDeleteClick}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-300 font-semibold disabled:opacity-50"
          >
            {isPending ? '…' : 'Yes'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={handleDeleteClick}
          aria-label={`Remove ${competitor.competitor_name}`}
          className="shrink-0 text-slate-600 hover:text-slate-300 transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
