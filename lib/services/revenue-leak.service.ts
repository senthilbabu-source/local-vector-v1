// ---------------------------------------------------------------------------
// lib/services/revenue-leak.service.ts — Revenue Leak Calculation Service
//
// Pure functions with zero side effects (AI_RULES §6: business logic in
// lib/services/ never creates its own Supabase client).
//
// The model has 3 cost components that sum to the total leak:
//   1. Hallucination Cost — Active inaccuracies drive customers away
//   2. SOV Gap Cost       — Missing from AI recommendations
//   3. Competitor Steal   — Competitors mentioned instead of you
// ---------------------------------------------------------------------------

export interface RevenueConfig {
  avg_ticket: number;
  monthly_searches: number;
  local_conversion_rate: number;
  walk_away_rate: number;
}

export interface HallucinationInput {
  severity: 'critical' | 'high' | 'medium' | 'low';
  correction_status: string;
}

export interface CompetitorInput {
  winner: string | null;
  business_name: string;
}

export interface LeakBreakdown {
  hallucination_cost: { low: number; high: number };
  sov_gap_cost: { low: number; high: number };
  competitor_steal_cost: { low: number; high: number };
}

export interface RevenueLeak {
  leak_low: number;
  leak_high: number;
  breakdown: LeakBreakdown;
}

export const DEFAULT_CONFIG: RevenueConfig = {
  avg_ticket: 45.0,
  monthly_searches: 2000,
  local_conversion_rate: 0.03,
  walk_away_rate: 0.65,
};

const round2 = (x: number): number => Math.round(x * 100) / 100;

// Severity multipliers: how many "avg_ticket equivalents" each severity
// costs per day in lost customer visits.
const SEVERITY_MULTIPLIERS: Record<string, number> = {
  critical: 2.0,
  high: 1.0,
  medium: 0.3,
  low: 0.1,
};

/**
 * Calculates the monthly cost of active hallucinations.
 *
 * For each open hallucination:
 *   daily_cost = avg_ticket × severity_multiplier × walk_away_rate
 *   monthly_cost = daily_cost × 30
 *
 * Range: low = sum × 0.6, high = sum × 1.0
 */
export function calculateHallucinationCost(
  hallucinations: HallucinationInput[],
  config: RevenueConfig,
): { low: number; high: number } {
  // Only count open hallucinations
  const openHallucinations = hallucinations.filter(
    (h) => h.correction_status === 'open',
  );

  if (openHallucinations.length === 0) {
    return { low: 0, high: 0 };
  }

  let totalMonthlyCost = 0;

  for (const h of openHallucinations) {
    const multiplier = SEVERITY_MULTIPLIERS[h.severity] ?? 0.1;
    const dailyCost = config.avg_ticket * multiplier * config.walk_away_rate;
    totalMonthlyCost += dailyCost * 30;
  }

  return {
    low: round2(totalMonthlyCost * 0.6),
    high: round2(totalMonthlyCost),
  };
}

/**
 * Calculates the cost of not appearing in AI recommendations.
 *
 * ideal_sov = 0.25 (top-4 position in a typical market)
 * sov_gap = max(0, ideal_sov - actual_sov)
 * missed_customers = monthly_searches × sov_gap × local_conversion_rate
 * cost = missed_customers × avg_ticket
 *
 * Range: low = cost × 0.7, high = cost × 1.2
 */
export function calculateSOVGapCost(
  actualSOV: number,
  config: RevenueConfig,
): { low: number; high: number } {
  const IDEAL_SOV = 0.25;
  const sovGap = Math.max(0, IDEAL_SOV - actualSOV);

  if (sovGap === 0) {
    return { low: 0, high: 0 };
  }

  const missedCustomers =
    config.monthly_searches * sovGap * config.local_conversion_rate;
  const cost = missedCustomers * config.avg_ticket;

  return {
    low: round2(cost * 0.7),
    high: round2(cost * 1.2),
  };
}

/**
 * Calculates the cost of competitors being mentioned instead of you.
 *
 * For each competitor intercept where you lost:
 *   steal_per_intercept = avg_ticket × local_conversion_rate
 *                         × monthly_searches / queries_count × 0.1
 *
 * Range: low = sum × 0.5, high = sum × 1.0
 */
