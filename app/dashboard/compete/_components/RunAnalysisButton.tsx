'use client';

import { useTransition, useState } from 'react';
import { Swords } from 'lucide-react';
import { runCompetitorIntercept } from '@/app/dashboard/compete/actions';

interface RunAnalysisButtonProps {
  competitorId:   string;
  competitorName: string;
}

export default function RunAnalysisButton({ competitorId, competitorName }: RunAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]            = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await runCompetitorIntercept(competitorId);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        data-testid="run-analysis-btn"
        className="flex items-center gap-2 rounded-lg border border-signal-green/40 px-3 py-1.5 text-xs font-medium text-signal-green hover:bg-signal-green/10 disabled:opacity-50 transition"
      >
        <Swords className="h-3.5 w-3.5" />
        {isPending ? 'Analyzing…' : `Run Analysis vs ${competitorName}`}
      </button>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
