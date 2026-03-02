import { describe, it, expect } from 'vitest';
import { buildOrgChannelName } from '@/lib/realtime/types';
import { deduplicatePresenceUsers } from '@/hooks/usePresence';
import type { PresenceUser } from '@/lib/realtime/types';

// ---------------------------------------------------------------------------
// Sprint 116 — Realtime types + deduplicatePresenceUsers
// ---------------------------------------------------------------------------

describe('buildOrgChannelName — pure', () => {
  it('returns org:{orgId} for a valid UUID', () => {
    expect(buildOrgChannelName('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')).toBe(
      'org:a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    );
  });

  it('always prefixes with "org:"', () => {
    const result = buildOrgChannelName('any-string');
    expect(result.startsWith('org:')).toBe(true);
  });
});

describe('deduplicatePresenceUsers — pure', () => {
  const userA: PresenceUser = {
    user_id: 'user-a',
    email: 'a@test.com',
    full_name: 'User A',
    role: 'owner',
    current_page: '/dashboard',
    online_at: '2026-03-01T10:00:00.000Z',
  };

  const userB: PresenceUser = {
    user_id: 'user-b',
    email: 'b@test.com',
    full_name: 'User B',
    role: 'admin',
    current_page: '/dashboard',
    online_at: '2026-03-01T10:05:00.000Z',
  };

  it('deduplicates by user_id — one entry per user', () => {
    const state: Record<string, PresenceUser[]> = {
      key1: [userA, userA],
    };
    const result = deduplicatePresenceUsers(state, 'exclude-nobody');
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('user-a');
  });

  it('takes latest online_at per user_id', () => {
    const earlier = { ...userA, online_at: '2026-03-01T09:00:00.000Z' };
    const later = { ...userA, online_at: '2026-03-01T11:00:00.000Z' };
    const state: Record<string, PresenceUser[]> = {
      key1: [earlier],
      key2: [later],
    };
    const result = deduplicatePresenceUsers(state, 'exclude-nobody');
    expect(result[0].online_at).toBe('2026-03-01T11:00:00.000Z');
  });

  it('sorts by online_at ASC (longest-online first)', () => {
    const state: Record<string, PresenceUser[]> = {
      key1: [userB],
      key2: [userA],
    };
    const result = deduplicatePresenceUsers(state, 'exclude-nobody');
    expect(result[0].user_id).toBe('user-a'); // earlier online_at
    expect(result[1].user_id).toBe('user-b');
  });

  it('excludes the given excludeUserId from results', () => {
    const state: Record<string, PresenceUser[]> = {
      key1: [userA, userB],
    };
    const result = deduplicatePresenceUsers(state, 'user-a');
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe('user-b');
  });

  it('handles empty state → returns []', () => {
    const result = deduplicatePresenceUsers({}, 'user-a');
    expect(result).toEqual([]);
  });

  it('handles multiple presences per channel key (multiple tabs)', () => {
    const tab1 = { ...userA, online_at: '2026-03-01T10:00:00.000Z' };
    const tab2 = { ...userA, online_at: '2026-03-01T10:01:00.000Z' };
    const state: Record<string, PresenceUser[]> = {
      key1: [tab1, tab2, userB],
    };
    const result = deduplicatePresenceUsers(state, 'exclude-nobody');
    expect(result).toHaveLength(2);
    const a = result.find((u) => u.user_id === 'user-a');
    expect(a?.online_at).toBe('2026-03-01T10:01:00.000Z');
  });
});
