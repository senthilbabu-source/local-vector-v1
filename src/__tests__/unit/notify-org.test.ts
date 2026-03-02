import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Sprint 116 — notifyOrg + buildCronNotification
// ---------------------------------------------------------------------------

// Mock the service role client before importing
const mockSend = vi.fn().mockResolvedValue('ok');
const mockChannel = vi.fn().mockReturnValue({ send: mockSend });
const mockCreateServiceRoleClient = vi.fn().mockReturnValue({ channel: mockChannel });

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

import { notifyOrg, buildCronNotification } from '@/lib/realtime/notify-org';
import type { NotificationPayload } from '@/lib/realtime/types';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildCronNotification — pure', () => {
  it('returns NotificationPayload with correct event type', () => {
    const result = buildCronNotification('cron_sov_complete', 'SOV done', ['sov']);
    expect(result.event).toBe('cron_sov_complete');
    expect(result.message).toBe('SOV done');
  });

  it('sent_at is a valid ISO string', () => {
    const result = buildCronNotification('cron_audit_complete', 'Audit done', []);
    expect(() => new Date(result.sent_at).toISOString()).not.toThrow();
    expect(new Date(result.sent_at).getTime()).toBeGreaterThan(0);
  });

  it('refresh_keys correctly included', () => {
    const result = buildCronNotification('cron_sov_complete', 'test', ['sov', 'visibility']);
    expect(result.refresh_keys).toEqual(['sov', 'visibility']);
  });
});

describe('notifyOrg — Supabase service role mocked', () => {
  const testPayload: NotificationPayload = {
    event: 'cron_sov_complete',
    message: 'Test message',
    refresh_keys: ['sov'],
    sent_at: '2026-03-01T10:00:00.000Z',
  };

  it('calls supabase.channel() with "org:{orgId}"', async () => {
    await notifyOrg('org-123', testPayload);
    expect(mockChannel).toHaveBeenCalledWith('org:org-123');
  });

  it('calls .send() with type="broadcast", event="notification"', async () => {
    await notifyOrg('org-123', testPayload);
    expect(mockSend).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'notification',
      payload: testPayload,
    });
  });

  it('payload matches the NotificationPayload argument', async () => {
    await notifyOrg('org-456', testPayload);
    const sentPayload = mockSend.mock.calls[0][0].payload;
    expect(sentPayload).toEqual(testPayload);
  });

  it('does NOT throw when Supabase broadcast fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('broadcast failed'));
    await expect(notifyOrg('org-123', testPayload)).resolves.toBeUndefined();
  });

  it('uses service role client (not user-scoped)', async () => {
    await notifyOrg('org-123', testPayload);
    expect(mockCreateServiceRoleClient).toHaveBeenCalled();
  });
});
