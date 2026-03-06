// ---------------------------------------------------------------------------
// lib/services/score-milestone.service.ts — S20 (AI_RULES §220)
//
// Pure functions: detect when AI Health Score crosses a milestone threshold,
// and format a celebration message.
// ---------------------------------------------------------------------------

export interface Milestone {
  threshold: number;
  label: string;
}

const MILESTONES: Milestone[] = [
  { threshold: 90, label: '90' },
  { threshold: 80, label: '80' },
  { threshold: 70, label: '70' },
  { threshold: 60, label: '60' },
  { threshold: 50, label: '50' },
];

/**
 * Detect if the score just crossed a milestone threshold upward.
 * Returns the highest milestone crossed, or null.
 */
export function detectScoreMilestone(
  current: number | null,
  previous: number | null,
): Milestone | null {
  if (current === null || previous === null) return null;
  if (current <= previous) return null;

  for (const milestone of MILESTONES) {
    if (current >= milestone.threshold && previous < milestone.threshold) {
      return milestone;
    }
  }

  return null;
}

/**
 * Format a celebration message for the milestone.
 */
export function formatMilestoneMessage(
  milestone: Milestone,
  city?: string | null,
): string {
  const cityPart = city
    ? ` You're in the top quarter of ${city} restaurants.`
    : '';
  return `Your restaurant's AI Health Score just crossed ${milestone.label}!${cityPart}`;
}
