// ---------------------------------------------------------------------------
// vercel-cron-config.test.ts — Vercel cron registration completeness tests
//
// Sprint FIX-3: Ensures every cron route handler at app/api/cron/*/route.ts
// is registered in vercel.json. Adding a handler without registering it
// produces no error — the handler simply never fires in production.
//
// Run:
//   npx vitest run src/__tests__/unit/vercel-cron-config.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Read and parse vercel.json once
const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
const crons: Array<{ path: string; schedule: string }> = vercelJson.crons ?? [];
const registeredPaths = crons.map((c) => c.path);

// ---------------------------------------------------------------------------
// Required cron paths are all registered
// ---------------------------------------------------------------------------

describe('vercel.json cron registration completeness', () => {
  describe('required cron paths are all registered', () => {
    const requiredPaths = [
      '/api/cron/weekly-digest',
      '/api/cron/refresh-gbp-tokens',
      '/api/cron/refresh-places',
      '/api/cron/audit',
      '/api/cron/sov',
      '/api/cron/citation',
      '/api/cron/content-audit',
    ];

    it.each(requiredPaths)('%s is registered in vercel.json', (cronPath) => {
      expect(registeredPaths).toContain(cronPath);
    });
  });

  // ---------------------------------------------------------------------------
  // Cron schedule formats are valid
  // ---------------------------------------------------------------------------

  describe('cron schedule formats are valid', () => {
    // 5-part cron expression: min hour dom month dow
    // Each field: *, number, list (1,2,3), range (1-5), step (*/5)
    const cronFieldPattern = '(\\*|[0-9,\\-\\/]+)';
    const cronRegex = new RegExp(
      `^${cronFieldPattern}\\s+${cronFieldPattern}\\s+${cronFieldPattern}\\s+${cronFieldPattern}\\s+${cronFieldPattern}$`,
    );

    it('all registered crons have a non-empty schedule string', () => {
      for (const cron of crons) {
        expect(cron.schedule, `${cron.path} has empty schedule`).toBeTruthy();
        expect(typeof cron.schedule).toBe('string');
      }
    });

    it('all schedule strings match cron expression format (5-part)', () => {
      for (const cron of crons) {
        expect(
          cronRegex.test(cron.schedule),
          `${cron.path} has invalid cron schedule: "${cron.schedule}"`,
        ).toBe(true);
      }
    });

    it('no duplicate cron paths exist in the registry', () => {
      const unique = new Set(registeredPaths);
      expect(unique.size).toBe(registeredPaths.length);
    });
  });

  // ---------------------------------------------------------------------------
  // Registered cron routes exist as files
  // ---------------------------------------------------------------------------

  describe('registered cron routes exist as files', () => {
    const newCronPaths = [
      '/api/cron/audit',
      '/api/cron/sov',
      '/api/cron/citation',
      '/api/cron/content-audit',
    ];

    it.each(newCronPaths)('%s route file exists on disk', (cronPath) => {
      const filePath = path.resolve(process.cwd(), 'app', ...cronPath.split('/').slice(1), 'route.ts');
      expect(fs.existsSync(filePath), `Missing route file: ${filePath}`).toBe(true);
    });
  });
});
