// ---------------------------------------------------------------------------
// Sprint N: Registration tests — schema columns, vercel.json integrity
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Sprint N — Registration & Schema', () => {
  describe('vercel.json', () => {
    const vercelJson = JSON.parse(
      readFileSync(join(ROOT, 'vercel.json'), 'utf-8'),
    );

    it('still has all 14 crons registered', () => {
      expect(vercelJson.crons.length).toBe(14);
    });

    it('correction-follow-up is still registered', () => {
      const paths = vercelJson.crons.map((c: { path: string }) => c.path);
      expect(paths).toContain('/api/cron/correction-follow-up');
    });
  });

  describe('prod_schema.sql — Sprint N columns', () => {
    const schema = readFileSync(join(ROOT, 'supabase/prod_schema.sql'), 'utf-8');

    it('has scan_day_of_week column on organizations', () => {
      expect(schema).toContain('scan_day_of_week');
    });

    it('has notify_score_drop_alert column on organizations', () => {
      expect(schema).toContain('notify_score_drop_alert');
    });

    it('has notify_new_competitor column on organizations', () => {
      expect(schema).toContain('notify_new_competitor');
    });

    it('has CHECK constraint for scan_day_of_week range 0-6', () => {
      expect(schema).toContain('organizations_scan_day_of_week_check');
    });
  });

  describe('lib/email.ts — correction follow-up', () => {
    it('exports sendCorrectionFollowUpAlert function', async () => {
      const src = readFileSync(join(ROOT, 'lib/email.ts'), 'utf-8');
      expect(src).toContain('sendCorrectionFollowUpAlert');
      expect(src).toContain("result: 'fixed' | 'recurring'");
    });
  });

  describe('correction-follow-up cron — Sprint N email wiring', () => {
    it('imports sendCorrectionFollowUpAlert', () => {
      const src = readFileSync(
        join(ROOT, 'app/api/cron/correction-follow-up/route.ts'),
        'utf-8',
      );
      expect(src).toContain('sendCorrectionFollowUpAlert');
    });

    it('calls sendFollowUpEmail after status update', () => {
      const src = readFileSync(
        join(ROOT, 'app/api/cron/correction-follow-up/route.ts'),
        'utf-8',
      );
      expect(src).toContain('sendFollowUpEmail');
    });

    it('tracks emailsSent in summary', () => {
      const src = readFileSync(
        join(ROOT, 'app/api/cron/correction-follow-up/route.ts'),
        'utf-8',
      );
      expect(src).toContain('emailsSent');
    });
  });

  describe('AI Preview streaming — Sprint N enhancement', () => {
    it('exports streamOpenAI function', () => {
      const src = readFileSync(
        join(ROOT, 'lib/ai-preview/model-queries.ts'),
        'utf-8',
      );
      expect(src).toContain('export function streamOpenAI');
    });

    it('exports streamPerplexity function', () => {
      const src = readFileSync(
        join(ROOT, 'lib/ai-preview/model-queries.ts'),
        'utf-8',
      );
      expect(src).toContain('export function streamPerplexity');
    });

    it('exports streamGemini function', () => {
      const src = readFileSync(
        join(ROOT, 'lib/ai-preview/model-queries.ts'),
        'utf-8',
      );
      expect(src).toContain('export function streamGemini');
    });

    it('uses streamText from Vercel AI SDK', () => {
      const src = readFileSync(
        join(ROOT, 'lib/ai-preview/model-queries.ts'),
        'utf-8',
      );
      expect(src).toContain("import { generateText, streamText } from 'ai'");
    });

    it('AI Preview route uses streaming imports', () => {
      const src = readFileSync(
        join(ROOT, 'app/api/ai-preview/route.ts'),
        'utf-8',
      );
      expect(src).toContain('streamOpenAI');
      expect(src).toContain('streamPerplexity');
      expect(src).toContain('streamGemini');
    });
  });
});
