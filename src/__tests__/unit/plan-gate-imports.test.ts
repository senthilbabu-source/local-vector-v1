// ---------------------------------------------------------------------------
// plan-gate-imports.test.ts — Named import enforcement for plan-gate components
//
// Sprint FIX-3: All components in components/plan-gate/ use named exports.
// A default import compiles in some TS configs but crashes at runtime with RSCs.
// This test statically verifies no file uses `import PlanGate from` (default).
//
// Run:
//   npx vitest run src/__tests__/unit/plan-gate-imports.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

// Scan all .tsx and .ts files under app/ and components/ for PlanGate imports
const projectRoot = process.cwd();
const sourceFiles = globSync('{app,components,lib}/**/*.{ts,tsx}', { cwd: projectRoot });

// ---------------------------------------------------------------------------
// Collect all import statements for PlanGate
// ---------------------------------------------------------------------------

interface ImportMatch {
  file: string;
  line: number;
  text: string;
  isDefault: boolean;
}

function findPlanGateImports(): ImportMatch[] {
  const matches: ImportMatch[] = [];

  for (const relPath of sourceFiles) {
    const filePath = path.join(projectRoot, relPath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match import statements that reference PlanGate
      if (/import\s+.*PlanGate/.test(line)) {
        // Default import pattern: import PlanGate from '...'
        const isDefault = /import\s+PlanGate\s+from/.test(line);
        matches.push({
          file: relPath,
          line: i + 1,
          text: line.trim(),
          isDefault,
        });
      }
    }
  }

  return matches;
}

const allImports = findPlanGateImports();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanGate import enforcement — named exports only (AI_RULES §66)', () => {
  it('no file uses default import for PlanGate', () => {
    const defaultImports = allImports.filter((m) => m.isDefault);
    if (defaultImports.length > 0) {
      const details = defaultImports
        .map((m) => `  ${m.file}:${m.line} → ${m.text}`)
        .join('\n');
      expect.fail(
        `Found ${defaultImports.length} default import(s) of PlanGate (must use { PlanGate }):\n${details}`,
      );
    }
  });

  it('all PlanGate imports use destructured (named) pattern', () => {
    const namedImports = allImports.filter((m) => !m.isDefault);
    // At least one file should import PlanGate (sanity check)
    expect(namedImports.length).toBeGreaterThan(0);
    for (const imp of namedImports) {
      expect(imp.text).toMatch(/import\s*\{[^}]*PlanGate[^}]*\}\s*from/);
    }
  });

  it('PlanGate.tsx exports PlanGate as a named export', () => {
    const planGatePath = path.join(projectRoot, 'components/plan-gate/PlanGate.tsx');
    const content = fs.readFileSync(planGatePath, 'utf-8');
    // Must have named export (export function PlanGate or export const PlanGate)
    expect(content).toMatch(/export\s+(function|const)\s+PlanGate/);
    // Must NOT have default export
    expect(content).not.toMatch(/export\s+default\s+(function\s+)?PlanGate/);
  });

  it('locations settings page uses { PlanGate } named import', () => {
    const locationsPath = path.join(
      projectRoot,
      'app/dashboard/settings/locations/page.tsx',
    );
    const content = fs.readFileSync(locationsPath, 'utf-8');
    expect(content).toMatch(/import\s*\{\s*PlanGate\s*\}\s*from/);
  });
});
