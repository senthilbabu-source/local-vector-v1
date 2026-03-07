// ---------------------------------------------------------------------------
// lib/services/kpi-sparkline.ts — S53: Trend Sparklines for KPI Chips
//
// Pure functions to derive mini sparkline data from visibility_scores snapshots.
// No I/O — callers pass pre-fetched data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SparklinePoint {
  date: string;
  value: number;
}

export interface KPISparklineData {
  accuracy: SparklinePoint[];
  visibility: SparklinePoint[];
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Builds sparkline data from visibility_scores snapshots.
 * Returns last `days` points for accuracy and visibility trends.
 */
export function buildSparklineData(
  snapshots: Array<{
    snapshot_date: string;
    accuracy_score: number | null;
    visibility_score: number | null;
  }>,
  days = 7,
): KPISparklineData {
  // Sort ascending by date
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  );

  const recent = sorted.slice(-days);

  return {
    accuracy: recent
      .filter((s) => s.accuracy_score !== null)
      .map((s) => ({ date: s.snapshot_date, value: s.accuracy_score! })),
    visibility: recent
      .filter((s) => s.visibility_score !== null)
      .map((s) => ({ date: s.snapshot_date, value: s.visibility_score! })),
  };
}

/**
 * Computes the trend direction from sparkline points.
 * Returns 'up' if last > first, 'down' if last < first, 'flat' otherwise.
 */
export function computeSparklineTrend(
  points: SparklinePoint[],
): 'up' | 'down' | 'flat' {
  if (points.length < 2) return 'flat';
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (last > first) return 'up';
  if (last < first) return 'down';
  return 'flat';
}

/**
 * Normalizes sparkline values to 0–1 range for SVG rendering.
 */
export function normalizeSparkline(points: SparklinePoint[]): number[] {
  if (points.length === 0) return [];
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}
