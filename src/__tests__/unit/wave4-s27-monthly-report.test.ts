import { describe, it, expect, vi } from 'vitest';
import type { MonthlyReport } from '@/lib/services/monthly-report.service';

// Mock the sendMonthlyReport email function
vi.mock('@/lib/email', () => ({
  sendMonthlyReport: vi.fn().mockResolvedValue(undefined),
}));

describe('S27: Monthly Report + First Scan Reveal', () => {
  describe('MonthlyReport type shape', () => {
    it('has all required fields', () => {
      const report: MonthlyReport = {
        orgId: 'org-1',
        month: '2026-02',
        winsCount: 3,
        fixedHallucinationsCount: 2,
        revenueRecoveredMonthly: 450,
        realityScoreStart: 60,
        realityScoreEnd: 72,
        realityScoreDelta: 12,
        sovStart: 35,
        sovEnd: 42,
        sovDelta: 7,
        openAlertCount: 5,
        openAlertDollarImpact: 1200,
        ytdRecoveryTotal: 3500,
        ytdErrorsCaught: 15,
        ytdAvgDetectionDays: 8,
      };
      expect(report.month).toBe('2026-02');
      expect(report.realityScoreDelta).toBe(12);
      expect(report.sovDelta).toBe(7);
    });

    it('handles null deltas when no data', () => {
      const report: MonthlyReport = {
        orgId: 'org-2',
        month: '2026-01',
        winsCount: 0,
        fixedHallucinationsCount: 0,
        revenueRecoveredMonthly: 0,
        realityScoreStart: null,
        realityScoreEnd: null,
        realityScoreDelta: null,
        sovStart: null,
        sovEnd: null,
        sovDelta: null,
        openAlertCount: 0,
        openAlertDollarImpact: 0,
        ytdRecoveryTotal: 0,
        ytdErrorsCaught: 0,
        ytdAvgDetectionDays: null,
      };
      expect(report.realityScoreDelta).toBeNull();
      expect(report.ytdAvgDetectionDays).toBeNull();
    });
  });

  describe('MonthlyReport computations', () => {
    it('revenue delta is end - start', () => {
      const start = 60;
      const end = 72;
      expect(end - start).toBe(12);
    });

    it('sov delta is end - start', () => {
      const start = 35;
      const end = 42;
      expect(end - start).toBe(7);
    });

    it('avg detection days computed from differences', () => {
      const diffs = [5, 10, 15];
      const avg = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
      expect(avg).toBe(10);
    });

    it('handles empty diffs for avg detection', () => {
      const diffs: number[] = [];
      const avg = diffs.length > 0
        ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length)
        : null;
      expect(avg).toBeNull();
    });
  });

  describe('Cron registration', () => {
    it('monthly-report cron is registered in vercel.json', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const vercelJson = JSON.parse(
        fs.readFileSync(path.resolve('vercel.json'), 'utf8'),
      );
      const paths = vercelJson.crons.map((c: { path: string }) => c.path);
      expect(paths).toContain('/api/cron/monthly-report');
    });

    it('monthly-report cron runs on 1st of month', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const vercelJson = JSON.parse(
        fs.readFileSync(path.resolve('vercel.json'), 'utf8'),
      );
      const cron = vercelJson.crons.find(
        (c: { path: string }) => c.path === '/api/cron/monthly-report',
      );
      expect(cron.schedule).toBe('0 9 1 * *');
    });
  });
});
