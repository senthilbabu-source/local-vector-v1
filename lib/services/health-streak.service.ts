// ---------------------------------------------------------------------------
// lib/services/health-streak.service.ts — S20 (AI_RULES §220)
//
// Pure function: computes consecutive "clean weeks" from visibility_scores
// snapshots. A "clean week" = accuracy_score >= 85.
// ---------------------------------------------------------------------------

export interface HealthStreak {
  currentStreak: number;
  longestStreak: number;
  isOnStreak: boolean;
}

export interface WeeklySnapshot {
  accuracy_score: number | null;
  snapshot_date: string;
}

const CLEAN_THRESHOLD = 85;

/**
 * Compute the health streak from an ordered array of weekly snapshots.
 * Snapshots must be ordered ascending by snapshot_date.
 */
export function computeHealthStreak(snapshots: WeeklySnapshot[]): HealthStreak {
  if (!snapshots || snapshots.length === 0) {
    return { currentStreak: 0, longestStreak: 0, isOnStreak: false };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (const snap of snapshots) {
    const score = snap.accuracy_score;
    if (score !== null && score >= CLEAN_THRESHOLD) {
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  currentStreak = runningStreak;

  return {
    currentStreak,
    longestStreak,
    isOnStreak: currentStreak >= 2,
  };
}
