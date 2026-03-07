// ---------------------------------------------------------------------------
// lib/services/goal-tracker.ts — S55: Dashboard Goal Tracker
//
// Pure functions for score goal progress computation.
// No I/O — callers pass pre-fetched data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreGoal {
  targetScore: number;
  deadline: string; // ISO date
}

export interface GoalProgress {
  currentScore: number;
  targetScore: number;
  percentComplete: number;
  daysRemaining: number;
  isAchieved: boolean;
  isOverdue: boolean;
  paceLabel: string;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Computes progress toward a score goal.
 */
export function computeGoalProgress(
  currentScore: number | null,
  goal: ScoreGoal,
  startScore = 0,
  now = new Date(),
): GoalProgress {
  const score = currentScore ?? 0;
  const target = goal.targetScore;
  const deadline = new Date(goal.deadline);
  const daysRemaining = Math.max(
    0,
    Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const totalRange = target - startScore;
  const progress = score - startScore;
  const percentComplete =
    totalRange <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((progress / totalRange) * 100)));

  const isAchieved = score >= target;
  const isOverdue = !isAchieved && daysRemaining === 0;

  const paceLabel = isAchieved
    ? 'Goal achieved!'
    : isOverdue
      ? 'Goal overdue'
      : daysRemaining <= 7
        ? `${daysRemaining} days left`
        : `${Math.ceil(daysRemaining / 7)} weeks left`;

  return {
    currentScore: score,
    targetScore: target,
    percentComplete,
    daysRemaining,
    isAchieved,
    isOverdue,
    paceLabel,
  };
}

/**
 * Validates a target score (must be 1–100).
 */
export function validateTargetScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 100) return null;
  return rounded;
}

/**
 * Validates a deadline date (must be in the future).
 */
export function validateDeadline(value: unknown, now = new Date()): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  if (date.getTime() <= now.getTime()) return null;
  return date.toISOString().slice(0, 10);
}

/**
 * Formats goal progress as a one-line summary.
 */
export function formatGoalSummary(progress: GoalProgress): string {
  if (progress.isAchieved) {
    return `You reached your goal of ${progress.targetScore}!`;
  }
  const pointsLeft = progress.targetScore - progress.currentScore;
  return `${pointsLeft} points to go — ${progress.paceLabel}`;
}
