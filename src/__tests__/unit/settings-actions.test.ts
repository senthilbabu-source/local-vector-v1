// ---------------------------------------------------------------------------
// settings-actions.test.ts — Unit tests for Sprint 24B Settings Server Actions
//
// Tests app/dashboard/settings/actions.ts:
//   • updateDisplayName — auth gate, Zod min-length, Zod max-length, DB success, DB error
//   • changePassword    — auth gate, min 8 chars, confirm mismatch, auth error, success
//
// Strategy:
//   • Supabase client, auth context, and next/cache mocked via vi.mock() (hoisted).
//   • No live DB or Supabase calls — pure unit tests.
//
// Run:
//   npx vitest run src/__tests__/unit/settings-actions.test.ts
// ---------------------------------------------------------------------------

// ── Hoist vi.mock declarations BEFORE any imports (AI_RULES §4) ───────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSafeAuthContext: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ── Imports after mock declarations ──────────────────────────────────────

import { updateDisplayName, changePassword } from '@/app/dashboard/settings/actions';
import { createClient } from '@/lib/supabase/server';
import { getSafeAuthContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ── Shared fixtures ───────────────────────────────────────────────────────

const MOCK_AUTH = {
  orgId:    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  userId:   'auth-uid-abc123',
  email:    'jane@example.com',
  fullName: 'Jane Doe',
  orgName:  'Charcoal N Chill',
  plan:     'growth',
  role:     'owner',
  onboarding_completed: true,
};

// ── Mock factory ──────────────────────────────────────────────────────────
//
// Builds a fake Supabase client with:
//   .from().update().eq() chain → resolves dbResult
//   .auth.updateUser()          → resolves authResult

function mockSupabase(
  dbResult:   { error: null | { message: string } } = { error: null },
  authResult: { error: null | { message: string } } = { error: null },
) {
  const eq     = vi.fn().mockResolvedValue(dbResult);
  const update = vi.fn().mockReturnValue({ eq });
  const mockFrom = vi.fn().mockReturnValue({ update });
  const mockAuthUpdateUser = vi.fn().mockResolvedValue(authResult);

  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
    from: mockFrom,
    auth: { updateUser: mockAuthUpdateUser },
  });

  return { mockFrom, mockAuthUpdateUser };
}

// ── updateDisplayName ─────────────────────────────────────────────────────

describe('updateDisplayName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when not authenticated', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const form = new FormData();
    form.set('displayName', 'Jane Doe');

    const result = await updateDisplayName(form);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error when displayName is too short (< 2 chars)', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const form = new FormData();
    form.set('displayName', 'J');

    const result = await updateDisplayName(form);

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/2 characters/);
  });

  it('returns validation error when displayName exceeds 80 chars', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const form = new FormData();
    form.set('displayName', 'A'.repeat(81));

    const result = await updateDisplayName(form);

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/80/);
  });

  it('returns success and calls revalidatePath on valid update', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ error: null });
    const form = new FormData();
    form.set('displayName', 'Jane Doe');

    const result = await updateDisplayName(form);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('propagates DB error message on failure', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ error: { message: 'DB connection failed' } });
    const form = new FormData();
    form.set('displayName', 'Jane Doe');

    const result = await updateDisplayName(form);

    expect(result).toEqual({ success: false, error: 'DB connection failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ── changePassword ────────────────────────────────────────────────────────

describe('changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns Unauthorized when not authenticated', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const form = new FormData();
    form.set('password', 'newpass123');
    form.set('confirmPassword', 'newpass123');

    const result = await changePassword(form);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  it('returns validation error when password is too short (< 8 chars)', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const form = new FormData();
    form.set('password', 'abc123');
    form.set('confirmPassword', 'abc123');

    const result = await changePassword(form);

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/8 characters/);
  });

  it('returns validation error when passwords do not match', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase();
    const form = new FormData();
    form.set('password', 'newpass123');
    form.set('confirmPassword', 'different123');

    const result = await changePassword(form);

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/match/i);
  });

  it('propagates Supabase auth error on updateUser failure', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ error: null }, { error: { message: 'Auth service unavailable' } });
    const form = new FormData();
    form.set('password', 'newpass123');
    form.set('confirmPassword', 'newpass123');

    const result = await changePassword(form);

    expect(result).toEqual({ success: false, error: 'Auth service unavailable' });
  });

  it('returns success and does NOT call revalidatePath on valid password change', async () => {
    (getSafeAuthContext as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_AUTH);
    mockSupabase({ error: null }, { error: null });
    const form = new FormData();
    form.set('password', 'newpass123');
    form.set('confirmPassword', 'newpass123');

    const result = await changePassword(form);

    expect(result).toEqual({ success: true });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
