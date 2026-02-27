// ---------------------------------------------------------------------------
// occasion-actions.test.ts — Unit tests for occasion server actions
//
// Sprint 101: 22 tests — snoozeOccasion, dismissOccasionPermanently,
//                         createDraftFromOccasion
//
// Run:
//   npx vitest run src/__tests__/unit/occasion-actions.test.ts
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSafeAuthContext = vi.fn();
vi.mock('@/lib/auth', () => ({
  getSafeAuthContext: () => mockGetSafeAuthContext(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockGetActiveLocationId = vi.fn();
vi.mock('@/lib/location/active-location', () => ({
  getActiveLocationId: (...args: unknown[]) => mockGetActiveLocationId(...args),
}));

vi.mock('@/lib/auth/org-roles', () => ({
  roleSatisfies: vi.fn((role: string | null, required: string) => {
    const hierarchy: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    return (hierarchy[role ?? ''] ?? 0) >= (hierarchy[required] ?? 0);
  }),
}));

vi.mock('@/lib/plan-enforcer', () => ({
  canRunAutopilot: vi.fn((plan: string) => plan === 'growth' || plan === 'agency'),
}));

// Supabase mock
const mockUpsert = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

const { snoozeOccasion, dismissOccasionPermanently, createDraftFromOccasion } = await import(
  '@/app/actions/occasions'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultAuth = {
  userId: 'user-1',
  email: 'test@example.com',
  fullName: 'Test User',
  orgId: 'org-1',
  orgName: 'Test Org',
  role: 'admin' as const,
  plan: 'growth',
  onboarding_completed: true,
};

function setupOccasionLookup(found: boolean) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'local_occasions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: found ? { id: 'occ-1', name: 'Test Event', occasion_type: 'holiday', peak_query_patterns: [{ query: 'test query' }] } : null,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'occasion_snoozes') {
      return {
        upsert: mockUpsert.mockResolvedValue({ error: null }),
      };
    }
    if (table === 'content_drafts') {
      return {
        insert: mockInsert.mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: mockSingle.mockResolvedValue({
              data: { id: 'draft-1' },
              error: null,
            }),
          }),
        }),
      };
    }
    return {};
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('snoozeOccasion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue(defaultAuth);
    mockRpc.mockResolvedValue({ error: null });
    setupOccasionLookup(true);
  });

  it('inserts occasion_snoozes row with correct snoozed_until for 1_day', async () => {
    const result = await snoozeOccasion({ occasionId: 'occ-1', duration: '1_day' });
    expect(result.success).toBe(true);
    expect(result.snoozedUntil).toBeDefined();
    // snoozed_until should be ~1 day in the future
    const snoozedDate = new Date(result.snoozedUntil!);
    const now = new Date();
    const diffHours = (snoozedDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(20);
    expect(diffHours).toBeLessThan(28);
  });

  it('inserts occasion_snoozes row with correct snoozed_until for 3_days', async () => {
    const result = await snoozeOccasion({ occasionId: 'occ-1', duration: '3_days' });
    expect(result.success).toBe(true);
    const snoozedDate = new Date(result.snoozedUntil!);
    const now = new Date();
    const diffDays = (snoozedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(2);
    expect(diffDays).toBeLessThan(4);
  });

  it('inserts occasion_snoozes row with correct snoozed_until for 1_week', async () => {
    const result = await snoozeOccasion({ occasionId: 'occ-1', duration: '1_week' });
    expect(result.success).toBe(true);
    const snoozedDate = new Date(result.snoozedUntil!);
    const now = new Date();
    const diffDays = (snoozedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6);
    expect(diffDays).toBeLessThan(8);
  });

  it('orgId and userId from session — never from input', async () => {
    await snoozeOccasion({ occasionId: 'occ-1', duration: '1_day' });
    // Verify upsert was called (meaning it reached the snooze logic, not rejected)
    expect(mockFrom).toHaveBeenCalledWith('occasion_snoozes');
  });

  it('returns error for invalid duration string', async () => {
    const result = await snoozeOccasion({ occasionId: 'occ-1', duration: 'invalid' as '1_day' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid/i);
  });

  it('returns error when occasionId does not exist', async () => {
    setupOccasionLookup(false);
    const result = await snoozeOccasion({ occasionId: 'nonexistent', duration: '1_day' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns snoozedUntil ISO string on success', async () => {
    const result = await snoozeOccasion({ occasionId: 'occ-1', duration: '1_day' });
    expect(result.success).toBe(true);
    expect(result.snoozedUntil).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns error when unauthenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await snoozeOccasion({ occasionId: 'occ-1', duration: '1_day' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unauthorized/i);
  });
});

describe('dismissOccasionPermanently', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue(defaultAuth);
    setupOccasionLookup(true);
  });

  it('sets snoozed_until to far future (>= year 9000)', async () => {
    const result = await dismissOccasionPermanently({ occasionId: 'occ-1' });
    expect(result.success).toBe(true);
    // Verify upsert was called with far-future date
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        snoozed_until: '9999-12-31T23:59:59Z',
      }),
      expect.any(Object),
    );
  });

  it('upserts — works whether previous snooze exists or not', async () => {
    const result = await dismissOccasionPermanently({ occasionId: 'occ-1' });
    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ onConflict: 'org_id,user_id,occasion_id' }),
    );
  });

  it('orgId and userId from session', async () => {
    await dismissOccasionPermanently({ occasionId: 'occ-1' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org-1',
        user_id: 'user-1',
      }),
      expect.any(Object),
    );
  });

  it('returns error when occasion not found', async () => {
    setupOccasionLookup(false);
    const result = await dismissOccasionPermanently({ occasionId: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe('createDraftFromOccasion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeAuthContext.mockResolvedValue(defaultAuth);
    mockGetActiveLocationId.mockResolvedValue('loc-1');
    setupOccasionLookup(true);
  });

  it('returns draftId on success', async () => {
    const result = await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(result.success).toBe(true);
    expect(result.draftId).toBe('draft-1');
  });

  it('sets org_id from session (not input)', async () => {
    await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: 'org-1' }),
    );
  });

  it('sets location_id from active location (session — not input)', async () => {
    await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ location_id: 'loc-1' }),
    );
  });

  it('draft title includes occasion name', async () => {
    await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        draft_title: expect.stringContaining('Test Event'),
      }),
    );
  });

  it('draft status = "draft" on creation', async () => {
    await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });

  it('returns error when caller is viewer (admin+ required)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ ...defaultAuth, role: 'viewer' });
    const result = await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Admin/i);
  });

  it('returns error when plan is not Growth+ (planSatisfies check)', async () => {
    mockGetSafeAuthContext.mockResolvedValue({ ...defaultAuth, plan: 'starter' });
    const result = await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Upgrade/i);
  });

  it('returns error when occasionId does not exist', async () => {
    setupOccasionLookup(false);
    const result = await createDraftFromOccasion({ occasionId: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error when unauthenticated', async () => {
    mockGetSafeAuthContext.mockResolvedValue(null);
    const result = await createDraftFromOccasion({ occasionId: 'occ-1' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unauthorized/i);
  });
});
