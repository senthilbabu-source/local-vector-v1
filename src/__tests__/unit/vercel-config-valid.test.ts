/**
 * Unit Tests — vercel.json Configuration Validity (P7-FIX-31)
 *
 * Ensures vercel.json is valid, cron paths map to real route files,
 * and there are no duplicate cron schedules on the same path.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/vercel-config-valid.test.ts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const vercelPath = join(process.cwd(), 'vercel.json');
let vercelConfig: { crons?: Array<{ path: string; schedule: string }> };

try {
  vercelConfig = JSON.parse(readFileSync(vercelPath, 'utf-8'));
} catch {
  vercelConfig = {};
}

describe('vercel.json configuration (P7-FIX-31)', () => {
  it('is valid JSON', () => {
    expect(() => JSON.parse(readFileSync(vercelPath, 'utf-8'))).not.toThrow();
  });

  it('has a crons array', () => {
    expect(vercelConfig.crons).toBeDefined();
    expect(Array.isArray(vercelConfig.crons)).toBe(true);
  });

  it('has no duplicate cron paths', () => {
    const paths = vercelConfig.crons?.map((c) => c.path) ?? [];
    const uniquePaths = new Set(paths);
    expect(paths.length).toBe(uniquePaths.size);
  });

  it('every cron path starts with /api/cron/', () => {
    for (const cron of vercelConfig.crons ?? []) {
      expect(cron.path).toMatch(/^\/api\/cron\//);
    }
  });

  it('every cron path maps to a route.ts file', () => {
    const missing: string[] = [];
    for (const cron of vercelConfig.crons ?? []) {
      // /api/cron/audit → app/api/cron/audit/route.ts
      const routeFile = join(process.cwd(), 'app', ...cron.path.split('/').slice(1), 'route.ts');
      if (!existsSync(routeFile)) {
        missing.push(`${cron.path} → ${routeFile}`);
      }
    }
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('Missing route files:', missing);
    }
    expect(missing).toEqual([]);
  });

  it('every cron has a valid cron schedule format', () => {
    // Basic cron format: 5 space-separated fields
    const cronRegex = /^(\S+\s+){4}\S+$/;
    for (const cron of vercelConfig.crons ?? []) {
      expect(cron.schedule).toMatch(cronRegex);
    }
  });
});
