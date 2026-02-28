// ---------------------------------------------------------------------------
// src/__tests__/unit/sentry-sweep-verification.test.ts
//
// Sprint K (C1 verification): Ensures zero bare `} catch {` blocks remain
// in production code (app/ and lib/ directories).
//
// This is a code-quality regression test that runs grep to verify
// Sprint A's Sentry sweep was completed (Sprint K fixed the final 4 gaps).
//
// Run:
//   npx vitest run src/__tests__/unit/sentry-sweep-verification.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('C1 — Sentry coverage: zero bare catch {} blocks', () => {
  it('no bare } catch { in app/ directory', () => {
    const result = execSync(
      'grep -rn "} catch {" app/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v ".spec." || true',
      { encoding: 'utf-8', cwd: process.cwd() },
    );
    const lines = result
      .trim()
      .split('\n')
      .filter(Boolean);
    expect(lines).toHaveLength(0);
  });

  it('no bare } catch { in lib/ directory', () => {
    const result = execSync(
      'grep -rn "} catch {" lib/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v ".spec." || true',
      { encoding: 'utf-8', cwd: process.cwd() },
    );
    const lines = result
      .trim()
      .split('\n')
      .filter(Boolean);
    expect(lines).toHaveLength(0);
  });
});
