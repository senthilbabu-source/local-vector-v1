// ---------------------------------------------------------------------------
// lib/admin/known-crons.ts — Sprint §204 (Admin Write Operations)
//
// SSOT list of all registered cron job names (must match vercel.json paths).
// Used by adminForceCronRun() to validate cron name input.
// ---------------------------------------------------------------------------

export const KNOWN_CRONS = [
  'weekly-digest',
  'refresh-gbp-tokens',
  'refresh-places',
  'audit',
  'sov',
  'citation',
  'content-audit',
  'correction-follow-up',
  'benchmarks',
  'nap-sync',
  'schema-drift',
  'review-sync',
  'autopilot',
  'authority-mapping',
  'vaio',
  'embed-backfill',
  'correction-rescan',
  'data-health-refresh',
  'faq-regeneration',
  'apple-bc-sync',
  'agent-seo-audit',
  'playbook-generation',
  'intent-discovery',
  'hijack-detection',
  'data-cleanup',
  'degradation-check',
  'correction-benchmarks',
  'ai-shopper',
  'competitor-vulnerability',
  'monthly-report',
] as const;

export type KnownCron = (typeof KNOWN_CRONS)[number];

/**
 * Returns true if the given string is a valid cron name.
 */
export function isKnownCron(name: string): name is KnownCron {
  return (KNOWN_CRONS as readonly string[]).includes(name);
}
