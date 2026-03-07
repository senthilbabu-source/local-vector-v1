// ---------------------------------------------------------------------------
// lib/services/platform-coverage.ts — S57: Platform Coverage Heatmap
//
// Pure functions for building a query × platform coverage matrix.
// No I/O — callers pass pre-fetched SOV evaluation data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoverageStatus = 'cited' | 'not_cited' | 'no_data';

export interface CoverageCell {
  queryText: string;
  platform: string;
  status: CoverageStatus;
}

export interface CoverageMatrix {
  queries: string[];
  platforms: string[];
  cells: CoverageCell[];
  coveragePercent: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLATFORM_LABELS: Record<string, string> = {
  'openai-gpt4o': 'ChatGPT',
  'perplexity-sonar': 'Perplexity',
  'google-gemini': 'Gemini',
  'anthropic-claude': 'Claude',
  'microsoft-copilot': 'Copilot',
};

export const PLATFORM_ORDER = [
  'openai-gpt4o',
  'perplexity-sonar',
  'google-gemini',
  'anthropic-claude',
  'microsoft-copilot',
];

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Builds a coverage matrix from SOV evaluation rows.
 * Each row represents one query evaluated on one platform.
 */
export function buildCoverageMatrix(
  evaluations: Array<{
    query_text: string;
    model_provider: string;
    is_cited: boolean;
  }>,
): CoverageMatrix {
  // Collect unique queries and platforms
  const querySet = new Set<string>();
  const platformSet = new Set<string>();
  const lookup = new Map<string, boolean>();

  for (const ev of evaluations) {
    querySet.add(ev.query_text);
    platformSet.add(ev.model_provider);
    lookup.set(`${ev.query_text}::${ev.model_provider}`, ev.is_cited);
  }

  const queries = Array.from(querySet).sort();
  const platforms = PLATFORM_ORDER.filter((p) => platformSet.has(p));

  // Build cells
  const cells: CoverageCell[] = [];
  let citedCount = 0;
  let totalCount = 0;

  for (const query of queries) {
    for (const platform of platforms) {
      const key = `${query}::${platform}`;
      const hasCitation = lookup.get(key);
      const status: CoverageStatus =
        hasCitation === undefined ? 'no_data' : hasCitation ? 'cited' : 'not_cited';

      cells.push({ queryText: query, platform, status });

      if (hasCitation !== undefined) {
        totalCount++;
        if (hasCitation) citedCount++;
      }
    }
  }

  const coveragePercent = totalCount > 0 ? Math.round((citedCount / totalCount) * 100) : 0;

  return { queries, platforms, cells, coveragePercent };
}

/**
 * Gets the coverage status for a specific query+platform pair.
 */
export function getCoverageCell(
  matrix: CoverageMatrix,
  query: string,
  platform: string,
): CoverageStatus {
  const cell = matrix.cells.find(
    (c) => c.queryText === query && c.platform === platform,
  );
  return cell?.status ?? 'no_data';
}

/**
 * Returns the platform-specific coverage percentage.
 */
export function getPlatformCoverage(
  matrix: CoverageMatrix,
  platform: string,
): number {
  const platformCells = matrix.cells.filter(
    (c) => c.platform === platform && c.status !== 'no_data',
  );
  if (platformCells.length === 0) return 0;
  const cited = platformCells.filter((c) => c.status === 'cited').length;
  return Math.round((cited / platformCells.length) * 100);
}

/**
 * Returns a color for the coverage status (for heatmap cells).
 */
export function getCoverageColor(status: CoverageStatus): string {
  switch (status) {
    case 'cited':
      return '#10b981'; // emerald
    case 'not_cited':
      return '#ef4444'; // red
    case 'no_data':
      return '#1e293b'; // slate-800
  }
}