export function calculateCompetitorStealCost(
  intercepts: CompetitorInput[],
  totalQueries: number,
  config: RevenueConfig,
): { low: number; high: number } {
  if (intercepts.length === 0 || totalQueries === 0) {
    return { low: 0, high: 0 };
  }

  // Count intercepts where business lost (winner is NOT the business)
  const losses = intercepts.filter(
    (i) => i.winner !== null && i.winner !== i.business_name,
  );

  if (losses.length === 0) {
    return { low: 0, high: 0 };
  }

  let totalSteal = 0;

  for (const _loss of losses) {
    const stealPerIntercept =
      config.avg_ticket *
      config.local_conversion_rate *
      (config.monthly_searches / totalQueries) *
      0.1;
    totalSteal += stealPerIntercept;
  }

  return {
    low: round2(totalSteal * 0.5),
    high: round2(totalSteal),
  };
}

/**
 * Calculates the total revenue leak by summing all three components.
 */
export function calculateRevenueLeak(
  hallucinations: HallucinationInput[],
  actualSOV: number,
  intercepts: CompetitorInput[],
  totalQueries: number,
  config: RevenueConfig,
): RevenueLeak {
  const hallucinationCost = calculateHallucinationCost(hallucinations, config);
  const sovGapCost = calculateSOVGapCost(actualSOV, config);
  const competitorStealCost = calculateCompetitorStealCost(
    intercepts,
    totalQueries,
    config,
  );

  return {
    leak_low: round2(
      hallucinationCost.low + sovGapCost.low + competitorStealCost.low,
    ),
    leak_high: round2(
      hallucinationCost.high + sovGapCost.high + competitorStealCost.high,
    ),
    breakdown: {
      hallucination_cost: hallucinationCost,
      sov_gap_cost: sovGapCost,
      competitor_steal_cost: competitorStealCost,
    },
  };
}

// ---------------------------------------------------------------------------
// snapshotRevenueLeak — Persist daily revenue leak snapshot (Sprint 59B)
// ---------------------------------------------------------------------------

/**
 * Fetches current hallucination, SOV, and competitor data for an org/location,
 * runs calculateRevenueLeak(), and upserts the result into revenue_snapshots.
 *
 * Called by the daily audit cron. Idempotent per (org_id, location_id, date)
 * via the UNIQUE constraint on revenue_snapshots.
 *
 * NOTE: This is the only non-pure function in this module — it performs DB
 * reads and writes. The supabase client is injected (AI_RULES §6).
 */
export async function snapshotRevenueLeak(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  locationId: string,
): Promise<void> {
  // ── 1. Fetch inputs in parallel ────────────────────────────────────────
  const [halResult, visResult, interceptResult, configResult] = await Promise.all([
    // Open hallucinations for this org/location
    supabase
      .from('ai_hallucinations')
      .select('severity, correction_status')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .eq('correction_status', 'open'),

    // Latest visibility_analytics SOV
    supabase
      .from('visibility_analytics')
      .select('share_of_voice')
      .eq('org_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Latest competitor intercepts
    supabase
      .from('competitor_intercepts')
      .select('competitor_name')
      .eq('org_id', orgId),

    // Revenue config (or null → use defaults)
    supabase
      .from('revenue_config')
      .select('avg_ticket, monthly_searches, local_conversion_rate, walk_away_rate')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  const hallucinations: HallucinationInput[] = (halResult.data ?? []).map(
    (h: { severity: string; correction_status: string }) => ({
      severity: h.severity as HallucinationInput['severity'],
      correction_status: h.correction_status,
    }),
  );

  const actualSOV: number = visResult.data?.share_of_voice ?? 0;

  const interceptRows = interceptResult.data ?? [];
  const competitorInputs: CompetitorInput[] = interceptRows.map(
    (r: { competitor_name: string }) => ({
      winner: r.competitor_name,
      business_name: '',
    }),
  );

  const config: RevenueConfig = configResult.data ?? DEFAULT_CONFIG;

  // ── 2. Calculate ───────────────────────────────────────────────────────
  const leak = calculateRevenueLeak(
    hallucinations,
    actualSOV,
    competitorInputs,
    interceptRows.length || 1,
    config,
  );

  // ── 3. Upsert snapshot ─────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { error } = await supabase
    .from('revenue_snapshots')
    .upsert(
      {
        org_id: orgId,
        location_id: locationId,
        leak_low: leak.leak_low,
        leak_high: leak.leak_high,
        breakdown: leak.breakdown,
        inputs_snapshot: {
          hallucination_count: hallucinations.length,
          actual_sov: actualSOV,
          intercept_count: interceptRows.length,
          config,
        },
        snapshot_date: today,
      },
      { onConflict: 'org_id,location_id,snapshot_date' },
    );

  if (error) {
    console.error(`[revenue-leak] Snapshot upsert failed for org ${orgId}:`, error.message);
    throw new Error(`Revenue snapshot upsert failed: ${error.message}`);
  }

  console.log(`[revenue-leak] Snapshot saved for org ${orgId}, location ${locationId}, date ${today}`);
}
