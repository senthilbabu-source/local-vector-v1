// ---------------------------------------------------------------------------
// database-types-completeness.test.ts — Regression guard for database.types.ts
//
// Ensures Sprint 99-101 schema additions are reflected in the TypeScript types.
// Prevents future type drift when migrations are added without regenerating types.
//
// Sprint FIX-1 — 12 tests
//
// Run:
//   npx vitest run src/__tests__/unit/database-types-completeness.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Type-level assertions — compile-time checks
// ---------------------------------------------------------------------------

type OrgRow = Database['public']['Tables']['organizations']['Row'];
type LocRow = Database['public']['Tables']['locations']['Row'];

describe('database.types.ts — Sprint 99-101 completeness', () => {
  // ── organizations table has seat billing columns ─────────────────────

  describe('organizations table has seat billing columns', () => {
    it('1. seat_limit is number | null', () => {
      const val: OrgRow['seat_limit'] = null;
      expect(val).toBeNull();
      const val2: OrgRow['seat_limit'] = 5;
      expect(val2).toBe(5);
    });

    it('2. seat_overage_count is number | null', () => {
      const val: OrgRow['seat_overage_count'] = null;
      expect(val).toBeNull();
      const val2: OrgRow['seat_overage_count'] = 0;
      expect(val2).toBe(0);
    });

    it('3. seat_overage_since is string | null', () => {
      const val: OrgRow['seat_overage_since'] = null;
      expect(val).toBeNull();
      const val2: OrgRow['seat_overage_since'] = '2026-03-01T00:00:00Z';
      expect(typeof val2).toBe('string');
    });
  });

  // ── locations table has multi-location columns ──────────────────────

  describe('locations table has multi-location columns', () => {
    it('4. is_archived is boolean', () => {
      const val: LocRow['is_archived'] = false;
      expect(val).toBe(false);
    });

    it('5. display_name is string | null', () => {
      const val: LocRow['display_name'] = null;
      expect(val).toBeNull();
      const val2: LocRow['display_name'] = 'Downtown';
      expect(val2).toBe('Downtown');
    });

    it('6. location_order is number | null', () => {
      const val: LocRow['location_order'] = null;
      expect(val).toBeNull();
      const val2: LocRow['location_order'] = 1;
      expect(val2).toBe(1);
    });
  });

  // ── new Sprint 99-101 tables are present ────────────────────────────

  describe('new Sprint 99-101 tables are present in types', () => {
    it('7. occasion_snoozes table type is accessible', () => {
      type SnoozeRow = Database['public']['Tables']['occasion_snoozes']['Row'];
      const row: SnoozeRow = {
        id: 'test-id',
        org_id: 'org-id',
        user_id: 'user-id',
        occasion_id: 'occ-id',
        snoozed_until: '2026-03-15T00:00:00Z',
        snoozed_at: '2026-03-01T00:00:00Z',
        snooze_count: 1,
      };
      expect(row.id).toBe('test-id');
      expect(row.snooze_count).toBe(1);
    });

    it('8. sidebar_badge_state table type is accessible', () => {
      type BadgeRow = Database['public']['Tables']['sidebar_badge_state']['Row'];
      const row: BadgeRow = {
        id: 'test-id',
        org_id: 'org-id',
        user_id: 'user-id',
        section: 'content_drafts',
        last_seen_at: '2026-03-01T00:00:00Z',
      };
      expect(row.section).toBe('content_drafts');
      expect(row.last_seen_at).toBeTruthy();
    });

    it('9. location_permissions table type is accessible', () => {
      type LocPermRow = Database['public']['Tables']['location_permissions']['Row'];
      const row: LocPermRow = {
        id: 'test-id',
        membership_id: 'mem-id',
        location_id: 'loc-id',
        role: 'viewer',
        granted_by: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      };
      expect(row.membership_id).toBe('mem-id');
      expect(row.role).toBe('viewer');
    });
  });

  // ── no (supabase as any) casts in production code ───────────────────

  describe('no (supabase as any) casts remain in production code', () => {
    it('10. lib/occasions/occasion-feed.ts does not contain "(supabase as any)"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'lib/occasions/occasion-feed.ts'),
        'utf-8',
      );
      expect(content).not.toContain('supabase as any');
    });

    it('11. lib/badges/badge-counts.ts does not contain "(supabase as any)"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'lib/badges/badge-counts.ts'),
        'utf-8',
      );
      expect(content).not.toContain('supabase as any');
    });

    it('12. app/actions/occasions.ts does not contain "(supabase as any)"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'app/actions/occasions.ts'),
        'utf-8',
      );
      expect(content).not.toContain('supabase as any');
    });
  });
});

// ---------------------------------------------------------------------------
// Sprint 102 — Sprint F + Sprint N + benchmarks completeness
// ---------------------------------------------------------------------------

