import { describe, it, expect } from 'vitest';
import { computeConsistencyFromDiscrepancies } from '@/lib/services/consistency-score.service';

describe('S28: Cross-Platform Consistency Score', () => {
  describe('computeConsistencyFromDiscrepancies', () => {
    it('returns 100 when all platforms match (no discrepancies)', () => {
      const result = computeConsistencyFromDiscrepancies([], true);
      expect(result.consistencyScore).toBe(100);
      expect(result.nameScore).toBe(30);
      expect(result.addressScore).toBe(25);
      expect(result.phoneScore).toBe(20);
      expect(result.hoursScore).toBe(15);
      expect(result.menuScore).toBe(10);
    });

    it('returns 0 when no platforms configured', () => {
      const result = computeConsistencyFromDiscrepancies([], false);
      expect(result.consistencyScore).toBe(0);
    });

    it('name mismatch deducts 30pts', () => {
      const result = computeConsistencyFromDiscrepancies(['name'], true);
      expect(result.nameScore).toBe(0);
      expect(result.consistencyScore).toBe(70);
    });

    it('address mismatch deducts 25pts', () => {
      const result = computeConsistencyFromDiscrepancies(['address'], true);
      expect(result.addressScore).toBe(0);
      expect(result.consistencyScore).toBe(75);
    });

    it('phone mismatch deducts 20pts', () => {
      const result = computeConsistencyFromDiscrepancies(['phone'], true);
      expect(result.phoneScore).toBe(0);
      expect(result.consistencyScore).toBe(80);
    });

    it('hours mismatch deducts 15pts', () => {
      const result = computeConsistencyFromDiscrepancies(['hours'], true);
      expect(result.hoursScore).toBe(0);
      expect(result.consistencyScore).toBe(85);
    });

    it('menu missing deducts 10pts', () => {
      const result = computeConsistencyFromDiscrepancies(['menu'], true);
      expect(result.menuScore).toBe(0);
      expect(result.consistencyScore).toBe(90);
    });

    it('multiple discrepancies compound', () => {
      const result = computeConsistencyFromDiscrepancies(['name', 'phone'], true);
      expect(result.consistencyScore).toBe(50); // 100 - 30 - 20
    });

    it('all fields discrepant = 0', () => {
      const result = computeConsistencyFromDiscrepancies(
        ['name', 'address', 'phone', 'hours', 'menu'],
        true,
      );
      expect(result.consistencyScore).toBe(0);
    });

    it('handles alternate field names (business_name)', () => {
      const result = computeConsistencyFromDiscrepancies(['business_name'], true);
      expect(result.nameScore).toBe(0);
    });

    it('handles alternate field names (telephone)', () => {
      const result = computeConsistencyFromDiscrepancies(['telephone'], true);
      expect(result.phoneScore).toBe(0);
    });

    it('handles alternate field names (opening_hours)', () => {
      const result = computeConsistencyFromDiscrepancies(['opening_hours'], true);
      expect(result.hoursScore).toBe(0);
    });

    it('is case-insensitive for field names', () => {
      const result = computeConsistencyFromDiscrepancies(['NAME', 'Address'], true);
      expect(result.nameScore).toBe(0);
      expect(result.addressScore).toBe(0);
    });

    it('sub-scores sum to consistency_score', () => {
      const result = computeConsistencyFromDiscrepancies(['phone'], true);
      const sum = result.nameScore + result.addressScore + result.phoneScore +
        result.hoursScore + result.menuScore;
      expect(sum).toBe(result.consistencyScore);
    });
  });

  describe('NAV_GROUPS reorganization', () => {
    it('has TODAY/THIS WEEK/THIS MONTH/ADVANCED/ACCOUNT structure', async () => {
      // Dynamic import to avoid full component tree
      const { NAV_GROUPS } = await import('@/components/layout/Sidebar');
      const labels = NAV_GROUPS.map((g) => g.label);
      expect(labels).toContain('Today');
      expect(labels).toContain('This Week');
      expect(labels).toContain('This Month');
      expect(labels).toContain('Advanced');
      expect(labels).toContain('Account');
    });
  });

  describe('Cron integration', () => {
    it('vercel.json has all Wave 4 crons registered', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const vercelJson = JSON.parse(
        fs.readFileSync(path.resolve('vercel.json'), 'utf8'),
      );
      const paths = vercelJson.crons.map((c: { path: string }) => c.path);

      // S22
      expect(paths).toContain('/api/cron/degradation-check');
      // S23
      expect(paths).toContain('/api/cron/correction-benchmarks');
      // S25
      expect(paths).toContain('/api/cron/ai-shopper');
      // S26
      expect(paths).toContain('/api/cron/competitor-vulnerability');
      // S27
      expect(paths).toContain('/api/cron/monthly-report');
    });

    it('total cron count is 32', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const vercelJson = JSON.parse(
        fs.readFileSync(path.resolve('vercel.json'), 'utf8'),
      );
      expect(vercelJson.crons).toHaveLength(33);
    });
  });

  describe('Plan gates', () => {
    it('canRunAIShopper requires growth+', async () => {
      const { canRunAIShopper } = await import('@/lib/plan-enforcer');
      expect(canRunAIShopper('trial')).toBe(false);
      expect(canRunAIShopper('starter')).toBe(false);
      expect(canRunAIShopper('growth')).toBe(true);
      expect(canRunAIShopper('agency')).toBe(true);
    });

    it('canRunCompetitorVulnerability requires growth+', async () => {
      const { canRunCompetitorVulnerability } = await import('@/lib/plan-enforcer');
      expect(canRunCompetitorVulnerability('trial')).toBe(false);
      expect(canRunCompetitorVulnerability('starter')).toBe(false);
      expect(canRunCompetitorVulnerability('growth')).toBe(true);
      expect(canRunCompetitorVulnerability('agency')).toBe(true);
    });
  });
});
