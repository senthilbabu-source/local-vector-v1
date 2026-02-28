// ---------------------------------------------------------------------------
// Sprint N: Settings expansion — unit tests
//
// Verifies: Claude in AI model list, scan_day_of_week validation,
// notification prefs schema, migration file exists.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Sprint N — Settings Expansion', () => {
  describe('AI model list', () => {
    it('includes claude in the SettingsForm AI_MODELS array', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/_components/SettingsForm.tsx'),
        'utf-8',
      );
      expect(src).toContain("id: 'claude'");
      expect(src).toContain('Claude (Anthropic)');
    });

    it('includes claude in VALID_AI_MODELS in actions.ts', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/actions.ts'),
        'utf-8',
      );
      expect(src).toContain("'claude'");
      // Should have all 5 models
      expect(src).toContain("'openai'");
      expect(src).toContain("'perplexity'");
      expect(src).toContain("'gemini'");
      expect(src).toContain("'copilot'");
    });
  });

  describe('scan_day_of_week', () => {
    it('has scan_day_of_week in the AI monitoring schema', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/actions.ts'),
        'utf-8',
      );
      expect(src).toContain('scan_day_of_week');
      // Validate range 0-6
      expect(src).toMatch(/scan_day_of_week.*min\(0\).*max\(6\)/s);
    });

    it('has scan day select in the SettingsForm UI', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/_components/SettingsForm.tsx'),
        'utf-8',
      );
      expect(src).toContain('scan-day-select');
      expect(src).toContain('SCAN_DAYS');
    });
  });

  describe('notification toggles', () => {
    it('includes notify_score_drop_alert in notification schema', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/actions.ts'),
        'utf-8',
      );
      expect(src).toContain('notify_score_drop_alert');
    });

    it('includes notify_new_competitor in notification schema', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/actions.ts'),
        'utf-8',
      );
      expect(src).toContain('notify_new_competitor');
    });
  });

  describe('competitor shortcut', () => {
    it('has manage-competitors-link in SettingsForm', () => {
      const src = readFileSync(
        join(ROOT, 'app/dashboard/settings/_components/SettingsForm.tsx'),
        'utf-8',
      );
      expect(src).toContain('manage-competitors-link');
      expect(src).toContain('/dashboard/compete');
    });

    it('passes competitorCount prop to SettingsForm', () => {
      const pageSrc = readFileSync(
        join(ROOT, 'app/dashboard/settings/page.tsx'),
        'utf-8',
      );
      expect(pageSrc).toContain('competitorCount');
    });
  });

  describe('migration', () => {
    it('Sprint N migration file exists', () => {
      expect(
        existsSync(join(ROOT, 'supabase/migrations/20260310000001_sprint_n_settings.sql')),
      ).toBe(true);
    });

    it('migration adds scan_day_of_week column', () => {
      const sql = readFileSync(
        join(ROOT, 'supabase/migrations/20260310000001_sprint_n_settings.sql'),
        'utf-8',
      );
      expect(sql).toContain('scan_day_of_week');
    });

    it('migration adds notify_score_drop_alert column', () => {
      const sql = readFileSync(
        join(ROOT, 'supabase/migrations/20260310000001_sprint_n_settings.sql'),
        'utf-8',
      );
      expect(sql).toContain('notify_score_drop_alert');
    });

    it('migration adds notify_new_competitor column', () => {
      const sql = readFileSync(
        join(ROOT, 'supabase/migrations/20260310000001_sprint_n_settings.sql'),
        'utf-8',
      );
      expect(sql).toContain('notify_new_competitor');
    });
  });

  describe('prod_schema.sql', () => {
    const schema = readFileSync(join(ROOT, 'supabase/prod_schema.sql'), 'utf-8');

    it('has scan_day_of_week column', () => {
      expect(schema).toContain('scan_day_of_week');
    });

    it('has notify_score_drop_alert column', () => {
      expect(schema).toContain('notify_score_drop_alert');
    });

    it('has notify_new_competitor column', () => {
      expect(schema).toContain('notify_new_competitor');
    });
  });
});
