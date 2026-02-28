// ---------------------------------------------------------------------------
// lib/plan-display-names.ts — Human-readable plan display names (Sprint A)
//
// These match the marketing names on the landing page (PricingSection.tsx).
// Source of truth: the DB plan enum values are: trial | starter | growth | agency
// NEVER hardcode plan display names elsewhere — always import from here.
// AI_RULES §43.
// ---------------------------------------------------------------------------

/**
 * Maps DB plan enum values to marketing display names.
 * The landing page uses these names; all in-dashboard surfaces must match.
 */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  trial:   'The Audit',
  starter: 'Starter',
  growth:  'AI Shield',
  agency:  'Brand Fortress',
};

/**
 * Returns the marketing display name for a plan value.
 * Falls back to the raw value if not found (defensive — future plan tiers
 * added without updating this map will show the raw value, not crash).
 */
export function getPlanDisplayName(plan: string | null | undefined): string {
  if (!plan) return 'Free';
  return PLAN_DISPLAY_NAMES[plan] ?? plan;
}
