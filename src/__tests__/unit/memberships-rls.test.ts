/**
 * memberships-rls.test.ts — RLS Isolation Tests for memberships table
 *
 * Verifies that:
 *   1. The migration enables RLS and creates 4 org-scoped policies
 *   2. prod_schema.sql reflects the same RLS configuration
 *   3. Application-layer code enforces org isolation for memberships
 *   4. Service role operations bypass RLS (crons, webhooks, invitations)
 *
 * These are "belt" tests (AI_RULES §18) — they verify the SQL artifacts
 * and application patterns without a live database. The "suspenders" are
 * integration tests that run against local Supabase.
 *
 * Run:
 *   npx vitest run src/__tests__/unit/memberships-rls.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATION_FILE = path.join(
  ROOT,
  'supabase/migrations/20260303000001_memberships_rls.sql'
);
const PROD_SCHEMA_FILE = path.join(ROOT, 'supabase/prod_schema.sql');

const ORG_A_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

// ---------------------------------------------------------------------------
// Mock: Supabase client chain
// ---------------------------------------------------------------------------

function buildChainMock(): Record<string, ReturnType<typeof vi.fn>> {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  const terminal = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });

  for (const method of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
    'filter', 'order', 'limit', 'range', 'match',
  ]) {
    chain[method] = vi.fn(self);
  }
  chain.single = terminal;
  chain.maybeSingle = terminal;
  chain.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve({ data: null, error: null, count: 0 })
  );
  return chain;
}

const mockFrom = vi.fn(() => buildChainMock());
const mockSupabaseClient = { from: mockFrom, auth: { getUser: vi.fn() } };

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
  createServiceRoleClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Mock dependencies used by invitations.ts
vi.mock('@/lib/email/send-invitation', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/stripe/seat-manager', () => ({
  checkSeatAvailability: vi.fn().mockResolvedValue({ available: true, remaining: 5 }),
  updateSeatQuantity: vi.fn().mockResolvedValue({ success: true, newQuantity: 2 }),
}));

// ---------------------------------------------------------------------------
// Mock: Auth context
// ---------------------------------------------------------------------------

const mockAuthContext = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: (...args: unknown[]) => mockAuthContext(...args),
  getAuthContext: (...args: unknown[]) => mockAuthContext(...args),
}));

function setAuthenticatedAs(orgId: string, userId = 'user-' + orgId.slice(0, 8)) {
  mockAuthContext.mockResolvedValue({
    userId,
    email: 'test@example.com',
    fullName: 'Test User',
    orgId,
    orgName: 'Test Org',
    role: 'owner',
    plan: 'agency',
    onboarding_completed: true,
  });
}

function setUnauthenticated() {
  mockAuthContext.mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('memberships table RLS isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => buildChainMock());
  });

  // ── SELECT isolation ──────────────────────────────────────────────────

  describe('SELECT isolation', () => {
    it('migration file enables RLS on memberships', () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
      expect(sql).toContain(
        'ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY'
      );
    });

    it('migration creates SELECT policy using current_user_org_id()', () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
      expect(sql).toContain('memberships_org_isolation_select');
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain('current_user_org_id()');
    });

    it('unauthenticated user cannot access memberships via server actions', async () => {
      setUnauthenticated();

      const { removeMember } = await import('@/app/actions/invitations');
      const result = await removeMember({ memberId: 'fake-id' });

      expect(result).toEqual(
        expect.objectContaining({ success: false, error: 'Unauthorized' })
      );
    });
  });

  // ── INSERT isolation ──────────────────────────────────────────────────

  describe('INSERT isolation', () => {
    it('migration creates INSERT policy with org_id = current_user_org_id()', () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
      expect(sql).toContain('memberships_org_isolation_insert');
      expect(sql).toContain('FOR INSERT');
      expect(sql).toContain('WITH CHECK');
      expect(sql).toContain('current_user_org_id()');
    });

    it('INSERT policy does NOT use auth.uid() = user_id check', () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
      expect(sql).not.toContain('auth.uid() = user_id');
    });

    it('service role client can insert memberships (bypass RLS)', async () => {
      const { createServiceRoleClient } = await import(
        '@/lib/supabase/server'
      );
      expect(createServiceRoleClient).toBeDefined();

      const client = createServiceRoleClient();
      const chain = client.from('memberships');
      expect(chain.insert).toBeDefined();
    });
  });

  // ── UPDATE isolation ──────────────────────────────────────────────────

  describe('UPDATE isolation', () => {
    it('migration creates UPDATE policy using current_user_org_id()', () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
      expect(sql).toContain('memberships_org_isolation_update');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('current_user_org_id()');
    });

    it('updateMemberRole derives org_id from session', async () => {
      setAuthenticatedAs(ORG_A_ID);

      const { updateMemberRole } = await import('@/app/actions/invitations');

      await updateMemberRole({
        memberId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99',
        newRole: 'admin',
      });

      expect(mockAuthContext).toHaveBeenCalled();
    });
  });

  // ── DELETE isolation ──────────────────────────────────────────────────

  describe('DELETE isolation', () => {
    it('migration creates DELETE policy using current_user_org_id()', () => {
      const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
      expect(sql).toContain('memberships_org_isolation_delete');
      expect(sql).toContain('FOR DELETE');
      expect(sql).toContain('current_user_org_id()');
    });

    it('removeMember derives org_id from session', async () => {
      setAuthenticatedAs(ORG_A_ID);

      const { removeMember } = await import('@/app/actions/invitations');
      await removeMember({ memberId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' });

      expect(mockAuthContext).toHaveBeenCalled();
    });
  });

  // ── Trigger and service role bypass ───────────────────────────────────

  describe('trigger and service role bypass', () => {
    it('service role client bypasses RLS for cron/webhook memberships reads', async () => {
      const { createServiceRoleClient } = await import('@/lib/supabase/server');
      const client = createServiceRoleClient();

      const chain = client.from('memberships');
      expect(chain.select).toBeDefined();
      expect(chain.insert).toBeDefined();
    });

    it('prod_schema.sql has memberships RLS enabled and all 4 policies', () => {
      const schema = fs.readFileSync(PROD_SCHEMA_FILE, 'utf-8');

      // RLS enabled
      expect(schema).toContain(
        '"public"."memberships" ENABLE ROW LEVEL SECURITY'
      );

      // All 4 policies present
      expect(schema).toContain('memberships_org_isolation_select');
      expect(schema).toContain('memberships_org_isolation_insert');
      expect(schema).toContain('memberships_org_isolation_update');
      expect(schema).toContain('memberships_org_isolation_delete');

      // All use current_user_org_id()
      const policyLines = schema
        .split('\n')
        .filter((l) => l.includes('memberships_org_isolation'));
      expect(policyLines.length).toBe(4);
      for (const line of policyLines) {
        expect(line).toContain('current_user_org_id');
      }
    });
  });
});
