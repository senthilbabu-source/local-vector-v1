// ---------------------------------------------------------------------------
// lib/plan-feature-matrix.ts — Sprint M (M3)
//
// Feature matrix derived from lib/plan-enforcer.ts gating functions.
// Every row's availability is computed by calling the actual gating functions
// rather than hardcoding boolean values. If plan-enforcer.ts changes,
// this matrix updates automatically.
//
// Plans: trial | starter | growth | agency
// Display names: The Audit | Starter | AI Shield | Brand Fortress
// ---------------------------------------------------------------------------

import {
  type PlanTier,
  planSatisfies,
  canRunDailyAudit,
  canRunSovEvaluation,
  canRunCompetitorIntercept,
  maxLocations,
  maxCompetitors,
  canRunAutopilot,
  canRunPageAudit,
  canRunOccasionEngine,
  canViewCitationGap,
  canConnectGBP,
  canRunMultiModelSOV,
  canExportData,
  canRegenerateLLMsTxt,
  canManageTeamSeats,
  defaultSeatLimit,
} from '@/lib/plan-enforcer';

export interface FeatureRow {
  label: string;
  category: 'Core' | 'AI Monitoring' | 'Competitive' | 'Content' | 'Integrations' | 'Support';
  trial:   boolean | string;
  starter: boolean | string;
  growth:  boolean | string;
  agency:  boolean | string;
}

const TIERS: PlanTier[] = ['trial', 'starter', 'growth', 'agency'];

/**
 * Safely call a boolean gating function. Returns false on any error
 * so a broken gate never crashes the billing page.
 */
function gate(fn: (plan: PlanTier) => boolean, plan: PlanTier): boolean {
  try { return fn(plan); } catch (_err) { return false; }
}

/**
 * Convert a numeric limit into a display string or false.
 * 0 means the feature is unavailable for that tier.
 */
function numericGate(fn: (plan: PlanTier) => number, plan: PlanTier, suffix = ''): boolean | string {
  try {
    const val = fn(plan);
    if (val <= 0) return false;
    return `${val}${suffix}`;
  } catch (_err) {
    return false;
  }
}

/**
 * Build a single FeatureRow by evaluating a gating function across all 4 tiers.
 */
function boolRow(
  label: string,
  category: FeatureRow['category'],
  fn: (plan: PlanTier) => boolean,
): FeatureRow {
  return {
    label,
    category,
    trial:   gate(fn, 'trial'),
    starter: gate(fn, 'starter'),
    growth:  gate(fn, 'growth'),
    agency:  gate(fn, 'agency'),
  };
}

/**
 * Build the full feature matrix from plan-enforcer.ts gating functions.
 * Zero hardcoded availability — every cell is computed.
 */
export function buildFeatureMatrix(): FeatureRow[] {
  // Helper for features available on all plans (no gating function exists)
  const allPlans = (_plan: PlanTier) => true;

  // Helper for starter+ features where no dedicated gate exists
  const starterPlus = (plan: PlanTier) => planSatisfies(plan, 'starter');

  return [
    // ── Core ──────────────────────────────────────────────────────────────────
    boolRow('Reality Score',             'Core', allPlans),
    boolRow('Weekly hallucination scan', 'Core', allPlans),
    boolRow('Daily hallucination scan',  'Core', canRunDailyAudit),
    boolRow('Hallucination alerts',      'Core', allPlans),
    boolRow('Weekly digest email',       'Core', starterPlus),

    // ── AI Monitoring ──────────────────────────────────────────────────────────
    boolRow('ChatGPT monitoring',  'AI Monitoring', allPlans),
    boolRow('Perplexity monitoring','AI Monitoring', allPlans),
    boolRow('Gemini monitoring',   'AI Monitoring', allPlans),
    boolRow('Multi-model SOV',     'AI Monitoring', canRunMultiModelSOV),
    boolRow('Share of Voice tracking','AI Monitoring', canRunSovEvaluation),

    // ── Competitive ────────────────────────────────────────────────────────────
    {
      label: 'Competitor tracking',
      category: 'Competitive',
      trial:   numericGate(maxCompetitors, 'trial', ' max'),
      starter: numericGate(maxCompetitors, 'starter', ' max'),
      growth:  numericGate(maxCompetitors, 'growth', ' max'),
      agency:  numericGate(maxCompetitors, 'agency', ' max'),
    },
    boolRow('Competitor intercept analysis', 'Competitive', canRunCompetitorIntercept),
    boolRow('Cluster map analysis',          'Competitive', canRunCompetitorIntercept),
    boolRow('Citation gap dashboard',        'Competitive', canViewCitationGap),

    // ── Content ────────────────────────────────────────────────────────────────
    boolRow('Magic Menu schema generation', 'Content', starterPlus),
    boolRow('AI content drafts',            'Content', canRunAutopilot),
    boolRow('AEO page audit',               'Content', canRunPageAudit),
    boolRow('Occasion engine',              'Content', canRunOccasionEngine),
    boolRow('CSV/PDF export',               'Content', canExportData),
    boolRow('llms.txt regeneration',        'Content', canRegenerateLLMsTxt),

    // ── Integrations ──────────────────────────────────────────────────────────
    boolRow('Google Business Profile sync', 'Integrations', canConnectGBP),
    boolRow('Webhook alerts (Slack/Zapier)','Integrations', canManageTeamSeats),
    {
      label: 'Multiple locations',
      category: 'Integrations',
      trial:   String(maxLocations('trial')),
      starter: String(maxLocations('starter')),
      growth:  String(maxLocations('growth')),
      agency:  String(maxLocations('agency')),
    },
    {
      label: 'Team seats',
      category: 'Integrations',
      trial:   String(defaultSeatLimit('trial')),
      starter: String(defaultSeatLimit('starter')),
      growth:  String(defaultSeatLimit('growth')),
      agency:  String(defaultSeatLimit('agency')),
    },
  ];
}

/** Pre-built matrix for backward compatibility with existing imports. */
export const PLAN_FEATURE_MATRIX: FeatureRow[] = buildFeatureMatrix();
