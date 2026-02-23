// ---------------------------------------------------------------------------
// sparkline.ts — SVG polyline point generator for mini KPI sparklines (Sprint 33)
//
// Generates a string of "x,y x,y ..." points for use in an SVG <polyline>.
// No React import — pure TS so this module is unit-testable without jsdom.
// ---------------------------------------------------------------------------

/**
 * Build an SVG polyline `points` attribute string.
 *
 * @param trend  'down' = trending bad (for fail), 'flat' = no data (not_found),
 *               'up'   = trending good (for pass)
 * @param width  Total width in px (e.g. 64)
 * @param height Total height in px (e.g. 24)
 * @returns      Space-separated "x,y" coordinate pairs
 */
export function buildSparklinePath(
  trend: 'down' | 'flat' | 'up',
  width: number,
  height: number,
): string {
  const points = 7; // number of data points
  const step   = width / (points - 1);

  // Pre-defined relative Y offsets (0 = top, 1 = bottom of height)
  // Each array is normalised 0–1; will be scaled to the actual height.
  const profiles: Record<typeof trend, number[]> = {
    up:   [0.85, 0.80, 0.70, 0.60, 0.45, 0.30, 0.15],  // steadily rising
    flat: [0.55, 0.52, 0.58, 0.54, 0.56, 0.53, 0.55],  // horizontal with noise
    down: [0.15, 0.25, 0.38, 0.50, 0.62, 0.75, 0.88],  // steadily falling
  };

  return profiles[trend]
    .map((yRatio, i) => {
      const x = Math.round(i * step);
      const y = Math.round(yRatio * height);
      return `${x},${y}`;
    })
    .join(' ');
}
