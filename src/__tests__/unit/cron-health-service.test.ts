// ---------------------------------------------------------------------------
// cron-health-service.test.ts — Sprint 76: Pure service tests
//
// Tests buildCronHealthSummary() which transforms raw cron_run_log rows
// into a structured CronHealthSummary.
//
// Run: npx vitest run src/__tests__/unit/cron-health-service.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  buildCronHealthSummary,
  CRON_REGISTRY,
  type CronRunRow,
} from '@/lib/services/cron-health.service';
import { MOCK_CRON_RUN_SUCCESS, MOCK_CRON_RUN_FAILED } from '@/__fixtures__/golden-tenant';

describe('buildCronHealthSummary', () => {
  it('returns 7 jobs even with empty input', () => {
    const result = buildCronHealthSummary([]);
    expect(result.jobs).toHaveLength(7);
    expect(result.jobs.map((j) => j.cronName)).toEqual(['audit', 'sov', 'citation', 'content-audit', 'weekly-digest', 'correction-follow-up', 'benchmarks']);
  });

  it('returns healthy status with empty input', () => {
    const result = buildCronHealthSummary([]);
    expect(result.overallStatus).toBe('healthy');
    expect(result.hasRecentFailures).toBe(false);
    expect(result.recentRuns).toHaveLength(0);
  });

  it('sets lastRunAt and lastStatus from the most recent row per cron', () => {
    const rows: CronRunRow[] = [MOCK_CRON_RUN_SUCCESS];
    const result = buildCronHealthSummary(rows);

    const auditJob = result.jobs.find((j) => j.cronName === 'audit')!;
    expect(auditJob.lastRunAt).toBe(MOCK_CRON_RUN_SUCCESS.started_at);
    expect(auditJob.lastStatus).toBe('success');
    expect(auditJob.lastDurationMs).toBe(150000);
  });

  it('sets null lastRunAt/lastStatus for crons with no rows', () => {
    const result = buildCronHealthSummary([MOCK_CRON_RUN_SUCCESS]);
    const sovJob = result.jobs.find((j) => j.cronName === 'sov')!;
    expect(sovJob.lastRunAt).toBeNull();
    expect(sovJob.lastStatus).toBeNull();
    expect(sovJob.lastDurationMs).toBeNull();
  });

  it('counts recent failures within 7 days', () => {
    // MOCK_CRON_RUN_FAILED is dated 2026-02-25 — within 7 days of "now"
    const rows: CronRunRow[] = [MOCK_CRON_RUN_FAILED];
    const result = buildCronHealthSummary(rows);

    const sovJob = result.jobs.find((j) => j.cronName === 'sov')!;
    expect(sovJob.recentFailureCount).toBe(1);
  });

  it('ignores failures older than 7 days', () => {
    const oldFailure: CronRunRow = {
      ...MOCK_CRON_RUN_FAILED,
      id: 'f9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      started_at: '2026-01-01T00:00:00.000Z',
    };
    const result = buildCronHealthSummary([oldFailure]);

    const sovJob = result.jobs.find((j) => j.cronName === 'sov')!;
    expect(sovJob.recentFailureCount).toBe(0);
    expect(result.overallStatus).toBe('healthy');
  });

  it('sets overallStatus to degraded with 1 recent failure', () => {
    const result = buildCronHealthSummary([MOCK_CRON_RUN_FAILED]);
    expect(result.overallStatus).toBe('degraded');
    expect(result.hasRecentFailures).toBe(true);
  });

  it('sets overallStatus to failing with failures in 2+ crons', () => {
    const auditFailure: CronRunRow = {
      ...MOCK_CRON_RUN_FAILED,
      id: 'f9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      cron_name: 'audit',
    };
    const result = buildCronHealthSummary([MOCK_CRON_RUN_FAILED, auditFailure]);
    expect(result.overallStatus).toBe('failing');
  });

  it('sets overallStatus to failing with 3+ total recent failures', () => {
    const failures: CronRunRow[] = [
      { ...MOCK_CRON_RUN_FAILED, id: 'f9eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
      { ...MOCK_CRON_RUN_FAILED, id: 'f8eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', started_at: '2026-02-24T07:00:00.000Z' },
      { ...MOCK_CRON_RUN_FAILED, id: 'f7eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', started_at: '2026-02-23T07:00:00.000Z' },
    ];
    const result = buildCronHealthSummary(failures);
    expect(result.overallStatus).toBe('failing');
  });

  it('limits recentRuns to first 20', () => {
    const rows: CronRunRow[] = Array.from({ length: 30 }, (_, i) => ({
      ...MOCK_CRON_RUN_SUCCESS,
      id: `f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a${String(i).padStart(2, '0')}`,
      started_at: `2026-02-${String(26 - i).padStart(2, '0')}T08:00:00.000Z`,
    }));
    const result = buildCronHealthSummary(rows);
    expect(result.recentRuns).toHaveLength(20);
  });

  it('preserves label and schedule from CRON_REGISTRY', () => {
    const result = buildCronHealthSummary([]);
    const auditJob = result.jobs.find((j) => j.cronName === 'audit')!;
    expect(auditJob.label).toBe('AI Audit');
    expect(auditJob.schedule).toBe('Daily 3 AM EST');
  });

  it('CRON_REGISTRY has exactly 7 entries', () => {
    expect(CRON_REGISTRY).toHaveLength(7);
  });

  it('handles timeout status as a failure', () => {
    const timeoutRun: CronRunRow = {
      ...MOCK_CRON_RUN_FAILED,
      status: 'timeout',
    };
    const result = buildCronHealthSummary([timeoutRun]);
    const sovJob = result.jobs.find((j) => j.cronName === 'sov')!;
    expect(sovJob.recentFailureCount).toBe(1);
    expect(result.hasRecentFailures).toBe(true);
  });
});
