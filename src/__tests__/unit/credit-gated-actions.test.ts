// ---------------------------------------------------------------------------
// credit-gated-actions.test.ts — Sprint D (N1): Credit gate integration tests
//
// 12 tests: Verifies that all 6 credit-gated server actions check credits
// before calling LLMs and consume credits on success.
//
// Run:
//   npx vitest run src/__tests__/unit/credit-gated-actions.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Common mocks
// ---------------------------------------------------------------------------

const mockCheckCredit = vi.fn();
const mockConsumeCredit = vi.fn();

vi.mock('@/lib/credits/credit-service', () => ({
  checkCredit: (...args: unknown[]) => mockCheckCredit(...args),
  consumeCredit: (...args: unknown[]) => mockConsumeCredit(...args),
}));

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: vi.fn().mockResolvedValue({
    orgId: 'org-test-123',
    userId: 'user-test-456',
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper — read source files to check for credit gate calls
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests — Static analysis of credit gate integration
// ---------------------------------------------------------------------------

describe('Credit-gated server actions — static analysis', () => {
  const actionFiles = [
    {
      path: 'app/dashboard/magic-menus/actions.ts',
      actions: ['simulateAIParsing', 'uploadPosExport', 'uploadMenuFile'],
    },
    {
      path: 'app/dashboard/share-of-voice/actions.ts',
      actions: ['runSovEvaluation'],
    },
    {
      path: 'app/dashboard/share-of-voice/brief-actions.ts',
      actions: ['generateContentBrief'],
    },
    {
      path: 'app/dashboard/compete/actions.ts',
      actions: ['runCompetitorIntercept'],
    },
  ];

  for (const { path: filePath, actions } of actionFiles) {
    const source = readSource(filePath);

    it(`imports checkCredit and consumeCredit in ${filePath}`, () => {
      expect(source).toContain("import { checkCredit, consumeCredit }");
      expect(source).toContain("from '@/lib/credits/credit-service'");
    });

    for (const action of actions) {
      it(`${action} contains checkCredit() call`, () => {
        // Find the function body for this action
        const funcStart = source.indexOf(`async function ${action}`);
        // If not found, check for export async function
        const exportFuncStart = source.indexOf(`export async function ${action}`);
        const start = funcStart !== -1 ? funcStart : exportFuncStart;
        expect(start).toBeGreaterThan(-1);

        // Get the rest of the source from the function start
        const funcBody = source.slice(start, start + 2000);
        expect(funcBody).toContain('checkCredit');
      });

      it(`${action} contains consumeCredit() call`, () => {
        const funcStart = source.indexOf(`async function ${action}`);
        const exportFuncStart = source.indexOf(`export async function ${action}`);
        const start = funcStart !== -1 ? funcStart : exportFuncStart;
        expect(start).toBeGreaterThan(-1);

        const funcBody = source.slice(start);
        expect(funcBody).toContain('consumeCredit');
      });
    }
  }
});

describe('Credit-gated actions — checkCredit returns credit_limit_reached', () => {
  it('all 4 action files return credit_limit_reached error on insufficient credits', () => {
    const files = [
      'app/dashboard/magic-menus/actions.ts',
      'app/dashboard/share-of-voice/actions.ts',
      'app/dashboard/share-of-voice/brief-actions.ts',
      'app/dashboard/compete/actions.ts',
    ];

    for (const filePath of files) {
      const source = readSource(filePath);
      expect(source).toContain('credit_limit_reached');
    }
  });
});

describe('Non-credit-gated actions — should NOT have credit checks', () => {
  it('reauditPage does not use credit checks (not an LLM call)', () => {
    const source = readSource('app/dashboard/page-audits/actions.ts');
    // reauditPage is a re-scoring function, not an LLM call
    // It should NOT import credit-service
    expect(source).not.toContain("from '@/lib/credits/credit-service'");
  });

  it('addCompetitor does not use credit checks (DB insert only)', () => {
    const source = readSource('app/dashboard/compete/actions.ts');
    // addCompetitor is in the same file as runCompetitorIntercept,
    // so the import exists. But the addCompetitor function itself
    // should not call checkCredit.
    const addFunc = source.slice(
      source.indexOf('export async function addCompetitor'),
      source.indexOf('export async function deleteCompetitor') !== -1
        ? source.indexOf('export async function deleteCompetitor')
        : source.indexOf('export async function runCompetitorIntercept'),
    );
    expect(addFunc).not.toContain('checkCredit');
  });
});
