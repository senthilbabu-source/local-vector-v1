/**
 * Activity Log Service — Unit Tests
 *
 * 20 tests covering logActivity, convenience wrappers, and getActivityLog.
 * Supabase is mocked with chainable method helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  logActivity,
  logInviteSent,
  logInviteAccepted,
  logInviteRevoked,
  logMemberRemoved,
  logSeatSync,
  getActivityLog,
} from '@/lib/billing/activity-log-service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createInsertMock(
  returnData: Record<string, unknown> | null = null,
  error: { message: string } | null = null
) {
  const mockSingle = vi.fn().mockResolvedValue({ data: returnData, error });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
  return {
    supabase: { from: mockFrom } as unknown as SupabaseClient<Database>,
    mockInsert,
    mockFrom,
  };
}

function createSelectMock(
  data: Record<string, unknown>[] = [],
  count: number = 0
) {
  const mockRange = vi.fn().mockResolvedValue({ data, error: null, count });
  const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
  const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  return {
    supabase: { from: mockFrom } as unknown as SupabaseClient<Database>,
    mockSelect,
    mockRange,
    mockEq,
    mockOrder,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ACTOR_USER_ID = '00000000-0000-0000-0000-000000000002';
const ACTOR_EMAIL = 'admin@example.com';
const TARGET_USER_ID = '00000000-0000-0000-0000-000000000003';
const TARGET_EMAIL = 'invitee@example.com';
const INVITATION_ID = '00000000-0000-0000-0000-000000000099';

function makeLogEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    org_id: ORG_ID,
    event_type: 'member_invited',
    actor_user_id: ACTOR_USER_ID,
    actor_email: ACTOR_EMAIL,
    target_user_id: null,
    target_email: TARGET_EMAIL,
    target_role: 'viewer',
    metadata: { invitation_id: INVITATION_ID },
    created_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// logActivity — Supabase mocked (service role)
// ---------------------------------------------------------------------------

describe('logActivity — Supabase mocked (service role)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. INSERT called with correct org_id and event_type', async () => {
    const row = makeLogEntry();
    const { supabase, mockInsert, mockFrom } = createInsertMock(row);

    await logActivity(supabase, {
      org_id: ORG_ID,
      event_type: 'member_invited',
      actor_user_id: ACTOR_USER_ID,
      actor_email: ACTOR_EMAIL,
      target_user_id: null,
      target_email: TARGET_EMAIL,
      target_role: 'viewer',
      metadata: { invitation_id: INVITATION_ID },
    });

    expect(mockFrom).toHaveBeenCalledWith('activity_log');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG_ID,
        event_type: 'member_invited',
      })
    );
  });

  it('2. returns created ActivityLogEntry on success', async () => {
    const row = makeLogEntry();
    const { supabase } = createInsertMock(row);

    const result = await logActivity(supabase, {
      org_id: ORG_ID,
      event_type: 'member_invited',
      actor_user_id: ACTOR_USER_ID,
      actor_email: ACTOR_EMAIL,
      target_user_id: null,
      target_email: TARGET_EMAIL,
      target_role: 'viewer',
      metadata: { invitation_id: INVITATION_ID },
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe(row.id);
    expect(result!.org_id).toBe(ORG_ID);
    expect(result!.event_type).toBe('member_invited');
    expect(result!.created_at).toBe(row.created_at);
  });

  it('3. does NOT throw on Supabase error (fire-and-forget pattern)', async () => {
    const { supabase } = createInsertMock(null, { message: 'DB down' });

    const result = await logActivity(supabase, {
      org_id: ORG_ID,
      event_type: 'member_invited',
      actor_user_id: ACTOR_USER_ID,
      actor_email: ACTOR_EMAIL,
      target_user_id: null,
      target_email: TARGET_EMAIL,
      target_role: 'viewer',
      metadata: {},
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// logInviteSent
// ---------------------------------------------------------------------------

describe('logInviteSent', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('4. event_type = member_invited', async () => {
    const row = makeLogEntry({ event_type: 'member_invited' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteSent(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetEmail: TARGET_EMAIL,
      targetRole: 'viewer',
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'member_invited' })
    );
  });

  it('5. metadata contains invitation_id', async () => {
    const row = makeLogEntry();
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteSent(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetEmail: TARGET_EMAIL,
      targetRole: 'viewer',
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { invitation_id: INVITATION_ID },
      })
    );
  });

  it('6. target_user_id = null (invitee not yet a user)', async () => {
    const row = makeLogEntry();
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteSent(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetEmail: TARGET_EMAIL,
      targetRole: 'analyst',
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ target_user_id: null })
    );
  });
});

// ---------------------------------------------------------------------------
// logInviteAccepted
// ---------------------------------------------------------------------------

describe('logInviteAccepted', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('7. event_type = member_joined', async () => {
    const row = makeLogEntry({ event_type: 'member_joined' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteAccepted(supabase, {
      orgId: ORG_ID,
      targetUserId: TARGET_USER_ID,
      targetEmail: TARGET_EMAIL,
      targetRole: 'viewer',
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'member_joined' })
    );
  });

  it('8. actor_user_id = null (invitee accepted — no external actor)', async () => {
    const row = makeLogEntry({ event_type: 'member_joined', actor_user_id: null });
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteAccepted(supabase, {
      orgId: ORG_ID,
      targetUserId: TARGET_USER_ID,
      targetEmail: TARGET_EMAIL,
      targetRole: 'viewer',
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_user_id: null, actor_email: null })
    );
  });
});

// ---------------------------------------------------------------------------
// logInviteRevoked
// ---------------------------------------------------------------------------

describe('logInviteRevoked', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('9. event_type = invitation_revoked', async () => {
    const row = makeLogEntry({ event_type: 'invitation_revoked' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteRevoked(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetEmail: TARGET_EMAIL,
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'invitation_revoked' })
    );
  });

  it('10. actor_user_id = revoker\'s user_id', async () => {
    const row = makeLogEntry({ event_type: 'invitation_revoked' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logInviteRevoked(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetEmail: TARGET_EMAIL,
      invitationId: INVITATION_ID,
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: ACTOR_USER_ID,
        actor_email: ACTOR_EMAIL,
      })
    );
  });
});

// ---------------------------------------------------------------------------
// logMemberRemoved
// ---------------------------------------------------------------------------

describe('logMemberRemoved', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('11. event_type = member_removed', async () => {
    const row = makeLogEntry({ event_type: 'member_removed' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logMemberRemoved(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetUserId: TARGET_USER_ID,
      targetEmail: TARGET_EMAIL,
      targetRole: 'analyst',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'member_removed' })
    );
  });

  it('12. target_role = role at time of removal', async () => {
    const row = makeLogEntry({ event_type: 'member_removed', target_role: 'analyst' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logMemberRemoved(supabase, {
      orgId: ORG_ID,
      actorUserId: ACTOR_USER_ID,
      actorEmail: ACTOR_EMAIL,
      targetUserId: TARGET_USER_ID,
      targetEmail: TARGET_EMAIL,
      targetRole: 'analyst',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ target_role: 'analyst' })
    );
  });
});

// ---------------------------------------------------------------------------
// logSeatSync
// ---------------------------------------------------------------------------

describe('logSeatSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('13. event_type = seat_sync', async () => {
    const row = makeLogEntry({ event_type: 'seat_sync' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logSeatSync(supabase, {
      orgId: ORG_ID,
      previousCount: 1,
      newCount: 2,
      success: true,
      source: 'invite',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'seat_sync' })
    );
  });

  it('14. actor_user_id = null (system event)', async () => {
    const row = makeLogEntry({ event_type: 'seat_sync', actor_user_id: null });
    const { supabase, mockInsert } = createInsertMock(row);

    await logSeatSync(supabase, {
      orgId: ORG_ID,
      previousCount: 1,
      newCount: 2,
      success: true,
      source: 'invite',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: null,
        actor_email: null,
        target_email: 'system',
      })
    );
  });

  it('15. metadata.success = false when sync failed', async () => {
    const row = makeLogEntry({ event_type: 'seat_sync' });
    const { supabase, mockInsert } = createInsertMock(row);

    await logSeatSync(supabase, {
      orgId: ORG_ID,
      previousCount: 2,
      newCount: 3,
      success: false,
      source: 'cron',
      error: 'Stripe API timeout',
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          success: false,
          error: 'Stripe API timeout',
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getActivityLog — Supabase mocked
// ---------------------------------------------------------------------------

describe('getActivityLog — Supabase mocked', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('16. returns entries sorted created_at DESC', async () => {
    const rows = [
      makeLogEntry({ id: 'aaa', created_at: '2026-03-01T12:00:00Z' }),
      makeLogEntry({ id: 'bbb', created_at: '2026-03-01T10:00:00Z' }),
    ];
    const { supabase, mockOrder } = createSelectMock(rows, 2);

    const result = await getActivityLog(supabase, ORG_ID, { page: 1, per_page: 10 });

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].id).toBe('aaa');
    expect(result.entries[1].id).toBe('bbb');
  });

  it('17. respects page and per_page params', async () => {
    const rows = [makeLogEntry({ id: 'page2-row1' })];
    const { supabase, mockRange } = createSelectMock(rows, 15);

    const result = await getActivityLog(supabase, ORG_ID, { page: 2, per_page: 5 });

    // page 2, per_page 5 => offset = 5, range(5, 9)
    expect(mockRange).toHaveBeenCalledWith(5, 9);
    expect(result.page).toBe(2);
    expect(result.per_page).toBe(5);
  });

  it('18. returns has_more=true when total > page * per_page', async () => {
    const rows = [makeLogEntry()];
    const { supabase } = createSelectMock(rows, 25);

    const result = await getActivityLog(supabase, ORG_ID, { page: 1, per_page: 10 });

    expect(result.has_more).toBe(true);
    expect(result.total).toBe(25);
  });

  it('19. returns empty entries array when no log entries (no crash)', async () => {
    const { supabase } = createSelectMock([], 0);

    const result = await getActivityLog(supabase, ORG_ID, { page: 1, per_page: 10 });

    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.has_more).toBe(false);
  });

  it('20. returns correct total count', async () => {
    const rows = [makeLogEntry(), makeLogEntry({ id: 'second' })];
    const { supabase } = createSelectMock(rows, 42);

    const result = await getActivityLog(supabase, ORG_ID, { page: 1, per_page: 10 });

    expect(result.total).toBe(42);
    expect(result.entries).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(10);
    // 42 > 1 * 10, so has_more should be true
    expect(result.has_more).toBe(true);
  });
});
