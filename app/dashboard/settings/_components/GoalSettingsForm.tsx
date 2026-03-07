'use client';

import { useState, useTransition } from 'react';
import { Target, Trash2 } from 'lucide-react';
import { saveScoreGoal } from '../actions';
import type { ScoreGoal } from '@/lib/services/goal-tracker';

// ---------------------------------------------------------------------------
// S71: GoalSettingsForm — Set or clear AI health score goal
// ---------------------------------------------------------------------------

interface GoalSettingsFormProps {
  initialGoal: ScoreGoal | null;
}

export default function GoalSettingsForm({ initialGoal }: GoalSettingsFormProps) {
  const [targetScore, setTargetScore] = useState(initialGoal?.targetScore ?? 80);
  const [deadline, setDeadline] = useState(initialGoal?.deadline ?? getDefaultDeadline());
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGoal, setHasGoal] = useState(initialGoal !== null);

  function getDefaultDeadline(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveScoreGoal({ targetScore, deadline });
      if (result.success) {
        setSaved(true);
        setHasGoal(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  function handleClear() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveScoreGoal(null);
      if (result.success) {
        setHasGoal(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div data-testid="goal-settings-form">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-indigo-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-white">Score Goal</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Set a target AI health score and deadline to track your progress on the dashboard.
      </p>

      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="goal-target" className="block text-xs font-medium text-slate-400 mb-1">
            Target Score
          </label>
          <input
            id="goal-target"
            type="number"
            min={1}
            max={100}
            value={targetScore}
            onChange={(e) => setTargetScore(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="w-20 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="goal-deadline" className="block text-xs font-medium text-slate-400 mb-1">
            Deadline
          </label>
          <input
            id="goal-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : saved ? 'Saved' : 'Set Goal'}
        </button>

        {hasGoal && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:border-red-400/30 disabled:opacity-50 transition-colors"
            aria-label="Clear goal"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
