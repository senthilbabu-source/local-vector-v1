// ---------------------------------------------------------------------------
// lib/revenue-impact/industry-revenue-defaults.ts
//
// Sprint I: Industry-specific default values for the Revenue Impact form.
// These are realistic starting points — not precise figures. Users refine them.
//
// Matches RevenueConfig from revenue-impact.service.ts:
//   { avgCustomerValue: number; monthlyCovers: number }
// ---------------------------------------------------------------------------

import type { RevenueConfig } from '@/lib/services/revenue-impact.service';

// ── Per-industry defaults ───────────────────────────────────────────────────

const INDUSTRY_REVENUE_DEFAULTS: Record<string, RevenueConfig> = {
  // Restaurant / Food & Beverage — matches Sprint D defaults
  restaurant: {
    avgCustomerValue: 55,
    monthlyCovers: 1800,
  },
  // Medical / Dental Practice — higher per-visit, fewer visits
  medical_dental: {
    avgCustomerValue: 285,
    monthlyCovers: 360,
  },
  // Law Firm / Legal Practice
  legal: {
    avgCustomerValue: 350,
    monthlyCovers: 300,
  },
  // Real Estate Agency
  real_estate: {
    avgCustomerValue: 150,
    monthlyCovers: 400,
  },
  // Generic fallback for unknown industries
  default: {
    avgCustomerValue: 65,
    monthlyCovers: 750,
  },
};

/**
 * Get industry-specific revenue defaults for the Revenue Impact form.
 * Falls back to generic defaults for unknown industries.
 */
export function getIndustryRevenueDefaults(
  industryId: string | null | undefined,
): RevenueConfig {
  if (!industryId) return INDUSTRY_REVENUE_DEFAULTS.default;
  return INDUSTRY_REVENUE_DEFAULTS[industryId] ?? INDUSTRY_REVENUE_DEFAULTS.default;
}

// ── Field labels and descriptions (for InfoTooltip and form UI) ─────────────

export const REVENUE_FIELD_LABELS: Record<keyof RevenueConfig, string> = {
  avgCustomerValue: 'Average spend per visit ($)',
  monthlyCovers: 'Customers served per month',
};

export const REVENUE_FIELD_DESCRIPTIONS: Record<keyof RevenueConfig, string> = {
  avgCustomerValue:
    'Average amount each customer spends per visit, including all products and services.',
  monthlyCovers:
    'Total number of customers or transactions you handle per month.',
};
