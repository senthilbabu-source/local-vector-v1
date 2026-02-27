// ---------------------------------------------------------------------------
// env-completeness.test.ts — Verifies .env.local.example documents all env vars
//
// Sprint FIX-4: Scans production source files (app/, lib/) for process.env.X
// references and ensures every variable is documented in .env.local.example.
//
// Run:
//   npx vitest run src/__tests__/unit/env-completeness.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../../..');
const ENV_EXAMPLE_PATH = path.join(ROOT, '.env.local.example');

let envExampleContent = '';
let envExampleVars: Set<string>;

/** Recursively find all .ts/.tsx files in a directory, excluding tests. */
function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test directories and node_modules
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      results.push(...findSourceFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      // Skip test files
      if (/\.test\.|\.spec\./.test(entry.name)) continue;
      results.push(fullPath);
    }
  }
  return results;
}

/** Extract all process.env.VAR_NAME references from source files. */
function extractEnvVars(files: string[]): Set<string> {
  const vars = new Set<string>();
  const regex = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }
  }
  return vars;
}

/** Extract variable names defined in .env.local.example. */
function extractExampleVars(content: string): Set<string> {
  const vars = new Set<string>();
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match) vars.add(match[1]);
  }
  return vars;
}

// ── Well-known exclusions ────────────────────────────────────────────────
// Standard Next.js/Node env vars that are NOT user-configured:
const STANDARD_ENV_VARS = new Set([
  'NODE_ENV',
]);

// Variables where the documented name covers an alternative key:
// UPSTASH_REDIS_REST_URL is a synonym for KV_REST_API_URL (both documented)
// UPSTASH_REDIS_REST_TOKEN is a synonym for KV_REST_API_TOKEN (both documented)
// The env file documents both, so no special handling needed.

// ── Setup ────────────────────────────────────────────────────────────────

beforeAll(() => {
  envExampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
  envExampleVars = extractExampleVars(envExampleContent);
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('.env.local.example completeness', () => {
  describe('critical required variables are documented', () => {
    it('CRON_SECRET is documented in .env.local.example', () => {
      expect(envExampleVars.has('CRON_SECRET')).toBe(true);
    });

    it('GOOGLE_CLIENT_ID is documented', () => {
      expect(envExampleVars.has('GOOGLE_CLIENT_ID')).toBe(true);
    });

    it('GOOGLE_CLIENT_SECRET is documented', () => {
      expect(envExampleVars.has('GOOGLE_CLIENT_SECRET')).toBe(true);
    });

    it('ANTHROPIC_API_KEY is documented', () => {
      expect(envExampleVars.has('ANTHROPIC_API_KEY')).toBe(true);
    });

    it('GOOGLE_GENERATIVE_AI_API_KEY is documented', () => {
      expect(envExampleVars.has('GOOGLE_GENERATIVE_AI_API_KEY')).toBe(true);
    });

    it('UPSTASH_REDIS_REST_URL is documented', () => {
      expect(envExampleVars.has('UPSTASH_REDIS_REST_URL')).toBe(true);
    });

    it('UPSTASH_REDIS_REST_TOKEN is documented', () => {
      expect(envExampleVars.has('UPSTASH_REDIS_REST_TOKEN')).toBe(true);
    });
  });

  describe('cron kill switch variables are documented', () => {
    it('STOP_AUDIT_CRON is documented', () => {
      expect(envExampleVars.has('STOP_AUDIT_CRON')).toBe(true);
    });

    it('STOP_SOV_CRON is documented', () => {
      expect(envExampleVars.has('STOP_SOV_CRON')).toBe(true);
    });

    it('STOP_CITATION_CRON is documented', () => {
      expect(envExampleVars.has('STOP_CITATION_CRON')).toBe(true);
    });

    it('STOP_DIGEST_CRON is documented', () => {
      expect(envExampleVars.has('STOP_DIGEST_CRON')).toBe(true);
    });

    it('STOP_CONTENT_AUDIT_CRON is documented', () => {
      expect(envExampleVars.has('STOP_CONTENT_AUDIT_CRON')).toBe(true);
    });

    it('STOP_PLACES_REFRESH_CRON is documented', () => {
      expect(envExampleVars.has('STOP_PLACES_REFRESH_CRON')).toBe(true);
    });

    it('STOP_TOKEN_REFRESH_CRON is documented', () => {
      expect(envExampleVars.has('STOP_TOKEN_REFRESH_CRON')).toBe(true);
    });
  });

  describe('all production env vars are documented', () => {
    it('every process.env.X reference in app/ and lib/ is present in .env.local.example', () => {
      const appFiles = findSourceFiles(path.join(ROOT, 'app'));
      const libFiles = findSourceFiles(path.join(ROOT, 'lib'));
      const allFiles = [...appFiles, ...libFiles];

      const referencedVars = extractEnvVars(allFiles);

      // Filter out standard env vars that don't need documentation
      const undocumented: string[] = [];
      for (const varName of referencedVars) {
        if (STANDARD_ENV_VARS.has(varName)) continue;
        if (!envExampleVars.has(varName)) {
          undocumented.push(varName);
        }
      }

      expect(
        undocumented,
        `The following env vars are referenced in production code but missing from .env.local.example:\n` +
        undocumented.map((v) => `  - ${v}`).join('\n') +
        `\n\nAdd them to .env.local.example with a placeholder value and comment.`
      ).toEqual([]);
    });
  });
});
