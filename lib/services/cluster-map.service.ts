// ---------------------------------------------------------------------------
// lib/services/cluster-map.service.ts — AI Visibility Cluster Map
//
// Sprint 87: Pure functions that transform existing engine data into scatter
// plot coordinates. No new tables, no AI calls, no side effects.
//
// X-Axis: Brand Authority (citation frequency, 0-100)
// Y-Axis: Fact Accuracy (truth score, 0-100)
// Bubble: Share of Voice (0-1)
// Overlay: Hallucination fog zones from Fear Engine
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

export type EngineFilter = 'all' | 'perplexity' | 'openai' | 'google' | 'copilot';

export interface ClusterMapInput {
  /** Your business name (for matching in sov_evaluations) */
  businessName: string;

  /** SOV evaluations — raw per-query, per-engine results */
  evaluations: Array<{
    engine: string;
    queryId: string;
    queryCategory: string;
    rankPosition: number | null;
    mentionedCompetitors: string[];
  }>;

  /** Open hallucinations from Fear Engine */
  hallucinations: Array<{
    id: string;
    claimText: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    modelProvider: string;
    category: string | null;
  }>;

  /** Latest truth score (from truth-audit.service.ts) */
  truthScore: number | null;

  /** Latest SOV (from visibility_analytics) */
  sovScore: number | null;

  /** Engine filter */
  engineFilter: EngineFilter;
}

export interface ClusterMapPoint {
  id: string;
  name: string;
  brandAuthority: number;
  factAccuracy: number;
  sov: number;
  type: 'self' | 'competitor';
  citationCount: number;
  totalQueries: number;
}

export interface HallucinationZone {
  id: string;
  cx: number;
  cy: number;
  radius: number;
  claimText: string;
  engine: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ClusterMapResult {
  points: ClusterMapPoint[];
  hallucinationZones: HallucinationZone[];
  selfPoint: ClusterMapPoint | null;
  availableEngines: EngineFilter[];
  activeFilter: EngineFilter;
  stats: {
    totalCompetitors: number;
    totalQueries: number;
    hallucinationCount: number;
    dominantEngine: string | null;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * Normalize engine strings from sov_evaluations and ai_hallucinations
 * to EngineFilter values.
 */
export const ENGINE_MAP: Record<string, EngineFilter> = {
  perplexity: 'perplexity',
  openai: 'openai',
  google: 'google',
  'microsoft-copilot': 'copilot',
  // model_provider enum values
  'openai-gpt4o': 'openai',
  'openai-gpt4o-mini': 'openai',
  'perplexity-sonar': 'perplexity',
  'google-gemini': 'google',
  'anthropic-claude': 'copilot',
};

export const SEVERITY_PENALTY: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
};

export const SEVERITY_RADIUS: Record<string, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 12,
};

// ── Pure Functions ────────────────────────────────────────────────────────

/**
 * Build the cluster map from pre-fetched data.
 * Pure function — no I/O.
 */
export function buildClusterMap(input: ClusterMapInput): ClusterMapResult {
  const { engineFilter } = input;

  // 1. Filter evaluations by engine
  const filteredEvals = filterByEngine(input.evaluations, engineFilter);

  // 2. Calculate self brand authority
  const { authority, citedCount, totalQueries } = calculateBrandAuthority(
    input.businessName,
    filteredEvals,
  );

  // 3. Self fact accuracy
  const factAccuracy = input.truthScore ?? 50;

  // 4. Self SOV
  const sov = input.sovScore ?? 0;

  // 5. Build self point
  const selfPoint: ClusterMapPoint = {
    id: 'self',
    name: input.businessName,
    brandAuthority: clamp(authority, 0, 100),
    factAccuracy: clamp(factAccuracy, 0, 100),
    sov: clamp(sov, 0, 1),
    type: 'self',
    citationCount: citedCount,
    totalQueries,
  };

  // 6. Extract competitor points
  const competitorPoints = extractCompetitorPoints(filteredEvals, engineFilter);

  // 7. Build hallucination zones
  const hallucinationZones = buildHallucinationZones(
    input.hallucinations,
    selfPoint,
    engineFilter,
  );

  // 8. Detect available engines
  const availableEngines = detectAvailableEngines(input.evaluations);

  // 9. Compute dominant engine
  const engineCounts = new Map<string, number>();
  for (const e of filteredEvals) {
    const mapped = ENGINE_MAP[e.engine] ?? e.engine;
    engineCounts.set(mapped, (engineCounts.get(mapped) ?? 0) + 1);
  }
  let dominantEngine: string | null = null;
  let maxCount = 0;
  for (const [engine, count] of engineCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantEngine = engine;
    }
  }

