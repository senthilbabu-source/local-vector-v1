// ---------------------------------------------------------------------------
// Sprint F: Registration tests — vercel.json, CRON_REGISTRY, env docs
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Sprint F — Cron Registration', () => {
  describe('vercel.json', () => {
    const vercelJson = JSON.parse(
      readFileSync(join(ROOT, 'vercel.json'), 'utf-8'),
    );
    const cronPaths = vercelJson.crons.map((c: { path: string }) => c.path);

    it('registers correction-follow-up cron', () => {
      expect(cronPaths).toContain('/api/cron/correction-follow-up');
    });

    it('registers benchmarks cron', () => {
      expect(cronPaths).toContain('/api/cron/benchmarks');
    });

    it('has 14 total crons registered', () => {
      expect(vercelJson.crons.length).toBe(14);
    });
  });

  describe('CRON_REGISTRY', () => {
    it('includes correction-follow-up entry', async () => {
      const { CRON_REGISTRY } = await import(
        '@/lib/services/cron-health.service'
      );
      const names = CRON_REGISTRY.map((e) => e.cronName);
      expect(names).toContain('correction-follow-up');
    });

    it('includes benchmarks entry', async () => {
      const { CRON_REGISTRY } = await import(
        '@/lib/services/cron-health.service'
      );
      const names = CRON_REGISTRY.map((e) => e.cronName);
      expect(names).toContain('benchmarks');
    });

    it('has 9 total cron registry entries', async () => {
      const { CRON_REGISTRY } = await import(
        '@/lib/services/cron-health.service'
      );
      expect(CRON_REGISTRY.length).toBe(9);
    });
  });

  describe('.env.local.example', () => {
    const envExample = readFileSync(
      join(ROOT, '.env.local.example'),
      'utf-8',
    );

    it('documents STOP_CORRECTION_FOLLOWUP_CRON', () => {
      expect(envExample).toContain('STOP_CORRECTION_FOLLOWUP_CRON');
    });

    it('documents STOP_BENCHMARK_CRON', () => {
      expect(envExample).toContain('STOP_BENCHMARK_CRON');
    });
  });

  describe('AI provider model keys', () => {
    it('registers preview-chatgpt model', async () => {
      const { MODELS } = await import('@/lib/ai/providers');
      expect(MODELS['preview-chatgpt']).toBeDefined();
    });

    it('registers preview-perplexity model', async () => {
      const { MODELS } = await import('@/lib/ai/providers');
      expect(MODELS['preview-perplexity']).toBeDefined();
    });

    it('registers preview-gemini model', async () => {
      const { MODELS } = await import('@/lib/ai/providers');
      expect(MODELS['preview-gemini']).toBeDefined();
    });
  });
});
