/**
 * npm-audit.test.ts — Security version guard tests
 *
 * Reads package.json and package-lock.json to verify that known-vulnerable
 * package versions are not present. Fails loudly if a dependency is ever
 * downgraded to a vulnerable version in the future.
 *
 * CVEs guarded:
 *   - @modelcontextprotocol/sdk < 1.27.0 (GHSA-345p-7cg4-v4c7 — cross-client data leak)
 *   - minimatch < 9.0.8 (GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 — ReDoS)
 *   - rollup < 4.58.1 (GHSA-mw96-cpmx-2vgc — arbitrary file write)
 *
 * Run:
 *   npx vitest run src/__tests__/unit/npm-audit.test.ts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Parse a semver string like "1.27.1" into [major, minor, patch].
 */
function parseSemver(version: string): [number, number, number] {
  const clean = version.replace(/^[^0-9]*/, '');
  const parts = clean.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Returns true if `version` is >= `minimum`.
 */
function isAtLeast(version: string, minimum: string): boolean {
  const [aMaj, aMin, aPat] = parseSemver(version);
  const [bMaj, bMin, bPat] = parseSemver(minimum);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat >= bPat;
}

describe('npm security audit — version guards', () => {
  it('@modelcontextprotocol/sdk is at patched version (>= 1.27.0)', () => {
    const lockPath = path.join(ROOT, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));

    // Check node_modules path in lockfile v3 format
    const entry =
      lock.packages?.['node_modules/@modelcontextprotocol/sdk'] ??
      lock.dependencies?.['@modelcontextprotocol/sdk'];

    expect(entry).toBeDefined();

    const version = entry.version ?? entry;
    expect(isAtLeast(version, '1.27.0')).toBe(true);
  });

  it('minimatch is at patched version (>= 9.0.8)', () => {
    const lockPath = path.join(ROOT, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));

    const entry =
      lock.packages?.['node_modules/minimatch'] ??
      lock.dependencies?.['minimatch'];

    expect(entry).toBeDefined();

    const version = entry.version ?? entry;
    expect(isAtLeast(version, '9.0.8')).toBe(true);
  });

  it('rollup is at patched version (>= 4.58.1)', () => {
    const lockPath = path.join(ROOT, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));

    const entry =
      lock.packages?.['node_modules/rollup'] ??
      lock.dependencies?.['rollup'];

    expect(entry).toBeDefined();

    const version = entry.version ?? entry;
    expect(isAtLeast(version, '4.58.1')).toBe(true);
  });
});