  // 10. Build result
  const points = [selfPoint, ...competitorPoints];

  return {
    points,
    hallucinationZones,
    selfPoint,
    availableEngines,
    activeFilter: engineFilter,
    stats: {
      totalCompetitors: competitorPoints.length,
      totalQueries,
      hallucinationCount: hallucinationZones.length,
      dominantEngine,
    },
  };
}

/**
 * Calculate Brand Authority (0-100) for a business.
 * = (evaluations where cited / total evaluations) x 100
 */
export function calculateBrandAuthority(
  _businessName: string,
  evaluations: ClusterMapInput['evaluations'],
): { authority: number; citedCount: number; totalQueries: number } {
  if (evaluations.length === 0) {
    return { authority: 0, citedCount: 0, totalQueries: 0 };
  }

  const totalQueries = evaluations.length;
  const citedCount = evaluations.filter((e) => e.rankPosition !== null).length;
  const authority = Math.round((citedCount / totalQueries) * 100);

  return { authority: clamp(authority, 0, 100), citedCount, totalQueries };
}

/**
 * Extract unique competitors from evaluations and compute their
 * brand authority scores.
 */
export function extractCompetitorPoints(
  evaluations: ClusterMapInput['evaluations'],
  _engineFilter: EngineFilter,
): ClusterMapPoint[] {
  if (evaluations.length === 0) return [];

  const totalEvals = evaluations.length;
  const competitorMentions = new Map<string, number>();

  for (const e of evaluations) {
    for (const name of e.mentionedCompetitors) {
      competitorMentions.set(name, (competitorMentions.get(name) ?? 0) + 1);
    }
  }

  const points: ClusterMapPoint[] = [];
  for (const [name, count] of competitorMentions) {
    const authority = Math.round((count / totalEvals) * 100);
    points.push({
      id: `competitor-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      brandAuthority: clamp(authority, 0, 100),
      factAccuracy: 80, // assumed — no hallucination data for competitors
      sov: count / totalEvals,
      type: 'competitor',
      citationCount: count,
      totalQueries: totalEvals,
    });
  }

  // Sort by authority descending for stable output
  points.sort((a, b) => b.brandAuthority - a.brandAuthority || a.name.localeCompare(b.name));

  return points;
}

/**
 * Build hallucination fog zones from open hallucinations.
 * Each zone is centered on the business's scatter position.
 */
export function buildHallucinationZones(
  hallucinations: ClusterMapInput['hallucinations'],
  selfPoint: ClusterMapPoint,
  engineFilter: EngineFilter,
): HallucinationZone[] {
  const zones: HallucinationZone[] = [];

  for (const h of hallucinations) {
    const mappedEngine = ENGINE_MAP[h.modelProvider] ?? h.modelProvider;

    // Filter by engine if not 'all'
    if (engineFilter !== 'all' && mappedEngine !== engineFilter) continue;

    const penalty = SEVERITY_PENALTY[h.severity] ?? 3;
    const radius = SEVERITY_RADIUS[h.severity] ?? 12;

    zones.push({
      id: h.id,
      cx: selfPoint.brandAuthority,
      cy: clamp(selfPoint.factAccuracy - penalty, 0, 100),
      radius,
      claimText: h.claimText,
      engine: mappedEngine,
      severity: h.severity,
    });
  }

  return zones;
}

/**
 * Filter items by engine. 'all' returns everything.
 */
export function filterByEngine<T extends { engine: string }>(
  items: T[],
  filter: EngineFilter,
): T[] {
  if (filter === 'all') return items;
  return items.filter((item) => {
    const mapped = ENGINE_MAP[item.engine] ?? item.engine;
    return mapped === filter;
  });
}

/**
 * Detect which engines have data.
 */
export function detectAvailableEngines(
  evaluations: ClusterMapInput['evaluations'],
): EngineFilter[] {
  const engines = new Set<EngineFilter>();
  engines.add('all');

  for (const e of evaluations) {
    const mapped = ENGINE_MAP[e.engine];
    if (mapped && mapped !== 'all') {
      engines.add(mapped);
    }
  }

  return Array.from(engines);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
