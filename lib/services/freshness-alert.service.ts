// ---------------------------------------------------------------------------
// lib/services/freshness-alert.service.ts — Content Freshness Decay (Sprint 76)
//
// Pure service — NO I/O. Detects citation rate declines by comparing
// consecutive visibility_analytics snapshots. A >20% relative drop triggers
// a warning; >40% is critical.
//
// Pattern follows lib/services/ai-health-score.service.ts (Sprint 72).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VisibilitySnapshot {
  snapshot_date: string;
  citation_rate: number | null;
  share_of_voice: number | null;
}

export interface FreshnessAlert {
  dropPercentage: number;
  previousRate: number;
  currentRate: number;
  previousDate: string;
  currentDate: string;
  severity: 'warning' | 'critical';
}

export interface FreshnessStatus {
  alerts: FreshnessAlert[];
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  currentCitationRate: number | null;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Detect freshness decay across consecutive visibility_analytics snapshots.
 * Expects snapshots sorted by snapshot_date ascending (oldest first).
 *
 * A relative drop >20% between consecutive pairs triggers a warning alert.
 * A relative drop >40% triggers a critical alert.
 * Null citation_rate values are skipped (not compared against).
 *
 * Returns a FreshnessStatus with alerts, overall trend, and current rate.
 */
export function detectFreshnessDecay(snapshots: VisibilitySnapshot[]): FreshnessStatus {
  // Filter out snapshots with null citation_rate
  const valid = snapshots.filter(
    (s): s is VisibilitySnapshot & { citation_rate: number } => s.citation_rate != null,
  );

  if (valid.length < 2) {
    return {
      alerts: [],
      trend: 'insufficient_data',
      currentCitationRate: valid.length > 0 ? valid[valid.length - 1].citation_rate : null,
    };
  }

  const alerts: FreshnessAlert[] = [];

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const curr = valid[i];

    // Skip if previous rate is zero (can't compute relative drop)
    if (prev.citation_rate === 0) continue;

    const dropFraction = (prev.citation_rate - curr.citation_rate) / prev.citation_rate;
    const dropPercentage = Math.round(dropFraction * 1000) / 10; // 1 decimal place

    if (dropPercentage > 20) {
      alerts.push({
        dropPercentage,
        previousRate: prev.citation_rate,
        currentRate: curr.citation_rate,
        previousDate: prev.snapshot_date,
        currentDate: curr.snapshot_date,
        severity: dropPercentage > 40 ? 'critical' : 'warning',
      });
    }
  }

  // Determine trend from last 2 valid snapshots
  const lastTwo = valid.slice(-2);
  let trend: FreshnessStatus['trend'];
  if (lastTwo.length < 2) {
    trend = 'insufficient_data';
  } else {
    const delta = lastTwo[1].citation_rate - lastTwo[0].citation_rate;
    const threshold = lastTwo[0].citation_rate * 0.05; // 5% tolerance for "stable"
    if (delta > threshold) {
      trend = 'improving';
    } else if (delta < -threshold) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
  }

  return {
    alerts,
    trend,
    currentCitationRate: valid[valid.length - 1].citation_rate,
  };
}

/**
 * Format a FreshnessAlert into a human-readable message.
 */
export function formatFreshnessMessage(alert: FreshnessAlert): string {
  const prevPct = Math.round(alert.previousRate * 100);
  const currPct = Math.round(alert.currentRate * 100);
  const prevDate = formatShortDate(alert.previousDate);
  const currDate = formatShortDate(alert.currentDate);
  return `Citation rate dropped ${alert.dropPercentage}% (from ${prevPct}% to ${currPct}%) between ${prevDate} and ${currDate}.`;
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
