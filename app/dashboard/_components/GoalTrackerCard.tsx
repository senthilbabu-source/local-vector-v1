'use client';

import { useState } from 'react';
import { Target, Check } from 'lucide-react';
import {
  computeGoalProgress,
  formatGoalSummary,
  type ScoreGoal,
} from '@/lib/services/goal-tracker';

// ---------------------------------------------------------------------------
// S55: GoalTrackerCard — Shows progress toward user's score goal
// ---------------------------------------------------------------------------

interface GoalTrackerCardProps {
  currentScore: number | null;
  goal: ScoreGoal | null;
  sampleMode?: boolean;
}

export default function GoalTrackerCard({
  currentScore,
  goal,
  sampleMode = false,
}: GoalTrackerCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (sampleMode || !goal || dismissed) return null;

  const progress = computeGoalProgress(currentScore, goal);
  const summary = formatGoalSummary(progress);

  const barColor = progress.isAchieved
    ? 'bg-emerald-500'
    : progress.isOverdue
      ? 'bg-red-500'
      : 'bg-indigo-500';

  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-900/50 p-4"
      data-testid="goal-tracker"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {progress.isAchieved ? (
            <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <Target className="h-4 w-4 text-indigo-400" aria-hidden="true" />
          )}
          <p className="text-sm font-semibold text-white">
            Goal: Reach {progress.targetScore}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Dismiss goal tracker"
        >
          Hide
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{progress.currentScore} / {progress.targetScore}</span>
        <span>{summary}</span>
      </div>
    </div>
  );
}
