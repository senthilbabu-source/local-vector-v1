// ---------------------------------------------------------------------------
// lib/services/cron-health.service.ts — Cron Health Summary Service (Sprint 76)
//
// Pure service — NO I/O. Transforms raw cron_run_log rows into a structured
// CronHealthSummary used by the System Health dashboard page and card.
//
// Pattern follows lib/services/ai-health-score.service.ts (Sprint 72).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CronRunRow {
  id: string;
  cron_name: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: 'running' | 'success' | 'failed' | 'timeout';
  summary: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
}

export interface CronJobSummary {
  cronName: string;
  label: string;
  schedule: string;
  lastRunAt: string | null;
  lastStatus: 'running' | 'success' | 'failed' | 'timeout' | null;
  lastDurationMs: number | null;
  recentFailureCount: number;
}

export interface CronHealthSummary {
  jobs: CronJobSummary[];
  recentRuns: CronRunRow[];
  hasRecentFailures: boolean;
  overallStatus: 'healthy' | 'degraded' | 'failing';
}

// ---------------------------------------------------------------------------
// Static registry — metadata for the 5 known cron jobs
// ---------------------------------------------------------------------------

interface CronRegistryEntry {
  cronName: string;
  label: string;
  schedule: string;
}

export const CRON_REGISTRY: CronRegistryEntry[] = [
  { cronName: 'audit', label: 'AI Audit', schedule: 'Daily 3 AM EST' },
  { cronName: 'sov', label: 'SOV Engine', schedule: 'Weekly Sun 2 AM EST' },
  { cronName: 'citation', label: 'Citation Scan', schedule: '1st Sun Monthly' },
  { cronName: 'content-audit', label: 'Content Audit', schedule: '1st of Month 3 AM EST' },
  { cronName: 'weekly-digest', label: 'Weekly Digest', schedule: 'Weekly Mon 8 AM EST' },
];

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Build a CronHealthSummary from raw cron_run_log rows.
 * Expects rows ordered by started_at DESC (most recent first).
 */
export function buildCronHealthSummary(rows: CronRunRow[]): CronHealthSummary {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Group rows by cron_name
  const byName = new Map<string, CronRunRow[]>();
  for (const row of rows) {
    const existing = byName.get(row.cron_name);
    if (existing) {
      existing.push(row);
    } else {
      byName.set(row.cron_name, [row]);
    }
  }

  // Build per-job summaries — one for every registered cron, even if no rows
  const jobs: CronJobSummary[] = CRON_REGISTRY.map((entry) => {
    const cronRows = byName.get(entry.cronName) ?? [];
    const latest = cronRows[0] ?? null; // rows are DESC, first = most recent
    const recentFailures = cronRows.filter(
      (r) => (r.status === 'failed' || r.status === 'timeout') && r.started_at >= sevenDaysAgo,
    );

    return {
      cronName: entry.cronName,
      label: entry.label,
      schedule: entry.schedule,
      lastRunAt: latest?.started_at ?? null,
      lastStatus: latest?.status ?? null,
      lastDurationMs: latest?.duration_ms ?? null,
      recentFailureCount: recentFailures.length,
    };
  });

  // Recent runs — first 20 (already sorted DESC from input)
  const recentRuns = rows.slice(0, 20);

  // Overall status
  const totalRecentFailures = jobs.reduce((sum, j) => sum + j.recentFailureCount, 0);
  const jobsWithFailures = jobs.filter((j) => j.recentFailureCount > 0).length;

  let overallStatus: CronHealthSummary['overallStatus'] = 'healthy';
  if (jobsWithFailures >= 2 || totalRecentFailures >= 3) {
    overallStatus = 'failing';
  } else if (totalRecentFailures > 0) {
    overallStatus = 'degraded';
  }

  return {
    jobs,
    recentRuns,
    hasRecentFailures: totalRecentFailures > 0,
    overallStatus,
  };
}