type HallucinationRow = Database['public']['Tables']['ai_hallucinations']['Row'];
type BenchmarkRow = Database['public']['Tables']['benchmarks']['Row'];
type BenchmarkInsert = Database['public']['Tables']['benchmarks']['Insert'];
type BenchmarkUpdate = Database['public']['Tables']['benchmarks']['Update'];

describe('database.types.ts — Sprint F + Sprint N completeness', () => {

  describe('ai_hallucinations table has Sprint F follow-up columns', () => {
    it('13. correction_query is string | null', () => {
      const val: HallucinationRow['correction_query'] = null;
      expect(val).toBeNull();
      const val2: HallucinationRow['correction_query'] = 'test query';
      expect(typeof val2).toBe('string');
    });

    it('14. verifying_since is string | null', () => {
      const val: HallucinationRow['verifying_since'] = null;
      expect(val).toBeNull();
      const val2: HallucinationRow['verifying_since'] = '2026-03-01T00:00:00Z';
      expect(typeof val2).toBe('string');
    });

    it('15. follow_up_checked_at is string | null', () => {
      const val: HallucinationRow['follow_up_checked_at'] = null;
      expect(val).toBeNull();
      const val2: HallucinationRow['follow_up_checked_at'] = '2026-03-01T00:00:00Z';
      expect(typeof val2).toBe('string');
    });

    it('16. follow_up_result is string | null', () => {
      const val: HallucinationRow['follow_up_result'] = null;
      expect(val).toBeNull();
      const val2: HallucinationRow['follow_up_result'] = 'fixed';
      expect(typeof val2).toBe('string');
    });
  });

  describe('organizations table has Sprint N notification columns', () => {
    it('17. scan_day_of_week is number | null', () => {
      const val: OrgRow['scan_day_of_week'] = null;
      expect(val).toBeNull();
      const val2: OrgRow['scan_day_of_week'] = 3;
      expect(val2).toBe(3);
    });

    it('18. notify_score_drop_alert is boolean | null', () => {
      const val: OrgRow['notify_score_drop_alert'] = null;
      expect(val).toBeNull();
      const val2: OrgRow['notify_score_drop_alert'] = true;
      expect(val2).toBe(true);
    });

    it('19. notify_new_competitor is boolean | null', () => {
      const val: OrgRow['notify_new_competitor'] = null;
      expect(val).toBeNull();
      const val2: OrgRow['notify_new_competitor'] = false;
      expect(val2).toBe(false);
    });
  });

  describe('benchmarks table is present in types', () => {
    it('20. benchmarks Row type is accessible and has correct fields', () => {
      const row: BenchmarkRow = {
        id: 'test-id',
        city: 'Austin',
        industry: 'restaurant',
        org_count: 42,
        avg_score: 72.5,
        min_score: 30.0,
        max_score: 95.0,
        computed_at: '2026-03-01T08:00:00Z',
      };
      expect(row.city).toBe('Austin');
      expect(row.org_count).toBe(42);
      expect(row.avg_score).toBe(72.5);
    });

    it('21. benchmarks Insert type is accessible', () => {
      const insert: BenchmarkInsert = {
        city: 'Austin',
        org_count: 42,
        avg_score: 72.5,
        min_score: 30.0,
        max_score: 95.0,
      };
      expect(insert.city).toBe('Austin');
      // id, industry, computed_at are optional in Insert
    });

    it('22. benchmarks Update type is accessible', () => {
      const update: BenchmarkUpdate = {
        avg_score: 75.0,
      };
      expect(update.avg_score).toBe(75.0);
      // all fields are optional in Update
    });

    it('23. avg_score is number (not string — PostgreSQL numeric maps to number)', () => {
      const val: BenchmarkRow['avg_score'] = 72.5;
      expect(typeof val).toBe('number');
    });
  });

  describe('no (as Function) or (as never) casts remain in target files', () => {
    it('24. lib/data/benchmarks.ts does not contain "as Function"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'lib/data/benchmarks.ts'),
        'utf-8',
      );
      expect(content).not.toContain('as Function');
    });

    it('25. app/api/cron/benchmarks/route.ts does not contain "as Function"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'app/api/cron/benchmarks/route.ts'),
        'utf-8',
      );
      expect(content).not.toContain('as Function');
    });

    it('26. app/api/cron/correction-follow-up/route.ts does not contain "as never"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'app/api/cron/correction-follow-up/route.ts'),
        'utf-8',
      );
      expect(content).not.toContain('as never');
    });

    it('27. app/dashboard/settings/actions.ts does not contain "as never"', () => {
      const content = fs.readFileSync(
        path.join(process.cwd(), 'app/dashboard/settings/actions.ts'),
        'utf-8',
      );
      expect(content).not.toContain('as never');
    });
  });
});
